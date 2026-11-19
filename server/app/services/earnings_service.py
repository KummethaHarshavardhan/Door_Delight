from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.database.mongodb import get_database
from app.services.audit_service import log_delivery_audit
from app.services.routing_service import calculate_road_distance_km, geocode_address_text
from app.utils.serializers import serialize_doc, serialize_docs, utc_now

logger = logging.getLogger(__name__)


def _to_utc_aware(val: Any) -> Optional[datetime]:
    """Normalize naive/aware datetimes or ISO strings from MongoDB into UTC-aware datetimes."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=timezone.utc) if val.tzinfo is None else val.astimezone(timezone.utc)
    if isinstance(val, str):
        try:
            parsed = datetime.fromisoformat(val.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
        except ValueError:
            return None
    return None

DEFAULT_RATE_CONFIG = {
    "config_key": "default",
    "base_amount": 20.0,
    "per_km_rate": 8.0,
    "minimum_payout": 30.0,
    "default_incentive": 0.0,
}


async def get_rate_config() -> Dict[str, Any]:
    db = get_database()
    doc = await db.delivery_rate_config.find_one({"config_key": "default"})
    if not doc:
        now = utc_now()
        doc = {**DEFAULT_RATE_CONFIG, "created_at": now, "updated_at": now}
        await db.delivery_rate_config.insert_one(doc)
    return serialize_doc(doc)


async def update_rate_config(
    base_amount: float,
    per_km_rate: float,
    minimum_payout: float,
    default_incentive: float,
    admin_user: Dict[str, Any],
) -> Dict[str, Any]:
    db = get_database()
    now = utc_now()
    await db.delivery_rate_config.update_one(
        {"config_key": "default"},
        {
            "$set": {
                "base_amount": round(float(base_amount), 2),
                "per_km_rate": round(float(per_km_rate), 2),
                "minimum_payout": round(float(minimum_payout), 2),
                "default_incentive": round(float(default_incentive), 2),
                "updated_by": admin_user["id"],
                "updated_at": now,
            },
            "$setOnInsert": {"config_key": "default", "created_at": now},
        },
        upsert=True,
    )
    await log_delivery_audit(
        action="RATE_CONFIG_UPDATED",
        entity_type="DELIVERY_RATE_CONFIG",
        entity_id="default",
        actor_id=admin_user["id"],
        actor_role=admin_user["role"],
        details={
            "base_amount": base_amount,
            "per_km_rate": per_km_rate,
            "minimum_payout": minimum_payout,
            "default_incentive": default_incentive,
        },
    )
    return await get_rate_config()


async def record_delivery_earnings(order: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Create exactly one immutable DeliveryEarnings record after successful delivery.
    Uses actual road route distance (OSRM / OpenRouteService); never invents a distance.
    """
    db = get_database()
    order_id = str(order["_id"])
    dp_id = order.get("delivery_partner_id")
    if not dp_id:
        return None

    existing = await db.delivery_earnings.find_one({"order_id": order_id})
    if existing:
        return serialize_doc(existing)

    rate = await get_rate_config()
    rest = await db.restaurants.find_one({"_id": ObjectId(order["restaurant_id"])})

    # Resolve restaurant coordinates
    r_lat = rest.get("lat") if rest else None
    r_lng = rest.get("lng") if rest else None
    if (r_lat is None or r_lng is None) and rest:
        r_addr = f"{rest.get('address', '')}, {rest.get('city', '')}".strip(", ")
        coords = await geocode_address_text(r_addr)
        if coords:
            r_lat, r_lng = coords
            await db.restaurants.update_one({"_id": rest["_id"]}, {"$set": {"lat": r_lat, "lng": r_lng}})

    # Resolve customer delivery address coordinates
    d_addr = order.get("delivery_address", {}) or {}
    c_lat = d_addr.get("lat")
    c_lng = d_addr.get("lng")
    if c_lat is None or c_lng is None:
        addr_text = f"{d_addr.get('street', '')}, {d_addr.get('city', '')} {d_addr.get('pincode', '')}".strip(", ")
        coords = await geocode_address_text(addr_text)
        if coords:
            c_lat, c_lng = coords

    distance_km, provider = await calculate_road_distance_km(r_lat, r_lng, c_lat, c_lng)
    eligible_distance_km = distance_km if distance_km is not None else 0.0
    distance_status = "CALCULATED" if distance_km is not None else "UNAVAILABLE"

    base_amount = float(rate["base_amount"])
    per_km_rate = float(rate["per_km_rate"])
    minimum_payout = float(rate["minimum_payout"])
    incentives = float(rate.get("default_incentive", 0.0))

    raw_total = base_amount + (eligible_distance_km * per_km_rate) + incentives
    final_earnings = round(max(minimum_payout, raw_total), 2)

    now = utc_now()
    doc = {
        "order_id": order_id,
        "order_number": order["order_number"],
        "delivery_partner_id": dp_id,
        "restaurant_id": order["restaurant_id"],
        "restaurant_name": order.get("restaurant_name", ""),
        "eligible_distance_km": eligible_distance_km,
        "distance_status": distance_status,
        "route_provider": provider,
        "base_amount": base_amount,
        "per_km_rate": per_km_rate,
        "minimum_payout": minimum_payout,
        "incentives": incentives,
        "final_earnings": final_earnings,
        "payout_status": "UNPAID",
        "payout_id": None,
        "delivered_at": now,
        "created_at": now,
    }

    try:
        res = await db.delivery_earnings.insert_one(doc)
        doc["_id"] = res.inserted_id
    except DuplicateKeyError:
        existing = await db.delivery_earnings.find_one({"order_id": order_id})
        return serialize_doc(existing)

    await db.orders.update_one(
        {"_id": order["_id"]},
        {
            "$set": {
                "delivery_distance_km": eligible_distance_km,
                "delivery_distance_status": distance_status,
                "delivery_route_provider": provider,
                "applied_delivery_rate": {
                    "base_amount": base_amount,
                    "per_km_rate": per_km_rate,
                    "minimum_payout": minimum_payout,
                    "incentives": incentives,
                },
                "partner_earning_amount": final_earnings,
            }
        },
    )

    await log_delivery_audit(
        action="EARNINGS_RECORDED",
        entity_type="DELIVERY_EARNINGS",
        entity_id=order_id,
        actor_id=dp_id,
        actor_role="DELIVERY_PARTNER",
        details={
            "eligible_distance_km": eligible_distance_km,
            "distance_status": distance_status,
            "final_earnings": final_earnings,
        },
    )
    return serialize_doc(doc)


async def get_partner_earnings_dashboard(partner_id: str) -> Dict[str, Any]:
    db = get_database()
    now = utc_now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)

    records = await db.delivery_earnings.find(
        {"delivery_partner_id": partner_id}
    ).sort("delivered_at", -1).to_list(length=1000)

    today_deliveries = 0
    today_earnings = 0.0
    weekly_earnings = 0.0
    monthly_earnings = 0.0
    total_lifetime_earnings = 0.0
    pending_payout = 0.0
    paid_amount = 0.0
    total_distance_km = 0.0

    for r in records:
        amt = float(r.get("final_earnings") or 0.0)
        dist = float(r.get("eligible_distance_km") or 0.0)
        dt = _to_utc_aware(r.get("delivered_at") or r.get("created_at"))
        total_lifetime_earnings += amt
        total_distance_km += dist

        if r.get("payout_status") == "PAID":
            paid_amount += amt
        else:
            pending_payout += amt

        if dt and dt >= today_start:
            today_deliveries += 1
            today_earnings += amt
        if dt and dt >= week_start:
            weekly_earnings += amt
        if dt and dt >= month_start:
            monthly_earnings += amt

    payouts = await db.delivery_payouts.find(
        {"delivery_partner_id": partner_id}
    ).sort("created_at", -1).to_list(length=200)

    return {
        "today_deliveries": today_deliveries,
        "today_earnings": round(today_earnings, 2),
        "weekly_earnings": round(weekly_earnings, 2),
        "monthly_earnings": round(monthly_earnings, 2),
        "total_lifetime_earnings": round(total_lifetime_earnings, 2),
        "pending_payout": round(pending_payout, 2),
        "already_paid_amount": round(paid_amount, 2),
        "total_deliveries": len(records),
        "total_distance_km": round(total_distance_km, 2),
        "earnings_history": serialize_docs(records),
        "payout_history": serialize_docs(payouts),
    }

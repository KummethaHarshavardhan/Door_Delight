import csv
import hashlib
import hmac
import io
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import httpx
from bson import ObjectId
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.config.settings import get_settings
from app.database.mongodb import get_database
from app.models.enums import PaymentMethod, SettlementStatus, UserRole
from app.services.audit_service import log_delivery_audit
from app.utils.serializers import serialize_doc, serialize_docs, to_object_id, utc_now

logger = logging.getLogger(__name__)


async def send_sms_notification(phone_number: str, message: str) -> Dict[str, Any]:
    """Send SMS via Twilio if configured; never pretends SMS was sent when unconfigured."""
    settings = get_settings()
    if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER):
        return {"sent": False, "provider": "NONE", "reason": "SMS_PROVIDER_NOT_CONFIGURED"}
    if not phone_number or not phone_number.strip():
        return {"sent": False, "provider": "TWILIO", "reason": "MISSING_PHONE_NUMBER"}

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                data={
                    "From": settings.TWILIO_FROM_NUMBER,
                    "To": phone_number.strip(),
                    "Body": message,
                },
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            )
            if 200 <= resp.status_code < 300:
                return {"sent": True, "provider": "TWILIO", "reason": "SENT"}
            return {"sent": False, "provider": "TWILIO", "reason": f"HTTP_{resp.status_code}"}
    except Exception as exc:
        logger.warning("Twilio SMS failed: %s", type(exc).__name__)
        return {"sent": False, "provider": "TWILIO", "reason": type(exc).__name__}


async def record_cod_collection(order: Dict[str, Any], partner: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Record a verified COD cash collection when a COD order is delivered. Never runs for online orders."""
    if order.get("payment_method") != PaymentMethod.COD.value:
        return None

    db = get_database()
    settings = get_settings()
    order_id = str(order["_id"])
    now = utc_now()
    due_at = now + timedelta(days=int(settings.COD_OVERDUE_DAYS or 2))

    doc = {
        "order_id": order_id,
        "order_number": order["order_number"],
        "delivery_partner_id": partner["id"],
        "delivery_partner_name": partner.get("name", ""),
        "restaurant_id": order["restaurant_id"],
        "restaurant_name": order.get("restaurant_name", ""),
        "amount": round(float(order["total_amount"]), 2),
        "collected_at": now,
        "due_at": due_at,
        "created_at": now,
    }
    try:
        res = await db.cod_collections.insert_one(doc)
        doc["_id"] = res.inserted_id
    except DuplicateKeyError:
        existing = await db.cod_collections.find_one({"order_id": order_id})
        return serialize_doc(existing)

    await log_delivery_audit(
        action="COD_COLLECTED",
        entity_type="COD_COLLECTION",
        entity_id=order_id,
        actor_id=partner["id"],
        actor_role=partner["role"],
        details={"amount": doc["amount"], "restaurant_id": doc["restaurant_id"]},
    )
    return serialize_doc(doc)


async def get_partner_cod_ledger(partner_id: str, now_override: Optional[datetime] = None) -> Dict[str, Any]:
    """Compute separate restaurant-wise COD balances for a delivery partner."""
    db = get_database()
    now = now_override or utc_now()

    collections = await db.cod_collections.find({"delivery_partner_id": partner_id}).sort("collected_at", -1).to_list(length=1000)
    settlements = await db.cod_settlements.find({"delivery_partner_id": partner_id}).sort("created_at", -1).to_list(length=1000)
    reminders = await db.cod_reminder_history.find({"delivery_partner_id": partner_id}).sort("sent_at", -1).to_list(length=100)
    user = await db.users.find_one({"_id": ObjectId(partner_id)})
    restriction = await db.partner_restrictions.find_one({"delivery_partner_id": partner_id})

    # Group by restaurant_id
    by_rest: Dict[str, Dict[str, Any]] = {}
    for c in collections:
        rid = c["restaurant_id"]
        entry = by_rest.setdefault(rid, {
            "restaurant_id": rid,
            "restaurant_name": c.get("restaurant_name", ""),
            "cod_order_count": 0,
            "order_ids": [],
            "order_numbers": [],
            "total_cod_collected": 0.0,
            "total_remitted": 0.0,
            "pending_verification_amount": 0.0,
            "outstanding_balance": 0.0,
            "earliest_due_at": None,
        })
        entry["cod_order_count"] += 1
        entry["order_ids"].append(c["order_id"])
        entry["order_numbers"].append(c["order_number"])
        entry["total_cod_collected"] = round(entry["total_cod_collected"] + float(c["amount"]), 2)
        due_at = c.get("due_at")
        if due_at and (entry["earliest_due_at"] is None or due_at < entry["earliest_due_at"]):
            entry["earliest_due_at"] = due_at

    for s in settlements:
        rid = s["restaurant_id"]
        if rid not in by_rest:
            continue
        if s.get("status") == SettlementStatus.VERIFIED.value:
            by_rest[rid]["total_remitted"] = round(by_rest[rid]["total_remitted"] + float(s["amount"]), 2)
        elif s.get("status") == SettlementStatus.PAYMENT_VERIFICATION_PENDING.value:
            by_rest[rid]["pending_verification_amount"] = round(by_rest[rid]["pending_verification_amount"] + float(s["amount"]), 2)

    # Fetch restaurant UPI IDs
    rest_oids = [ObjectId(rid) for rid in by_rest.keys() if ObjectId.is_valid(rid)]
    rest_map = {}
    if rest_oids:
        rests = await db.restaurants.find({"_id": {"$in": rest_oids}}).to_list(length=200)
        rest_map = {str(r["_id"]): r for r in rests}

    ledgers: List[Dict[str, Any]] = []
    total_outstanding = 0.0
    for rid, entry in by_rest.items():
        outstanding = round(max(0.0, entry["total_cod_collected"] - entry["total_remitted"]), 2)
        entry["outstanding_balance"] = outstanding
        total_outstanding = round(total_outstanding + outstanding, 2)

        due_at = entry["earliest_due_at"]
        overdue_days = 0
        is_overdue = False
        if outstanding > 0 and due_at and now > due_at:
            is_overdue = True
            overdue_days = max(1, (now - due_at).days + 1)

        rest_doc = rest_map.get(rid, {})
        entry["restaurant_upi_id"] = rest_doc.get("upi_id", "")
        entry["earliest_due_at"] = due_at.isoformat() if due_at else None
        entry["is_overdue"] = is_overdue
        entry["overdue_days"] = overdue_days
        entry["settlement_status"] = (
            "SETTLED" if outstanding == 0 else ("OVERDUE" if is_overdue else "PENDING")
        )
        ledgers.append(entry)

    return {
        "total_outstanding_cod": total_outstanding,
        "cod_restricted": bool(user.get("cod_restricted", False)) if user else False,
        "account_status": user.get("account_status", "ACTIVE") if user else "ACTIVE",
        "restriction": serialize_doc(restriction),
        "restaurant_ledgers": ledgers,
        "settlement_history": serialize_docs(settlements),
        "reminder_history": serialize_docs(reminders),
    }


async def _refresh_partner_restriction_state(partner_id: str) -> None:
    """Clear COD_SETTLEMENT_OVERDUE restriction automatically if total outstanding COD reaches 0."""
    ledger = await get_partner_cod_ledger(partner_id)
    if ledger["total_outstanding_cod"] <= 0:
        db = get_database()
        now = utc_now()
        await db.users.update_one(
            {"_id": ObjectId(partner_id)},
            {"$set": {"cod_restricted": False, "account_status": "ACTIVE", "updated_at": now}},
        )
        await db.partner_restrictions.update_one(
            {"delivery_partner_id": partner_id},
            {"$set": {"is_restricted": False, "resolved_at": now, "updated_at": now}},
        )


async def initiate_cod_upi_settlement(
    partner: Dict[str, Any],
    restaurant_id: str,
    amount: float,
    transaction_reference: str,
    upi_app: str = "UPI",
    razorpay_order_id: str = "",
    razorpay_payment_id: str = "",
    razorpay_signature: str = "",
    idempotency_key: str = "",
) -> Dict[str, Any]:
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Settlement amount must be greater than zero")
    clean_ref = transaction_reference.strip()
    if not clean_ref:
        raise HTTPException(status_code=400, detail="Transaction reference is required")

    db = get_database()
    to_object_id(restaurant_id, "restaurant_id")

    if idempotency_key:
        existing_idem = await db.cod_settlements.find_one({"idempotency_key": idempotency_key})
        if existing_idem:
            return serialize_doc(existing_idem)

    if await db.cod_settlements.find_one({"transaction_reference": clean_ref}):
        raise HTTPException(status_code=409, detail="Duplicate settlement transaction reference")

    ledger = await get_partner_cod_ledger(partner["id"])
    rest_ledger = next((l for l in ledger["restaurant_ledgers"] if l["restaurant_id"] == restaurant_id), None)
    if not rest_ledger or rest_ledger["outstanding_balance"] <= 0:
        raise HTTPException(status_code=400, detail="No outstanding COD balance for this restaurant")

    if round(amount, 2) > rest_ledger["outstanding_balance"]:
        raise HTTPException(
            status_code=400,
            detail=f"Amount ₹{amount:.2f} exceeds outstanding COD balance ₹{rest_ledger['outstanding_balance']:.2f}",
        )

    # Never mark settlement VERIFIED unless verified via Razorpay signature (or later Admin reconciliation)
    status_val = SettlementStatus.PAYMENT_VERIFICATION_PENDING.value
    settings = get_settings()
    if razorpay_order_id and razorpay_payment_id and razorpay_signature and settings.RAZORPAY_KEY_SECRET:
        msg = f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8")
        expected = hmac.new(settings.RAZORPAY_KEY_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, razorpay_signature):
            raise HTTPException(status_code=400, detail="Razorpay settlement signature verification failed")
        status_val = SettlementStatus.VERIFIED.value

    now = utc_now()
    rest_doc = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
    doc = {
        "delivery_partner_id": partner["id"],
        "partner_name": partner.get("name", ""),
        "restaurant_id": restaurant_id,
        "restaurant_name": rest_doc.get("name", "") if rest_doc else rest_ledger["restaurant_name"],
        "restaurant_upi_id": rest_doc.get("upi_id", "") if rest_doc else "",
        "amount": round(float(amount), 2),
        "upi_app": upi_app,
        "transaction_reference": clean_ref,
        "related_order_ids": rest_ledger["order_ids"],
        "status": status_val,
        "idempotency_key": idempotency_key or None,
        "verified_at": now if status_val == SettlementStatus.VERIFIED.value else None,
        "created_at": now,
        "updated_at": now,
    }
    res = await db.cod_settlements.insert_one(doc)
    doc["_id"] = res.inserted_id

    if status_val == SettlementStatus.VERIFIED.value:
        await _refresh_partner_restriction_state(partner["id"])

    await log_delivery_audit(
        action="COD_SETTLEMENT_SUBMITTED",
        entity_type="COD_SETTLEMENT",
        entity_id=str(res.inserted_id),
        actor_id=partner["id"],
        actor_role=partner["role"],
        details={"restaurant_id": restaurant_id, "amount": doc["amount"], "status": status_val},
    )
    return serialize_doc(doc)


async def run_cod_reminder_and_overdue_check(now_override: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Scheduled COD reminder & 2-day overdue enforcement.
    MANDATORY RULE: Never sends reminders or restricts accounts when Outstanding COD Balance <= 0.
    """
    db = get_database()
    settings = get_settings()
    now = now_override or utc_now()
    overdue_threshold_days = int(settings.COD_OVERDUE_DAYS or 2)
    period_key = now.strftime("%Y-%m-%d")

    partners = await db.users.find({"role": UserRole.DELIVERY_PARTNER.value}).to_list(length=500)
    admins = await db.users.find({"role": UserRole.ADMIN.value, "is_active": True}).to_list(length=50)

    day1_sent = 0
    day2_sent = 0
    restricted_count = 0

    for partner in partners:
        pid = str(partner["_id"])
        ledger = await get_partner_cod_ledger(pid, now_override=now)

        # ZERO RUPEE OUTSTANDING RULE
        if ledger["total_outstanding_cod"] <= 0:
            if partner.get("cod_restricted"):
                await _refresh_partner_restriction_state(pid)
            continue

        for rl in ledger["restaurant_ledgers"]:
            outstanding = rl["outstanding_balance"]
            if outstanding <= 0 or not rl["is_overdue"]:
                continue

            overdue_days = rl["overdue_days"]
            rid = rl["restaurant_id"]

            if overdue_days < overdue_threshold_days:
                # Day 1 Reminder
                msg = (
                    "DoorDelight Reminder: You have outstanding COD cash to settle with your restaurant. "
                    "Please complete your pending UPI settlement today."
                )
                try:
                    await db.cod_reminder_history.insert_one({
                        "delivery_partner_id": pid,
                        "restaurant_id": rid,
                        "reminder_day": 1,
                        "period_key": period_key,
                        "outstanding_amount": outstanding,
                        "message": msg,
                        "sms_result": await send_sms_notification(partner.get("phone", ""), msg),
                        "sent_at": now,
                    })
                    await db.notifications.insert_one({
                        "user_id": pid,
                        "title": "COD Settlement Reminder (Day 1)",
                        "message": msg,
                        "is_read": False,
                        "created_at": now,
                    })
                    day1_sent += 1
                except DuplicateKeyError:
                    pass
            else:
                # Day 2+ Overdue: Restrict new assignments & alert ADMIN
                await db.users.update_one(
                    {"_id": partner["_id"]},
                    {"$set": {"cod_restricted": True, "account_status": "COD_SETTLEMENT_OVERDUE", "updated_at": now}},
                )
                await db.partner_restrictions.update_one(
                    {"delivery_partner_id": pid},
                    {
                        "$set": {
                            "delivery_partner_id": pid,
                            "partner_name": partner.get("name", ""),
                            "is_restricted": True,
                            "reason": "COD_SETTLEMENT_OVERDUE",
                            "outstanding_amount": ledger["total_outstanding_cod"],
                            "restricted_at": now,
                            "updated_at": now,
                        }
                    },
                    upsert=True,
                )
                restricted_count += 1

                msg = (
                    "DoorDelight Alert: Your COD settlement is still pending. "
                    "Please settle the outstanding amount immediately or contact DoorDelight support."
                )
                try:
                    await db.cod_reminder_history.insert_one({
                        "delivery_partner_id": pid,
                        "restaurant_id": rid,
                        "reminder_day": 2,
                        "period_key": period_key,
                        "outstanding_amount": outstanding,
                        "message": msg,
                        "sms_result": await send_sms_notification(partner.get("phone", ""), msg),
                        "sent_at": now,
                    })
                    await db.notifications.insert_one({
                        "user_id": pid,
                        "title": "COD Settlement Overdue Alert",
                        "message": msg,
                        "is_read": False,
                        "created_at": now,
                    })
                    for adm in admins:
                        await db.notifications.insert_one({
                            "user_id": str(adm["_id"]),
                            "title": "Overdue Partner COD Alert",
                            "message": (
                                f"Partner {partner.get('name')} (ID: {pid}, Phone: {partner.get('phone', 'N/A')}) "
                                f"owes ₹{outstanding:.2f} to {rl['restaurant_name']} ({overdue_days} days overdue)."
                            ),
                            "is_read": False,
                            "created_at": now,
                        })
                    day2_sent += 1
                except DuplicateKeyError:
                    pass

    return {
        "day1_reminders": day1_sent,
        "day2_alerts": day2_sent,
        "restricted_partners": restricted_count,
    }


async def get_manager_cod_settlements(manager_id: str) -> Dict[str, Any]:
    db = get_database()
    rest = await db.restaurants.find_one({"manager_id": manager_id, "is_active": True})
    if not rest:
        return {
            "restaurant": None,
            "total_cod_collected": 0.0,
            "total_upi_received": 0.0,
            "total_pending_cod": 0.0,
            "collections": [],
            "settlements": [],
        }

    rid = str(rest["_id"])
    collections = await db.cod_collections.find({"restaurant_id": rid}).sort("collected_at", -1).to_list(length=500)
    settlements = await db.cod_settlements.find({"restaurant_id": rid}).sort("created_at", -1).to_list(length=500)

    total_collected = round(sum(float(c["amount"]) for c in collections), 2)
    total_received = round(sum(float(s["amount"]) for s in settlements if s.get("status") == SettlementStatus.VERIFIED.value), 2)
    total_pending = round(max(0.0, total_collected - total_received), 2)

    return {
        "restaurant": serialize_doc(rest),
        "total_cod_collected": total_collected,
        "total_upi_received": total_received,
        "total_pending_cod": total_pending,
        "collections": serialize_docs(collections),
        "settlements": serialize_docs(settlements),
    }


async def get_admin_cod_settlements() -> Dict[str, Any]:
    db = get_database()
    collections = await db.cod_collections.find({}).sort("collected_at", -1).to_list(length=1000)
    settlements = await db.cod_settlements.find({}).sort("created_at", -1).to_list(length=1000)
    restrictions = await db.partner_restrictions.find({"is_restricted": True}).to_list(length=200)
    reminders = await db.cod_reminder_history.find({}).sort("sent_at", -1).limit(50).to_list(length=50)

    total_collected = round(sum(float(c["amount"]) for c in collections), 2)
    total_remitted = round(sum(float(s["amount"]) for s in settlements if s.get("status") == SettlementStatus.VERIFIED.value), 2)
    total_outstanding = round(max(0.0, total_collected - total_remitted), 2)
    pending_verifications = [s for s in settlements if s.get("status") == SettlementStatus.PAYMENT_VERIFICATION_PENDING.value]

    return {
        "summary": {
            "total_cod_collected": total_collected,
            "total_cod_remitted": total_remitted,
            "total_outstanding_cod": total_outstanding,
            "pending_verification_count": len(pending_verifications),
            "restricted_partners_count": len(restrictions),
        },
        "settlements": serialize_docs(settlements),
        "collections": serialize_docs(collections),
        "restricted_partners": serialize_docs(restrictions),
        "reminder_history": serialize_docs(reminders),
    }


async def admin_verify_cod_settlement(
    settlement_id: str,
    approve: bool,
    note: str,
    admin_user: Dict[str, Any],
) -> Dict[str, Any]:
    db = get_database()
    sid = to_object_id(settlement_id, "settlement_id")
    settlement = await db.cod_settlements.find_one({"_id": sid})
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement record not found")

    now = utc_now()
    new_status = SettlementStatus.VERIFIED.value if approve else SettlementStatus.FAILED.value
    await db.cod_settlements.update_one(
        {"_id": sid},
        {
            "$set": {
                "status": new_status,
                "admin_note": note.strip(),
                "verified_by": admin_user["id"],
                "verified_at": now if approve else None,
                "updated_at": now,
            }
        },
    )
    if approve:
        await _refresh_partner_restriction_state(settlement["delivery_partner_id"])

    await log_delivery_audit(
        action=f"COD_SETTLEMENT_{new_status}",
        entity_type="COD_SETTLEMENT",
        entity_id=settlement_id,
        actor_id=admin_user["id"],
        actor_role=admin_user["role"],
        details={"note": note.strip()},
    )
    updated = await db.cod_settlements.find_one({"_id": sid})
    return serialize_doc(updated)


async def admin_restore_partner_account(partner_id: str, note: str, admin_user: Dict[str, Any]) -> Dict[str, Any]:
    db = get_database()
    poid = to_object_id(partner_id, "partner_id")
    now = utc_now()
    await db.users.update_one(
        {"_id": poid},
        {"$set": {"cod_restricted": False, "account_status": "ACTIVE", "updated_at": now}},
    )
    await db.partner_restrictions.update_one(
        {"delivery_partner_id": partner_id},
        {"$set": {"is_restricted": False, "resolved_by": admin_user["id"], "resolution_note": note.strip(), "resolved_at": now, "updated_at": now}},
    )
    await log_delivery_audit(
        action="PARTNER_ACCOUNT_RESTORED",
        entity_type="DELIVERY_PARTNER",
        entity_id=partner_id,
        actor_id=admin_user["id"],
        actor_role=admin_user["role"],
        details={"note": note.strip()},
    )
    return {"message": "Delivery partner account restored"}


async def export_cod_settlements_csv() -> str:
    db = get_database()
    settlements = await db.cod_settlements.find({}).sort("created_at", -1).to_list(length=1000)
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["Settlement ID", "Partner", "Restaurant", "Amount (INR)", "UPI App", "Transaction Ref", "Status", "Created At"])
    for s in settlements:
        w.writerow([
            str(s["_id"]),
            s.get("partner_name", ""),
            s.get("restaurant_name", ""),
            s.get("amount", 0),
            s.get("upi_app", ""),
            s.get("transaction_reference", ""),
            s.get("status", ""),
            s.get("created_at").isoformat() if s.get("created_at") else "",
        ])
    return out.getvalue()

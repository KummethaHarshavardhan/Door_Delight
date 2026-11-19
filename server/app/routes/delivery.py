from datetime import timedelta
from typing import Any, Dict, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database.mongodb import get_database
from app.middleware.auth import require_roles
from app.models.enums import DeliveryAssignmentStatus, KYCStatus, OrderStatus, UserRole
from app.schemas.order import OrderStatusUpdateRequest
from app.services.cod_service import mark_cod_return_pending, report_cod_payment_refused
from app.services.cod_settlement_service import get_partner_cod_ledger, initiate_cod_upi_settlement
from app.services.earnings_service import get_partner_earnings_dashboard
from app.services.kyc_service import resolve_partner_kyc_status
from app.services.order_service import update_order_status
from app.services.websocket_manager import ws_manager
from app.utils.serializers import serialize_doc, serialize_docs, to_object_id, utc_now

router = APIRouter(prefix="/api/delivery", tags=["Delivery Partner"])


class PartnerOnlineRequest(BaseModel):
    is_online: bool


class PartnerLocationRequest(BaseModel):
    order_id: str
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = Field(default=None, ge=0)


class PartnerGpsStatusRequest(BaseModel):
    order_id: str
    gps_status: str = Field(..., pattern="^(ACTIVE|PERMISSION_DENIED|GPS_UNAVAILABLE|TIMEOUT|STOPPED)$")


class CODRefusalRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=300)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)


class CODSettlementPayRequest(BaseModel):
    restaurant_id: str
    amount: float = Field(..., gt=0)
    transaction_reference: str = Field(..., min_length=3, max_length=120)
    upi_app: str = Field(default="UPI", max_length=40)
    razorpay_order_id: str = Field(default="", max_length=120)
    razorpay_payment_id: str = Field(default="", max_length=120)
    razorpay_signature: str = Field(default="", max_length=250)
    idempotency_key: str = Field(default="", max_length=120)


@router.put("/status")
async def set_partner_online_status(
    payload: PartnerOnlineRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.DELIVERY_PARTNER)),
) -> Dict[str, Any]:
    db = get_database()
    uid = ObjectId(current_user["id"])
    user = await db.users.find_one({"_id": uid})
    kyc_status, _ = await resolve_partner_kyc_status(current_user["id"], user)

    if payload.is_online and (not user or kyc_status != KYCStatus.APPROVED.value):
        raise HTTPException(
            status_code=403,
            detail="KYC verification must be APPROVED by an administrator before going online",
        )
    if payload.is_online and user and user.get("cod_restricted"):
        raise HTTPException(
            status_code=403,
            detail="Account is restricted (COD_SETTLEMENT_OVERDUE). Please settle your outstanding COD balance.",
        )

    if not payload.is_online and user and user.get("active_order_id"):
        raise HTTPException(
            status_code=400,
            detail="Cannot go offline while you have an active delivery",
        )

    new_delivery_status = "AVAILABLE" if payload.is_online else "OFFLINE"
    await db.users.update_one(
        {"_id": uid},
        {
            "$set": {
                "is_online": payload.is_online,
                "is_available_for_delivery": payload.is_online,
                "delivery_status": new_delivery_status,
                "updated_at": utc_now(),
            }
        },
    )
    return {"is_online": payload.is_online, "delivery_status": new_delivery_status}


@router.get("/assignments")
async def get_delivery_assignments(
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.DELIVERY_PARTNER)),
) -> Dict[str, Any]:
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    kyc_status, kyc_doc = await resolve_partner_kyc_status(current_user["id"], user)
    cod_restricted = bool(user.get("cod_restricted", False)) if user else False
    is_online = (
        (user.get("is_online", False) if user else False)
        and (kyc_status == KYCStatus.APPROVED.value)
        and not cod_restricted
    )
    active_order_id = user.get("active_order_id") if user else None

    my_active_orders = await db.orders.find({
        "delivery_partner_id": current_user["id"],
        "status": {
            "$in": [
                OrderStatus.READY_FOR_PICKUP.value,
                OrderStatus.REACHED_RESTAURANT.value,
                OrderStatus.PICKED_UP.value,
                OrderStatus.OUT_FOR_DELIVERY.value,
                OrderStatus.REACHED_CUSTOMER.value,
                OrderStatus.DELIVERY_REFUSED.value,
                OrderStatus.COD_PAYMENT_FAILED.value,
                OrderStatus.COD_RETURN_PENDING.value,
            ]
        },
    }).sort("updated_at", -1).to_list(length=10)

    # Sync active_order_id if DB shows none active
    if not my_active_orders and active_order_id:
        await db.users.update_one(
            {"_id": ObjectId(current_user["id"])},
            {"$set": {"active_order_id": None, "delivery_status": "AVAILABLE" if is_online else "OFFLINE"}},
        )
        active_order_id = None

    delivery_status = (
        "BUSY" if (my_active_orders or active_order_id) else ("AVAILABLE" if is_online else "OFFLINE")
    )

    available = []
    if is_online:
        # Sync any READY_FOR_PICKUP unassigned orders into delivery_assignments so orders never miss the pool
        ready_orders = await db.orders.find({
            "status": OrderStatus.READY_FOR_PICKUP.value,
            "delivery_partner_id": {"$in": [None, ""]},
        }).sort("updated_at", -1).to_list(length=50)

        now = utc_now()
        ready_order_ids = set()
        for r_order in ready_orders:
            oid_str = str(r_order["_id"])
            ready_order_ids.add(oid_str)
            await db.delivery_assignments.update_one(
                {"order_id": oid_str},
                {
                    "$set": {
                        "order_id": oid_str,
                        "order_number": r_order.get("order_number", ""),
                        "restaurant_id": r_order.get("restaurant_id", ""),
                        "restaurant_name": r_order.get("restaurant_name", ""),
                        "restaurant_address": r_order.get("restaurant_address", ""),
                        "delivery_address": r_order.get("delivery_address", {}),
                        "total_amount": r_order.get("total_amount", 0),
                        "payment_method": r_order.get("payment_method", "COD"),
                        "delivery_partner_id": None,
                        "status": DeliveryAssignmentStatus.AVAILABLE.value,
                        "updated_at": now,
                    },
                    "$setOnInsert": {"created_at": r_order.get("updated_at") or now},
                },
                upsert=True,
            )

        raw_available = await db.delivery_assignments.find(
            {"status": DeliveryAssignmentStatus.AVAILABLE.value}
        ).sort("created_at", -1).to_list(length=50)
        available = [a for a in raw_available if a.get("order_id") in ready_order_ids]

    return {
        "partner_status": {
            "is_online": is_online,
            "kyc_status": kyc_status,
            "kyc_rejection_reason": kyc_doc.get("rejection_reason", "") if kyc_doc else "",
            "cod_restricted": cod_restricted,
            "account_status": user.get("account_status", "ACTIVE") if user else "ACTIVE",
            "delivery_status": delivery_status,
            "active_order_id": active_order_id,
        },
        "available_assignments": serialize_docs(available),
        "active_orders": serialize_docs(my_active_orders),
    }


@router.post("/assignments/{assignment_id}/accept")
async def accept_assignment(
    assignment_id: str,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.DELIVERY_PARTNER)),
) -> Dict[str, Any]:
    db = get_database()
    oid = to_object_id(assignment_id, "assignment_id")
    partner_oid = ObjectId(current_user["id"])
    now = utc_now()

    # Sync authoritative KYC status before atomic partner lock
    partner_user = await db.users.find_one({"_id": partner_oid})
    kyc_status, _ = await resolve_partner_kyc_status(current_user["id"], partner_user)
    if kyc_status != KYCStatus.APPROVED.value:
        raise HTTPException(
            status_code=403,
            detail="KYC verification must be APPROVED before accepting delivery assignments",
        )

    # Step 1: Atomically lock the delivery partner (enforces APPROVED KYC + not COD restricted + 1 active order)
    locked_partner = await db.users.find_one_and_update(
        {
            "_id": partner_oid,
            "is_active": True,
            "kyc_status": KYCStatus.APPROVED.value,
            "cod_restricted": {"$ne": True},
            "is_online": True,
            "active_order_id": {"$in": [None, ""]},
        },
        {
            "$set": {
                "delivery_status": "BUSY",
                "active_order_id": "LOCKING",
                "updated_at": now,
            }
        },
        return_document=True,
    )
    if not locked_partner:
        raise HTTPException(
            status_code=409,
            detail="You cannot accept another order while you have an active delivery or are offline",
        )

    # Step 2: Atomically claim the available assignment (supports either assignment_id or order_id)
    claimed = await db.delivery_assignments.find_one_and_update(
        {
            "$or": [{"_id": oid}, {"order_id": assignment_id}],
            "status": DeliveryAssignmentStatus.AVAILABLE.value,
        },
        {
            "$set": {
                "delivery_partner_id": current_user["id"],
                "delivery_partner_name": current_user["name"],
                "status": DeliveryAssignmentStatus.ACCEPTED.value,
                "accepted_at": now,
                "updated_at": now,
            }
        },
        return_document=True,
    )
    if not claimed:
        await db.users.update_one(
            {"_id": partner_oid},
            {"$set": {"active_order_id": None, "delivery_status": "AVAILABLE", "updated_at": now}},
        )
        raise HTTPException(
            status_code=409,
            detail="This delivery assignment is no longer available",
        )

    order_oid = ObjectId(claimed["order_id"])
    # Step 3: Atomically assign the order only if still READY_FOR_PICKUP and unassigned
    updated_order = await db.orders.find_one_and_update(
        {
            "_id": order_oid,
            "status": OrderStatus.READY_FOR_PICKUP.value,
            "delivery_partner_id": {"$in": [None, ""]},
        },
        {
            "$set": {
                "delivery_partner_id": current_user["id"],
                "delivery_partner_name": current_user["name"],
                "delivery_partner_phone": current_user.get("phone", ""),
                "updated_at": now,
            },
            "$push": {
                "status_history": {
                    "status": OrderStatus.READY_FOR_PICKUP.value,
                    "timestamp": now,
                    "updated_by": current_user["id"],
                    "role": UserRole.DELIVERY_PARTNER.value,
                    "note": f"Delivery partner {current_user['name']} accepted the delivery",
                }
            },
        },
        return_document=True,
    )
    if not updated_order:
        await db.delivery_assignments.update_one(
            {"_id": claimed["_id"]},
            {"$set": {"delivery_partner_id": None, "status": DeliveryAssignmentStatus.CANCELLED.value}},
        )
        await db.users.update_one(
            {"_id": partner_oid},
            {"$set": {"active_order_id": None, "delivery_status": "AVAILABLE", "updated_at": now}},
        )
        raise HTTPException(status_code=409, detail="Order is no longer available for pickup")

    await db.users.update_one(
        {"_id": partner_oid},
        {"$set": {"active_order_id": str(order_oid), "delivery_status": "BUSY", "updated_at": now}},
    )
    rest = await db.restaurants.find_one({"_id": ObjectId(updated_order["restaurant_id"])})
    manager_id = rest.get("manager_id", "") if rest else ""
    serialized_order = serialize_doc(updated_order)
    await ws_manager.broadcast_order_event(
        serialized_order,
        event_type="DELIVERY_ASSIGNED",
        restaurant_manager_id=manager_id,
    )

    return {"assignment": serialize_doc(claimed), "order": serialized_order}


@router.put("/orders/{order_id}/status")
async def update_delivery_order_status(
    order_id: str,
    payload: OrderStatusUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.DELIVERY_PARTNER)),
) -> Dict[str, Any]:
    order = await update_order_status(order_id, payload, current_user)
    return {"order": order}


@router.post("/location")
async def update_partner_location(
    payload: PartnerLocationRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.DELIVERY_PARTNER)),
) -> Dict[str, Any]:
    """Persist real browser geolocation coordinates for an active delivery and broadcast via WebSocket."""
    db = get_database()
    order_oid = to_object_id(payload.order_id, "order_id")
    order = await db.orders.find_one({"_id": order_oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("delivery_partner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You are not assigned to this order")
    active_gps_statuses = {
        OrderStatus.READY_FOR_PICKUP.value,
        OrderStatus.REACHED_RESTAURANT.value,
        OrderStatus.PICKED_UP.value,
        OrderStatus.OUT_FOR_DELIVERY.value,
        OrderStatus.REACHED_CUSTOMER.value,
    }
    if order.get("status") not in active_gps_statuses:
        raise HTTPException(status_code=400, detail="Cannot share location for a completed or closed order")

    now = utc_now()
    loc_doc = {
        "lat": payload.lat,
        "lng": payload.lng,
        "accuracy": payload.accuracy,
        "updated_at": now,
    }
    await db.orders.update_one(
        {"_id": order_oid},
        {"$set": {"partner_location": loc_doc, "partner_gps_status": "ACTIVE", "updated_at": now}},
    )
    updated_order = await db.orders.find_one({"_id": order_oid})
    serialized = serialize_doc(updated_order)
    await ws_manager.broadcast_order_event(serialized, event_type="PARTNER_LOCATION_UPDATED")
    return {"location": serialized.get("partner_location"), "partner_gps_status": "ACTIVE"}


@router.post("/location/status")
async def update_partner_gps_status(
    payload: PartnerGpsStatusRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.DELIVERY_PARTNER)),
) -> Dict[str, Any]:
    """Record honest device GPS availability/permission status on the active order."""
    db = get_database()
    order_oid = to_object_id(payload.order_id, "order_id")
    order = await db.orders.find_one({"_id": order_oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("delivery_partner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="You are not assigned to this order")

    now = utc_now()
    await db.orders.update_one(
        {"_id": order_oid},
        {"$set": {"partner_gps_status": payload.gps_status, "updated_at": now}},
    )
    updated_order = await db.orders.find_one({"_id": order_oid})
    serialized = serialize_doc(updated_order)
    await ws_manager.broadcast_order_event(serialized, event_type="PARTNER_LOCATION_UPDATED")
    return {"partner_gps_status": payload.gps_status}


@router.post("/orders/{order_id}/cod-refused")
async def cod_refused(
    order_id: str,
    payload: CODRefusalRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.DELIVERY_PARTNER)),
) -> Dict[str, Any]:
    return await report_cod_payment_refused(
        order_id=order_id,
        partner=current_user,
        reason=payload.reason,
        lat=payload.lat,
        lng=payload.lng,
    )


@router.put("/orders/{order_id}/cod-return-pending")
async def cod_return_pending(
    order_id: str,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.DELIVERY_PARTNER)),
) -> Dict[str, Any]:
    return await mark_cod_return_pending(order_id=order_id, partner=current_user)


@router.get("/earnings")
async def get_delivery_earnings(
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.DELIVERY_PARTNER)),
) -> Dict[str, Any]:
    """Compute real today, weekly, monthly, and total delivery earnings from delivery_earnings."""
    return await get_partner_earnings_dashboard(current_user["id"])


@router.get("/cod-settlements")
async def get_partner_cod_settlements(
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.DELIVERY_PARTNER)),
) -> Dict[str, Any]:
    return await get_partner_cod_ledger(current_user["id"])


@router.post("/cod-settlements/pay")
async def pay_partner_cod_settlement(
    payload: CODSettlementPayRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.DELIVERY_PARTNER)),
) -> Dict[str, Any]:
    settlement = await initiate_cod_upi_settlement(
        partner=current_user,
        restaurant_id=payload.restaurant_id,
        amount=payload.amount,
        transaction_reference=payload.transaction_reference,
        upi_app=payload.upi_app,
        razorpay_order_id=payload.razorpay_order_id,
        razorpay_payment_id=payload.razorpay_payment_id,
        razorpay_signature=payload.razorpay_signature,
        idempotency_key=payload.idempotency_key,
    )
    return {"settlement": settlement}


@router.get("/history")
async def get_delivery_history(
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.DELIVERY_PARTNER)),
) -> Dict[str, Any]:
    db = get_database()
    orders = await db.orders.find({
        "delivery_partner_id": current_user["id"],
        "status": OrderStatus.DELIVERED.value,
    }).sort("updated_at", -1).to_list(length=100)
    return {"orders": serialize_docs(orders)}

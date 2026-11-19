from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException

from app.database.mongodb import get_database
from app.models.enums import DeliveryAssignmentStatus, OrderStatus, PaymentMethod, PaymentStatus, UserRole
from app.services.audit_service import log_delivery_audit
from app.services.websocket_manager import ws_manager
from app.utils.serializers import serialize_doc, serialize_docs, to_object_id, utc_now


async def report_cod_payment_refused(
    order_id: str,
    partner: Dict[str, Any],
    reason: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
) -> Dict[str, Any]:
    if not reason.strip():
        raise HTTPException(status_code=400, detail="Failure reason is required")

    db = get_database()
    oid = to_object_id(order_id, "order_id")
    order = await db.orders.find_one({"_id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("delivery_partner_id") != partner["id"]:
        raise HTTPException(status_code=403, detail="You are not assigned to this order")
    if order.get("payment_method") != PaymentMethod.COD.value:
        raise HTTPException(status_code=400, detail="COD failure workflow only applies to COD orders")
    if order.get("status") not in {OrderStatus.PICKED_UP.value, OrderStatus.OUT_FOR_DELIVERY.value}:
        raise HTTPException(status_code=400, detail="COD refusal can only be reported during active delivery")

    now = utc_now()
    gps = {"lat": lat, "lng": lng} if (lat is not None and lng is not None) else order.get("partner_location")

    incident_doc = {
        "order_id": order_id,
        "order_number": order["order_number"],
        "customer_id": order["customer_id"],
        "restaurant_id": order["restaurant_id"],
        "restaurant_name": order.get("restaurant_name", ""),
        "delivery_partner_id": partner["id"],
        "delivery_partner_name": partner["name"],
        "amount": order["total_amount"],
        "reason": reason.strip(),
        "gps_coordinates": gps,
        "attempt_timestamp": now,
        "status": OrderStatus.COD_PAYMENT_FAILED.value,
        "resolution_note": "",
        "created_at": now,
        "updated_at": now,
    }
    await db.cod_incidents.update_one(
        {"order_id": order_id},
        {"$set": incident_doc},
        upsert=True,
    )

    history_entry = {
        "status": OrderStatus.COD_PAYMENT_FAILED.value,
        "timestamp": now,
        "updated_by": partner["id"],
        "role": UserRole.DELIVERY_PARTNER.value,
        "note": f"Customer refused COD payment: {reason.strip()}",
    }
    await db.orders.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": OrderStatus.COD_PAYMENT_FAILED.value,
                "payment_status": PaymentStatus.COD_PAYMENT_FAILED.value,
                "updated_at": now,
            },
            "$push": {"status_history": history_entry},
        },
    )
    await db.payments.update_one(
        {"order_id": order_id},
        {"$set": {"status": PaymentStatus.COD_PAYMENT_FAILED.value, "updated_at": now}},
    )
    await db.delivery_assignments.update_one(
        {"order_id": order_id},
        {"$set": {"status": DeliveryAssignmentStatus.COD_PAYMENT_FAILED.value, "updated_at": now}},
    )

    # Notify restaurant manager & admin
    rest = await db.restaurants.find_one({"_id": ObjectId(order["restaurant_id"])})
    manager_id = rest.get("manager_id", "") if rest else ""
    if manager_id:
        await db.notifications.insert_one({
            "user_id": manager_id,
            "title": "COD Payment Refused",
            "message": f"Order {order['order_number']} COD refused. Rider returning order to restaurant.",
            "order_id": order_id,
            "is_read": False,
            "created_at": now,
        })

    await log_delivery_audit(
        action="COD_PAYMENT_FAILED",
        entity_type="COD_INCIDENT",
        entity_id=order_id,
        actor_id=partner["id"],
        actor_role=partner["role"],
        details={"reason": reason.strip()},
    )

    updated_order = await db.orders.find_one({"_id": oid})
    serialized = serialize_doc(updated_order)
    await ws_manager.broadcast_order_event(serialized, event_type="COD_PAYMENT_FAILED", restaurant_manager_id=manager_id)
    incident = await db.cod_incidents.find_one({"order_id": order_id})
    return {"order": serialized, "incident": serialize_doc(incident)}


async def mark_cod_return_pending(order_id: str, partner: Dict[str, Any]) -> Dict[str, Any]:
    db = get_database()
    oid = to_object_id(order_id, "order_id")
    order = await db.orders.find_one({"_id": oid, "delivery_partner_id": partner["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") != OrderStatus.COD_PAYMENT_FAILED.value:
        raise HTTPException(status_code=400, detail="Order is not in COD_PAYMENT_FAILED state")

    now = utc_now()
    await db.orders.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": OrderStatus.COD_RETURN_PENDING.value,
                "payment_status": PaymentStatus.COD_RETURN_PENDING.value,
                "updated_at": now,
            },
            "$push": {
                "status_history": {
                    "status": OrderStatus.COD_RETURN_PENDING.value,
                    "timestamp": now,
                    "updated_by": partner["id"],
                    "role": partner["role"],
                    "note": "Delivery partner returning undelivered order to restaurant",
                }
            },
        },
    )
    await db.cod_incidents.update_one(
        {"order_id": order_id},
        {"$set": {"status": OrderStatus.COD_RETURN_PENDING.value, "updated_at": now}},
    )
    await db.payments.update_one(
        {"order_id": order_id},
        {"$set": {"status": PaymentStatus.COD_RETURN_PENDING.value, "updated_at": now}},
    )
    await log_delivery_audit(
        action="COD_RETURN_PENDING",
        entity_type="COD_INCIDENT",
        entity_id=order_id,
        actor_id=partner["id"],
        actor_role=partner["role"],
    )
    updated_order = await db.orders.find_one({"_id": oid})
    return {"order": serialize_doc(updated_order)}


async def confirm_cod_order_returned(order_id: str, actor: Dict[str, Any]) -> Dict[str, Any]:
    db = get_database()
    oid = to_object_id(order_id, "order_id")
    order = await db.orders.find_one({"_id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if actor["role"] == UserRole.RESTAURANT_MANAGER.value:
        rest = await db.restaurants.find_one({"_id": ObjectId(order["restaurant_id"])})
        if not rest or rest.get("manager_id") != actor["id"]:
            raise HTTPException(status_code=403, detail="Access denied for this restaurant")

    if order.get("status") not in {OrderStatus.COD_PAYMENT_FAILED.value, OrderStatus.COD_RETURN_PENDING.value}:
        raise HTTPException(status_code=400, detail="Order is not awaiting COD return")

    now = utc_now()
    await db.orders.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": OrderStatus.COD_RETURNED.value,
                "payment_status": PaymentStatus.COD_RETURNED.value,
                "updated_at": now,
            },
            "$push": {
                "status_history": {
                    "status": OrderStatus.COD_RETURNED.value,
                    "timestamp": now,
                    "updated_by": actor["id"],
                    "role": actor["role"],
                    "note": "Restaurant confirmed receipt of returned COD order",
                }
            },
        },
    )
    await db.cod_incidents.update_one(
        {"order_id": order_id},
        {"$set": {"status": OrderStatus.COD_RETURNED.value, "returned_at": now, "updated_at": now}},
    )
    await db.payments.update_one(
        {"order_id": order_id},
        {"$set": {"status": PaymentStatus.COD_RETURNED.value, "updated_at": now}},
    )

    # Release delivery partner now that the order is returned to the restaurant
    dp_id = order.get("delivery_partner_id")
    if dp_id:
        await db.users.update_one(
            {"_id": ObjectId(dp_id)},
            {"$set": {"active_order_id": None, "delivery_status": "AVAILABLE", "updated_at": now}},
        )

    await log_delivery_audit(
        action="COD_RETURNED",
        entity_type="COD_INCIDENT",
        entity_id=order_id,
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    updated_order = await db.orders.find_one({"_id": oid})
    return {"order": serialize_doc(updated_order)}


async def list_cod_incidents() -> List[Dict[str, Any]]:
    db = get_database()
    docs = await db.cod_incidents.find({}).sort("created_at", -1).to_list(length=300)
    return serialize_docs(docs)


async def resolve_cod_incident(incident_id: str, resolution_note: str, admin_user: Dict[str, Any]) -> Dict[str, Any]:
    if not resolution_note.strip():
        raise HTTPException(status_code=400, detail="Resolution note is required")
    db = get_database()
    inc_oid = to_object_id(incident_id, "incident_id")
    incident = await db.cod_incidents.find_one({"_id": inc_oid})
    if not incident:
        raise HTTPException(status_code=404, detail="COD incident not found")

    now = utc_now()
    await db.cod_incidents.update_one(
        {"_id": inc_oid},
        {
            "$set": {
                "status": OrderStatus.COD_RESOLVED.value,
                "resolution_note": resolution_note.strip(),
                "resolved_by": admin_user["id"],
                "resolved_at": now,
                "updated_at": now,
            }
        },
    )
    order_oid = ObjectId(incident["order_id"])
    await db.orders.update_one(
        {"_id": order_oid},
        {
            "$set": {
                "status": OrderStatus.COD_RESOLVED.value,
                "payment_status": PaymentStatus.COD_RESOLVED.value,
                "updated_at": now,
            },
            "$push": {
                "status_history": {
                    "status": OrderStatus.COD_RESOLVED.value,
                    "timestamp": now,
                    "updated_by": admin_user["id"],
                    "role": admin_user["role"],
                    "note": f"Admin resolved COD incident: {resolution_note.strip()}",
                }
            },
        },
    )
    await db.payments.update_one(
        {"order_id": incident["order_id"]},
        {"$set": {"status": PaymentStatus.COD_RESOLVED.value, "updated_at": now}},
    )
    await log_delivery_audit(
        action="COD_RESOLVED",
        entity_type="COD_INCIDENT",
        entity_id=incident["order_id"],
        actor_id=admin_user["id"],
        actor_role=admin_user["role"],
        details={"resolution_note": resolution_note.strip()},
    )
    updated = await db.cod_incidents.find_one({"_id": inc_oid})
    return serialize_doc(updated)

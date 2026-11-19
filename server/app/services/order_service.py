import uuid
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status

from app.database.mongodb import get_database
from app.models.enums import (
    ALLOWED_STATUS_TRANSITIONS,
    DeliveryAssignmentStatus,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    UserRole,
)
from app.schemas.order import OrderStatusUpdateRequest, PlaceOrderRequest
from app.services.cart_service import clear_cart, compute_cart_details
from app.services.cod_settlement_service import record_cod_collection
from app.services.earnings_service import record_delivery_earnings
from app.services.websocket_manager import ws_manager
from app.utils.serializers import serialize_doc, serialize_docs, to_object_id, utc_now


async def _create_notification(user_id: str, title: str, message: str, order_id: str = "") -> None:
    if not user_id:
        return
    db = get_database()
    await db.notifications.insert_one({
        "user_id": user_id,
        "title": title,
        "message": message,
        "order_id": order_id,
        "is_read": False,
        "created_at": utc_now(),
    })


async def place_order(customer: Dict[str, Any], payload: PlaceOrderRequest) -> Dict[str, Any]:
    """Create an order from the customer's cart using authoritative DB prices."""
    db = get_database()

    if payload.idempotency_key:
        existing_order = await db.orders.find_one({
            "customer_id": customer["id"],
            "idempotency_key": payload.idempotency_key,
        })
        if existing_order:
            return serialize_doc(existing_order)

    cart = await compute_cart_details(customer["id"])
    if not cart["items"]:
        raise HTTPException(status_code=400, detail="Your cart is empty")

    unavailable = [i["name"] for i in cart["items"] if not i["is_available"]]
    if unavailable:
        raise HTTPException(
            status_code=400,
            detail=f"Some items in your cart are unavailable: {', '.join(unavailable)}",
        )

    rest_oid = to_object_id(cart["restaurant_id"], "restaurant_id")
    restaurant = await db.restaurants.find_one({"_id": rest_oid, "is_active": True})
    if not restaurant or not restaurant.get("is_open", True):
        raise HTTPException(status_code=400, detail="Restaurant is currently closed or unavailable")

    min_order = float(restaurant.get("min_order_amount", 0))
    if cart["subtotal"] < min_order:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum order amount for {restaurant['name']} is ₹{min_order:.2f}",
        )

    addr_oid = to_object_id(payload.address_id, "address_id")
    address = await db.addresses.find_one({"_id": addr_oid, "customer_id": customer["id"]})
    if not address:
        raise HTTPException(status_code=404, detail="Delivery address not found")

    now = utc_now()
    order_number = f"DD-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    initial_payment_status = (
        PaymentStatus.COD_PENDING.value
        if payload.payment_method == PaymentMethod.COD
        else PaymentStatus.PENDING.value
    )

    order_doc = {
        "order_number": order_number,
        "customer_id": customer["id"],
        "customer_name": customer["name"],
        "customer_phone": address.get("phone") or customer.get("phone", ""),
        "restaurant_id": cart["restaurant_id"],
        "restaurant_name": restaurant["name"],
        "restaurant_address": restaurant.get("address", ""),
        "restaurant_location": {
            "lat": restaurant.get("lat"),
            "lng": restaurant.get("lng"),
        } if restaurant.get("lat") is not None and restaurant.get("lng") is not None else None,
        "delivery_partner_id": None,
        "delivery_partner_name": None,
        "delivery_partner_phone": None,
        "items": [
            {
                "food_item_id": i["food_item_id"],
                "name": i["name"],
                "price": i["price"],
                "quantity": i["quantity"],
                "line_total": i["line_total"],
                "image_url": i.get("image_url", ""),
                "is_veg": i.get("is_veg", True),
            }
            for i in cart["items"]
        ],
        "subtotal": cart["subtotal"],
        "delivery_fee": cart["delivery_fee"],
        "tax_amount": cart["tax_amount"],
        "total_amount": cart["total_amount"],
        "delivery_address": {
            "id": str(address["_id"]),
            "label": address.get("label", "Home"),
            "street": address["street"],
            "landmark": address.get("landmark", ""),
            "city": address["city"],
            "state": address.get("state", ""),
            "pincode": address["pincode"],
            "phone": address.get("phone", ""),
            "lat": address.get("lat"),
            "lng": address.get("lng"),
        },
        "special_instructions": payload.special_instructions.strip(),
        "payment_method": payload.payment_method.value,
        "payment_status": initial_payment_status,
        "status": OrderStatus.PLACED.value,
        "rejection_reason": "",
        "status_history": [
            {
                "status": OrderStatus.PLACED.value,
                "timestamp": now,
                "updated_by": customer["id"],
                "role": UserRole.CUSTOMER.value,
                "note": "Order placed by customer",
            }
        ],
        "idempotency_key": payload.idempotency_key,
        "created_at": now,
        "updated_at": now,
    }

    res = await db.orders.insert_one(order_doc)
    order_doc["_id"] = res.inserted_id
    order_id = str(res.inserted_id)

    # Create payment record
    await db.payments.insert_one({
        "order_id": order_id,
        "order_number": order_number,
        "customer_id": customer["id"],
        "restaurant_id": cart["restaurant_id"],
        "amount": cart["total_amount"],
        "currency": "INR",
        "method": payload.payment_method.value,
        "status": initial_payment_status,
        "razorpay_order_id": None,
        "razorpay_payment_id": None,
        "razorpay_signature": None,
        "idempotency_key": payload.idempotency_key,
        "created_at": now,
        "updated_at": now,
    })

    await clear_cart(customer["id"])

    serialized_order = serialize_doc(order_doc)
    manager_id = restaurant.get("manager_id", "")
    await _create_notification(
        manager_id,
        "New Order Received",
        f"Order {order_number} (₹{cart['total_amount']:.2f}) has been placed.",
        order_id=order_id,
    )
    await ws_manager.broadcast_order_event(
        serialized_order,
        event_type="ORDER_PLACED",
        restaurant_manager_id=manager_id,
    )
    return serialized_order


async def list_orders_for_user(user: Dict[str, Any], status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    db = get_database()
    role = user["role"]
    query: Dict[str, Any] = {}

    if role == UserRole.CUSTOMER.value:
        query["customer_id"] = user["id"]
    elif role == UserRole.RESTAURANT_MANAGER.value:
        rests = await db.restaurants.find({"manager_id": user["id"]}).to_list(length=50)
        rest_ids = [str(r["_id"]) for r in rests]
        query["restaurant_id"] = {"$in": rest_ids}
    elif role == UserRole.DELIVERY_PARTNER.value:
        query["delivery_partner_id"] = user["id"]
    elif role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Unauthorized role")

    if status_filter:
        query["status"] = status_filter

    docs = await db.orders.find(query).sort("created_at", -1).to_list(length=200)
    return serialize_docs(docs)


async def get_order_by_id(order_id: str, user: Dict[str, Any]) -> Dict[str, Any]:
    db = get_database()
    oid = to_object_id(order_id, "order_id")
    order = await db.orders.find_one({"_id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    role = user["role"]
    if role == UserRole.CUSTOMER.value and order["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    elif role == UserRole.RESTAURANT_MANAGER.value:
        rest = await db.restaurants.find_one({"_id": ObjectId(order["restaurant_id"])})
        if not rest or rest.get("manager_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    elif role == UserRole.DELIVERY_PARTNER.value and order.get("delivery_partner_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    serialized = serialize_doc(order)
    if serialized and not serialized.get("restaurant_location") and order.get("restaurant_id"):
        rest = await db.restaurants.find_one({"_id": ObjectId(order["restaurant_id"])})
        if rest and rest.get("lat") is not None and rest.get("lng") is not None:
            serialized["restaurant_location"] = {"lat": rest["lat"], "lng": rest["lng"]}
    return serialized


async def update_order_status(
    order_id: str,
    payload: OrderStatusUpdateRequest,
    actor: Dict[str, Any],
) -> Dict[str, Any]:
    db = get_database()
    oid = to_object_id(order_id, "order_id")
    order = await db.orders.find_one({"_id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    current_status = OrderStatus(order["status"])
    target_status = payload.status
    role = UserRole(actor["role"])

    restaurant = await db.restaurants.find_one({"_id": ObjectId(order["restaurant_id"])})
    manager_id = restaurant.get("manager_id", "") if restaurant else ""

    # Role-based ownership & transition checks
    if role == UserRole.CUSTOMER:
        if order["customer_id"] != actor["id"]:
            raise HTTPException(status_code=403, detail="You can only cancel your own order")
        if target_status != OrderStatus.CANCELLED:
            raise HTTPException(status_code=403, detail="Customers can only cancel orders")
        if current_status not in {OrderStatus.PLACED, OrderStatus.CONFIRMED}:
            raise HTTPException(status_code=400, detail="Order can no longer be cancelled at this stage")

    elif role == UserRole.RESTAURANT_MANAGER:
        if not restaurant or manager_id != actor["id"]:
            raise HTTPException(status_code=403, detail="You can only manage orders for your assigned restaurant")
        allowed_mgr_targets = {
            OrderStatus.CONFIRMED,
            OrderStatus.REJECTED,
            OrderStatus.PREPARING,
            OrderStatus.READY_FOR_PICKUP,
        }
        if target_status not in allowed_mgr_targets:
            raise HTTPException(status_code=403, detail=f"Restaurant managers cannot set status to {target_status.value}")
        if target_status not in ALLOWED_STATUS_TRANSITIONS.get(current_status, set()):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition from {current_status.value} to {target_status.value}",
            )
        if target_status == OrderStatus.REJECTED and not (payload.reason and payload.reason.strip()):
            raise HTTPException(status_code=400, detail="A rejection reason is required when rejecting an order")

    elif role == UserRole.DELIVERY_PARTNER:
        if order.get("delivery_partner_id") != actor["id"]:
            raise HTTPException(status_code=403, detail="You can only update orders assigned to you")
        allowed_dp_targets = {
            OrderStatus.REACHED_RESTAURANT,
            OrderStatus.PICKED_UP,
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.REACHED_CUSTOMER,
            OrderStatus.DELIVERED,
        }
        if target_status not in allowed_dp_targets:
            raise HTTPException(status_code=403, detail=f"Delivery partners cannot set status to {target_status.value}")
        if target_status not in ALLOWED_STATUS_TRANSITIONS.get(current_status, set()):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition from {current_status.value} to {target_status.value}",
            )
        if target_status == OrderStatus.DELIVERED and order.get("payment_method") == PaymentMethod.COD.value:
            if payload.cod_collected is not True:
                raise HTTPException(
                    status_code=400,
                    detail="You must confirm full COD cash collection before marking a COD order as DELIVERED",
                )

    elif role == UserRole.ADMIN:
        if current_status in {OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REJECTED}:
            raise HTTPException(status_code=400, detail="Completed or closed orders cannot be modified")

    now = utc_now()
    history_entry = {
        "status": target_status.value,
        "timestamp": now,
        "updated_by": actor["id"],
        "role": actor["role"],
        "note": payload.reason.strip() if payload.reason else f"Status updated to {target_status.value}",
    }

    updates: Dict[str, Any] = {
        "status": target_status.value,
        "updated_at": now,
    }
    if target_status in {
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.REJECTED,
        OrderStatus.DELIVERY_REFUSED,
    }:
        updates["partner_gps_status"] = "STOPPED"
    if target_status == OrderStatus.REJECTED and payload.reason:
        updates["rejection_reason"] = payload.reason.strip()

    # If COD order is delivered, mark COD as collected
    if target_status == OrderStatus.DELIVERED and order.get("payment_method") == PaymentMethod.COD.value:
        updates["payment_status"] = PaymentStatus.COD_COLLECTED.value
        await db.payments.update_one(
            {"order_id": order_id},
            {"$set": {"status": PaymentStatus.COD_COLLECTED.value, "updated_at": now}},
        )

    await db.orders.update_one(
        {"_id": oid},
        {"$set": updates, "$push": {"status_history": history_entry}},
    )

    # Ensure an AVAILABLE delivery assignment exists whenever an unassigned order is READY_FOR_PICKUP
    if target_status == OrderStatus.READY_FOR_PICKUP and not order.get("delivery_partner_id"):
        await db.delivery_assignments.update_one(
            {"order_id": order_id},
            {
                "$set": {
                    "order_id": order_id,
                    "order_number": order["order_number"],
                    "restaurant_id": order["restaurant_id"],
                    "restaurant_name": order["restaurant_name"],
                    "restaurant_address": order.get("restaurant_address", ""),
                    "delivery_address": order["delivery_address"],
                    "total_amount": order["total_amount"],
                    "payment_method": order["payment_method"],
                    "delivery_partner_id": None,
                    "status": DeliveryAssignmentStatus.AVAILABLE.value,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "created_at": now,
                },
            },
            upsert=True,
        )

    # Sync delivery_assignments status for pickup / out_for_delivery / delivered / cancelled
    if target_status in {
        OrderStatus.PICKED_UP,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
    }:
        await db.delivery_assignments.update_one(
            {"order_id": order_id},
            {"$set": {"status": target_status.value, "updated_at": now}},
        )

    # Release delivery partner & record immutable km-based earnings when delivered
    dp_id = order.get("delivery_partner_id")
    if dp_id and target_status in {OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REJECTED}:
        await db.users.update_one(
            {"_id": ObjectId(dp_id)},
            {"$set": {"active_order_id": None, "delivery_status": "AVAILABLE", "updated_at": now}},
        )

    updated_order = await db.orders.find_one({"_id": oid})
    if dp_id and target_status == OrderStatus.DELIVERED and updated_order:
        await record_delivery_earnings(updated_order)
        if updated_order.get("payment_method") == PaymentMethod.COD.value and payload.cod_collected is True:
            await record_cod_collection(updated_order, actor)
    serialized = serialize_doc(updated_order)

    await _create_notification(
        order["customer_id"],
        f"Order {order['order_number']} {target_status.value.replace('_', ' ').title()}",
        history_entry["note"],
        order_id=order_id,
    )
    await ws_manager.broadcast_order_event(
        serialized,
        event_type="ORDER_STATUS_UPDATED",
        restaurant_manager_id=manager_id,
    )
    return serialized

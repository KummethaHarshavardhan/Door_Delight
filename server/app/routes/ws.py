from bson import ObjectId
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.database.mongodb import get_database
from app.models.enums import UserRole
from app.services.websocket_manager import ws_manager
from app.utils.security import decode_access_token

router = APIRouter(tags=["WebSockets"])


async def _authenticate_ws(token: str):
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload or not payload.get("sub") or not ObjectId.is_valid(payload["sub"]):
        return None
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(payload["sub"]), "is_active": True})
    return user


@router.websocket("/ws/orders/{order_id}")
async def order_ws(
    websocket: WebSocket,
    order_id: str,
    token: str = Query(default=""),
):
    """Real-time WebSocket for tracking a specific order with strict RBAC validation."""
    user = await _authenticate_ws(token)
    if not user or not ObjectId.is_valid(order_id):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db = get_database()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    uid = str(user["_id"])
    role = user.get("role")
    authorized = False

    if role == UserRole.ADMIN.value:
        authorized = True
    elif role == UserRole.CUSTOMER.value and order.get("customer_id") == uid:
        authorized = True
    elif role == UserRole.DELIVERY_PARTNER.value and order.get("delivery_partner_id") == uid:
        authorized = True
    elif role == UserRole.RESTAURANT_MANAGER.value:
        rest = await db.restaurants.find_one({"_id": ObjectId(order["restaurant_id"])})
        if rest and rest.get("manager_id") == uid:
            authorized = True

    if not authorized:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws_manager.connect_order(order_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, order_id=order_id)


@router.websocket("/ws/feed")
async def user_feed_ws(
    websocket: WebSocket,
    token: str = Query(default=""),
):
    """Role-scoped real-time feed for dashboard order notifications & updates."""
    user = await _authenticate_ws(token)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    uid = str(user["_id"])
    role = user.get("role", "")
    await ws_manager.connect_user_feed(uid, role, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id=uid)

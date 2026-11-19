import logging
from typing import Any, Dict, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class OrderConnectionManager:
    """Manages authenticated WebSocket connections for real-time order updates."""

    def __init__(self) -> None:
        self.order_rooms: Dict[str, Set[WebSocket]] = {}
        self.user_rooms: Dict[str, Set[WebSocket]] = {}
        self.admin_sockets: Set[WebSocket] = set()
        self.delivery_pool_sockets: Set[WebSocket] = set()

    async def connect_order(self, order_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.order_rooms.setdefault(order_id, set()).add(websocket)

    async def connect_user_feed(self, user_id: str, role: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.user_rooms.setdefault(user_id, set()).add(websocket)
        if role == "ADMIN":
            self.admin_sockets.add(websocket)
        elif role == "DELIVERY_PARTNER":
            self.delivery_pool_sockets.add(websocket)

    def disconnect(self, websocket: WebSocket, order_id: str | None = None, user_id: str | None = None) -> None:
        if order_id and order_id in self.order_rooms:
            self.order_rooms[order_id].discard(websocket)
            if not self.order_rooms[order_id]:
                self.order_rooms.pop(order_id, None)
        if user_id and user_id in self.user_rooms:
            self.user_rooms[user_id].discard(websocket)
            if not self.user_rooms[user_id]:
                self.user_rooms.pop(user_id, None)
        self.admin_sockets.discard(websocket)
        self.delivery_pool_sockets.discard(websocket)

    async def _send_safe(self, sockets: Set[WebSocket], payload: Dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in list(sockets):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            sockets.discard(ws)

    async def broadcast_order_event(
        self,
        order: Dict[str, Any],
        event_type: str = "ORDER_UPDATED",
        restaurant_manager_id: str | None = None,
    ) -> None:
        """Broadcast order updates to authorized subscribers only."""
        payload = {"event": event_type, "order": order}
        order_id = order.get("id")
        if order_id and order_id in self.order_rooms:
            await self._send_safe(self.order_rooms[order_id], payload)

        # Notify customer
        cust_id = order.get("customer_id")
        if cust_id and cust_id in self.user_rooms:
            await self._send_safe(self.user_rooms[cust_id], payload)

        # Notify restaurant manager
        if restaurant_manager_id and restaurant_manager_id in self.user_rooms:
            await self._send_safe(self.user_rooms[restaurant_manager_id], payload)

        # Notify assigned delivery partner
        dp_id = order.get("delivery_partner_id")
        if dp_id and dp_id in self.user_rooms:
            await self._send_safe(self.user_rooms[dp_id], payload)

        # Notify admins
        if self.admin_sockets:
            await self._send_safe(self.admin_sockets, payload)

        # Notify delivery partner pool when an order becomes READY_FOR_PICKUP or is claimed
        if (order.get("status") == "READY_FOR_PICKUP" or event_type == "DELIVERY_ASSIGNED") and self.delivery_pool_sockets:
            await self._send_safe(self.delivery_pool_sockets, payload)


ws_manager = OrderConnectionManager()

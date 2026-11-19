from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, status

from app.middleware.auth import get_current_user, require_roles
from app.models.enums import UserRole
from app.schemas.order import OrderStatusUpdateRequest, PlaceOrderRequest
from app.services.order_service import (
    get_order_by_id,
    list_orders_for_user,
    place_order,
    update_order_status,
)

router = APIRouter(prefix="/api/orders", tags=["Orders"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: PlaceOrderRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    order = await place_order(current_user, payload)
    return {"order": order}


@router.get("")
async def get_orders(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    orders = await list_orders_for_user(current_user, status_filter=status_filter)
    return {"orders": orders}


@router.get("/{order_id}")
async def get_order(
    order_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    order = await get_order_by_id(order_id, current_user)
    return {"order": order}


@router.put("/{order_id}/status")
async def change_order_status(
    order_id: str,
    payload: OrderStatusUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    order = await update_order_status(order_id, payload, current_user)
    return {"order": order}

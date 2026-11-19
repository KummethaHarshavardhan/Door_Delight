from typing import Any, Dict
from fastapi import APIRouter, Depends, status

from app.middleware.auth import require_roles
from app.models.enums import UserRole
from app.schemas.customer import CartAddItemRequest, CartUpdateItemRequest
from app.services.cart_service import (
    add_item_to_cart,
    clear_cart,
    compute_cart_details,
    remove_cart_item,
    update_cart_item,
)

router = APIRouter(prefix="/api/cart", tags=["Cart"])


@router.get("")
async def get_cart(
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    cart = await compute_cart_details(current_user["id"])
    return {"cart": cart}


@router.post("/items", status_code=status.HTTP_201_CREATED)
async def add_to_cart(
    payload: CartAddItemRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    cart = await add_item_to_cart(current_user["id"], payload)
    return {"cart": cart}


@router.put("/items/{item_id}")
async def update_item(
    item_id: str,
    payload: CartUpdateItemRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    cart = await update_cart_item(current_user["id"], item_id, payload)
    return {"cart": cart}


@router.delete("/items/{item_id}")
async def delete_item(
    item_id: str,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    cart = await remove_cart_item(current_user["id"], item_id)
    return {"cart": cart}


@router.delete("")
async def empty_cart(
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, str]:
    await clear_cart(current_user["id"])
    return {"message": "Cart cleared"}

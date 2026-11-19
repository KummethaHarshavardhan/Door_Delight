from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, status

from app.middleware.auth import require_roles
from app.models.enums import UserRole
from app.schemas.catalog import FoodItemCreateRequest, FoodItemUpdateRequest
from app.services.catalog_service import (
    create_food_item,
    delete_food_item,
    get_food_by_id,
    list_foods,
    list_reviews_for_food,
    update_food_item,
)

router = APIRouter(prefix="/api/foods", tags=["Food Items"])


@router.get("")
async def get_foods(
    restaurant_id: Optional[str] = Query(default=None),
    category_id: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    is_veg: Optional[bool] = Query(default=None),
    available_only: bool = Query(default=True),
    popular_only: bool = Query(default=False),
) -> Dict[str, Any]:
    foods = await list_foods(
        restaurant_id=restaurant_id,
        category_id=category_id,
        search=search,
        min_price=min_price,
        max_price=max_price,
        is_veg=is_veg,
        available_only=available_only,
        popular_only=popular_only,
    )
    return {"foods": foods}


@router.get("/{food_id}")
async def get_food(food_id: str) -> Dict[str, Any]:
    food = await get_food_by_id(food_id)
    reviews = await list_reviews_for_food(food_id)
    return {"food": food, "reviews": reviews}


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_food(
    payload: FoodItemCreateRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN, UserRole.RESTAURANT_MANAGER)),
) -> Dict[str, Any]:
    food = await create_food_item(payload, current_user)
    return {"food": food}


@router.put("/{food_id}")
async def edit_food(
    food_id: str,
    payload: FoodItemUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN, UserRole.RESTAURANT_MANAGER)),
) -> Dict[str, Any]:
    food = await update_food_item(food_id, payload, current_user)
    return {"food": food}


@router.delete("/{food_id}")
async def remove_food(
    food_id: str,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN, UserRole.RESTAURANT_MANAGER)),
) -> Dict[str, str]:
    await delete_food_item(food_id, current_user)
    return {"message": "Food item deleted successfully"}

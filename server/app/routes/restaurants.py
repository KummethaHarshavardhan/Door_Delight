from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, status

from app.middleware.auth import require_roles
from app.models.enums import UserRole
from app.schemas.catalog import RestaurantCreateRequest, RestaurantUpdateRequest
from app.services.catalog_service import (
    create_restaurant,
    delete_restaurant,
    get_restaurant_by_id,
    list_foods,
    list_restaurants,
    update_restaurant,
)

router = APIRouter(prefix="/api/restaurants", tags=["Restaurants"])


@router.get("")
async def get_restaurants(
    search: Optional[str] = Query(default=None),
    cuisine: Optional[str] = Query(default=None),
    is_open: Optional[bool] = Query(default=None),
    featured_only: bool = Query(default=False),
) -> Dict[str, Any]:
    restaurants = await list_restaurants(
        search=search,
        cuisine=cuisine,
        is_open=is_open,
        featured_only=featured_only,
    )
    return {"restaurants": restaurants}


@router.get("/{restaurant_id}")
async def get_restaurant(restaurant_id: str) -> Dict[str, Any]:
    restaurant = await get_restaurant_by_id(restaurant_id)
    menu = await list_foods(restaurant_id=restaurant_id, available_only=False)
    return {"restaurant": restaurant, "menu": menu}


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_restaurant(
    payload: RestaurantCreateRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN, UserRole.RESTAURANT_MANAGER)),
) -> Dict[str, Any]:
    restaurant = await create_restaurant(payload, current_user)
    return {"restaurant": restaurant}


@router.put("/{restaurant_id}")
async def edit_restaurant(
    restaurant_id: str,
    payload: RestaurantUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN, UserRole.RESTAURANT_MANAGER)),
) -> Dict[str, Any]:
    restaurant = await update_restaurant(restaurant_id, payload, current_user)
    return {"restaurant": restaurant}


@router.delete("/{restaurant_id}")
async def remove_restaurant(
    restaurant_id: str,
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, str]:
    await delete_restaurant(restaurant_id)
    return {"message": "Restaurant deactivated successfully"}

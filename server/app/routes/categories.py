from typing import Any, Dict, List
from fastapi import APIRouter, Depends, status

from app.middleware.auth import require_roles
from app.models.enums import UserRole
from app.schemas.catalog import CategoryCreateRequest, CategoryUpdateRequest
from app.services.catalog_service import create_category, list_categories, update_category

router = APIRouter(prefix="/api/categories", tags=["Food Categories"])


@router.get("")
async def get_categories(active_only: bool = True) -> Dict[str, List[Dict[str, Any]]]:
    categories = await list_categories(active_only=active_only)
    return {"categories": categories}


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_category(
    payload: CategoryCreateRequest,
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN, UserRole.RESTAURANT_MANAGER)),
) -> Dict[str, Any]:
    category = await create_category(payload)
    return {"category": category}


@router.put("/{category_id}")
async def edit_category(
    category_id: str,
    payload: CategoryUpdateRequest,
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN, UserRole.RESTAURANT_MANAGER)),
) -> Dict[str, Any]:
    category = await update_category(category_id, payload)
    return {"category": category}

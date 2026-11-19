from typing import Any, Dict
from fastapi import APIRouter, Depends, status

from app.middleware.auth import require_roles
from app.models.enums import UserRole
from app.schemas.catalog import ReviewCreateRequest
from app.services.catalog_service import create_review, list_reviews_for_food

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_review(
    payload: ReviewCreateRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    review = await create_review(payload, current_user)
    return {"review": review}


@router.get("/food/{food_id}")
async def get_food_reviews(food_id: str) -> Dict[str, Any]:
    reviews = await list_reviews_for_food(food_id)
    return {"reviews": reviews}

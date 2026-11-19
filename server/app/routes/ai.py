from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.ai.analytics import admin_analytics_assistant
from app.ai.chatbot import customer_chatbot_reply
from app.ai.recommendations import get_ai_food_recommendations
from app.middleware.auth import require_roles
from app.middleware.rate_limit import limiter
from app.models.enums import UserRole

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)


class RecommendationRequest(BaseModel):
    max_price: Optional[float] = Field(default=None, gt=0, le=50000)
    is_veg: Optional[bool] = None
    preference_note: str = Field(default="", max_length=300)


class AdminAnalyticsQueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)


@router.post("/chat")
@limiter.limit("20/minute")
async def ai_chat(
    request: Request,
    payload: ChatRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    return await customer_chatbot_reply(current_user, payload.message)


@router.post("/recommendations")
@limiter.limit("20/minute")
async def ai_recommendations(
    request: Request,
    payload: RecommendationRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    return await get_ai_food_recommendations(
        current_user,
        max_price=payload.max_price,
        is_veg=payload.is_veg,
        preference_note=payload.preference_note,
    )


@router.post("/admin-analytics")
@limiter.limit("20/minute")
async def ai_admin_analytics(
    request: Request,
    payload: AdminAnalyticsQueryRequest,
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    return await admin_analytics_assistant(payload.question)

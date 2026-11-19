from typing import Any, Dict
from fastapi import APIRouter, Depends, Request, status

from app.middleware.auth import get_current_user
from app.middleware.rate_limit import limiter
from app.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    RegisterRequest,
)
from app.services.auth_service import (
    authenticate_user,
    change_user_password,
    register_user,
    update_user_profile,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(request: Request, payload: RegisterRequest) -> Dict[str, Any]:
    """Register a new customer, restaurant manager, or delivery partner."""
    return await register_user(payload)


@router.post("/login")
@limiter.limit("15/minute")
async def login(request: Request, payload: LoginRequest) -> Dict[str, Any]:
    """Authenticate user and return JWT access token."""
    return await authenticate_user(payload)


@router.get("/me")
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Get the currently authenticated user's profile."""
    return {"user": current_user}


@router.put("/profile")
async def update_profile(
    payload: ProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Update the currently authenticated user's profile."""
    updated = await update_user_profile(current_user["id"], payload)
    return {"user": updated}


@router.put("/password")
async def change_password(
    payload: PasswordChangeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    """Change the currently authenticated user's password."""
    await change_user_password(current_user["id"], payload)
    return {"message": "Password updated successfully"}

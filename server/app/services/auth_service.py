from typing import Any, Dict
from bson import ObjectId
from fastapi import HTTPException, status

from app.database.mongodb import get_database
from app.models.enums import UserRole
from app.schemas.auth import LoginRequest, PasswordChangeRequest, ProfileUpdateRequest, RegisterRequest
from app.utils.security import create_access_token, hash_password, verify_password
from app.utils.serializers import serialize_doc, utc_now


async def register_user(payload: RegisterRequest) -> Dict[str, Any]:
    """Register a new user (CUSTOMER, RESTAURANT_MANAGER, or DELIVERY_PARTNER)."""
    db = get_database()
    email_lower = payload.email.strip().lower()

    existing = await db.users.find_one({"email": email_lower})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    now = utc_now()
    user_doc = {
        "name": payload.name.strip(),
        "email": email_lower,
        "password_hash": hash_password(payload.password),
        "phone": payload.phone.strip() if payload.phone else "",
        "role": UserRole.CUSTOMER.value,
        "is_active": True,
        "avatar_url": "",
        "dietary_preferences": [],
        "vehicle_number": "",
        "is_available_for_delivery": False,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    user_data = serialize_doc(user_doc, exclude=["password_hash"])
    token = create_access_token(
        subject=user_data["id"],
        role=user_data["role"],
        extra_claims={"email": user_data["email"], "name": user_data["name"]},
    )
    return {"access_token": token, "token_type": "bearer", "user": user_data}


async def authenticate_user(payload: LoginRequest) -> Dict[str, Any]:
    """Authenticate user credentials and issue JWT access token."""
    db = get_database()
    email_lower = payload.email.strip().lower()
    user = await db.users.find_one({"email": email_lower})

    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact support.",
        )

    user_data = serialize_doc(user, exclude=["password_hash"])
    token = create_access_token(
        subject=user_data["id"],
        role=user_data["role"],
        extra_claims={"email": user_data["email"], "name": user_data["name"]},
    )
    return {"access_token": token, "token_type": "bearer", "user": user_data}


async def update_user_profile(user_id: str, payload: ProfileUpdateRequest) -> Dict[str, Any]:
    """Update authenticated user's profile fields."""
    db = get_database()
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        return serialize_doc(user, exclude=["password_hash"])

    updates["updated_at"] = utc_now()
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    updated = await db.users.find_one({"_id": ObjectId(user_id)})
    return serialize_doc(updated, exclude=["password_hash"])


async def change_user_password(user_id: str, payload: PasswordChangeRequest) -> None:
    """Verify current password and update to a new hashed password."""
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or not verify_password(payload.current_password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": utc_now()}},
    )

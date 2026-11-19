from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models.enums import UserRole


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    phone: Optional[str] = Field(default=None, max_length=20)
    role: UserRole = Field(default=UserRole.CUSTOMER)

    @field_validator("role")
    @classmethod
    def enforce_customer_only_register(cls, v: UserRole) -> UserRole:
        if v != UserRole.CUSTOMER:
            raise ValueError("Public registration is restricted to CUSTOMER accounts only")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    dietary_preferences: Optional[list[str]] = None
    vehicle_number: Optional[str] = Field(default=None, max_length=40)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)

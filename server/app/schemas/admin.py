from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.models.enums import UserRole


class AdminCreateUserRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    phone: str = Field(default="", max_length=20)
    role: UserRole
    is_active: bool = True


class AdminUpdateUserRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

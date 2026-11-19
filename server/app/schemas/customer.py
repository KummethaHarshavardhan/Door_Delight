from typing import Optional
from pydantic import BaseModel, Field


class CartAddItemRequest(BaseModel):
    food_item_id: str
    quantity: int = Field(default=1, ge=1, le=50)
    replace_cart: bool = False


class CartUpdateItemRequest(BaseModel):
    quantity: int = Field(..., ge=0, le=50)


class AddressCreateRequest(BaseModel):
    label: str = Field(default="Home", min_length=1, max_length=40)
    street: str = Field(..., min_length=4, max_length=250)
    landmark: str = Field(default="", max_length=120)
    city: str = Field(..., min_length=2, max_length=80)
    state: str = Field(default="", max_length=80)
    pincode: str = Field(..., min_length=4, max_length=12)
    phone: str = Field(default="", max_length=20)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    is_default: bool = False


class AddressUpdateRequest(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=40)
    street: Optional[str] = Field(default=None, min_length=4, max_length=250)
    landmark: Optional[str] = Field(default=None, max_length=120)
    city: Optional[str] = Field(default=None, min_length=2, max_length=80)
    state: Optional[str] = Field(default=None, max_length=80)
    pincode: Optional[str] = Field(default=None, min_length=4, max_length=12)
    phone: Optional[str] = Field(default=None, max_length=20)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    is_default: Optional[bool] = None

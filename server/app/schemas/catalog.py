from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class CategoryCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=60)
    slug: Optional[str] = Field(default=None, max_length=80)
    icon: str = Field(default="Utensils", max_length=40)
    description: str = Field(default="", max_length=250)


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=60)
    icon: Optional[str] = Field(default=None, max_length=40)
    description: Optional[str] = Field(default=None, max_length=250)
    is_active: Optional[bool] = None


class RestaurantCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: str = Field(default="", max_length=1000)
    cuisine: List[str] = Field(default_factory=list)
    address: str = Field(..., min_length=5, max_length=300)
    city: str = Field(default="Bengaluru", max_length=80)
    phone: str = Field(default="", max_length=20)
    upi_id: str = Field(default="", max_length=120)
    image_url: str = Field(default="", max_length=500)
    opening_hours: Dict[str, str] = Field(
        default_factory=lambda: {"open": "09:00", "close": "23:00"}
    )
    delivery_time_mins: int = Field(default=30, ge=5, le=180)
    delivery_fee: float = Field(default=35.0, ge=0, le=500)
    min_order_amount: float = Field(default=99.0, ge=0, le=5000)
    is_open: bool = True
    is_featured: bool = False
    manager_id: Optional[str] = None


class RestaurantUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=1000)
    cuisine: Optional[List[str]] = None
    address: Optional[str] = Field(default=None, min_length=5, max_length=300)
    city: Optional[str] = Field(default=None, max_length=80)
    phone: Optional[str] = Field(default=None, max_length=20)
    upi_id: Optional[str] = Field(default=None, max_length=120)
    image_url: Optional[str] = Field(default=None, max_length=500)
    opening_hours: Optional[Dict[str, str]] = None
    delivery_time_mins: Optional[int] = Field(default=None, ge=5, le=180)
    delivery_fee: Optional[float] = Field(default=None, ge=0, le=500)
    min_order_amount: Optional[float] = Field(default=None, ge=0, le=5000)
    is_open: Optional[bool] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    manager_id: Optional[str] = None


class FoodItemCreateRequest(BaseModel):
    restaurant_id: Optional[str] = None
    category_id: str
    name: str = Field(..., min_length=2, max_length=120)
    description: str = Field(default="", max_length=600)
    price: float = Field(..., gt=0, le=50000)
    discount_percent: float = Field(default=0.0, ge=0, le=90)
    image_url: str = Field(default="", max_length=500)
    is_veg: bool = True
    is_available: bool = True
    is_popular: bool = False
    prep_time_mins: int = Field(default=20, ge=1, le=180)
    tags: List[str] = Field(default_factory=list)


class FoodItemUpdateRequest(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=600)
    price: Optional[float] = Field(default=None, gt=0, le=50000)
    discount_percent: Optional[float] = Field(default=None, ge=0, le=90)
    image_url: Optional[str] = Field(default=None, max_length=500)
    is_veg: Optional[bool] = None
    is_available: Optional[bool] = None
    is_popular: Optional[bool] = None
    prep_time_mins: Optional[int] = Field(default=None, ge=1, le=180)
    tags: Optional[List[str]] = None


class ReviewCreateRequest(BaseModel):
    order_id: str
    food_item_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field(default="", max_length=500)

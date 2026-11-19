from typing import Optional
from pydantic import BaseModel, Field
from app.models.enums import OrderStatus, PaymentMethod


class PlaceOrderRequest(BaseModel):
    address_id: str
    payment_method: PaymentMethod = PaymentMethod.COD
    special_instructions: str = Field(default="", max_length=300)
    idempotency_key: Optional[str] = Field(default=None, max_length=120)


class OrderStatusUpdateRequest(BaseModel):
    status: OrderStatus
    reason: Optional[str] = Field(default=None, max_length=300)
    cod_collected: Optional[bool] = None

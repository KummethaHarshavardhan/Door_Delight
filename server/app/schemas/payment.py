from typing import Optional
from pydantic import BaseModel, Field


class RazorpayCreateOrderRequest(BaseModel):
    order_id: str
    idempotency_key: Optional[str] = Field(default=None, max_length=120)


class RazorpayVerifyRequest(BaseModel):
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class RazorpayFailureRequest(BaseModel):
    order_id: str
    razorpay_order_id: Optional[str] = None
    reason: str = Field(default="Payment failed or cancelled by user", max_length=300)

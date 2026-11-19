from typing import Any, Dict
from fastapi import APIRouter, Depends, Header, Request

from app.middleware.auth import require_roles
from app.models.enums import UserRole
from app.schemas.payment import (
    RazorpayCreateOrderRequest,
    RazorpayFailureRequest,
    RazorpayVerifyRequest,
)
from app.services.payment_service import (
    create_razorpay_order,
    handle_razorpay_webhook,
    record_razorpay_failure,
    verify_razorpay_payment,
)

router = APIRouter(prefix="/api/payments", tags=["Payments"])


@router.post("/razorpay/create")
async def razorpay_create_order(
    payload: RazorpayCreateOrderRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    return await create_razorpay_order(current_user["id"], payload)


@router.post("/razorpay/verify")
async def razorpay_verify(
    payload: RazorpayVerifyRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    return await verify_razorpay_payment(current_user["id"], payload)


@router.post("/razorpay/fail")
async def razorpay_fail(
    payload: RazorpayFailureRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    return await record_razorpay_failure(current_user["id"], payload)


@router.post("/razorpay/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(default=""),
) -> Dict[str, str]:
    raw_body = await request.body()
    return await handle_razorpay_webhook(raw_body, x_razorpay_signature)

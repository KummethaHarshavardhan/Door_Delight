import hashlib
import hmac
import json
import logging
from typing import Any, Dict
import razorpay
from bson import ObjectId
from fastapi import HTTPException, status

from app.config.settings import get_settings
from app.database.mongodb import get_database
from app.models.enums import PaymentStatus
from app.schemas.payment import (
    RazorpayCreateOrderRequest,
    RazorpayFailureRequest,
    RazorpayVerifyRequest,
)
from app.utils.serializers import serialize_doc, to_object_id, utc_now

logger = logging.getLogger(__name__)


def _get_razorpay_client() -> razorpay.Client:
    settings = get_settings()
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server .env.",
        )
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


async def create_razorpay_order(customer_id: str, payload: RazorpayCreateOrderRequest) -> Dict[str, Any]:
    db = get_database()
    settings = get_settings()
    order_oid = to_object_id(payload.order_id, "order_id")

    order = await db.orders.find_one({"_id": order_oid, "customer_id": customer_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.get("payment_status") == PaymentStatus.PAID.value:
        raise HTTPException(status_code=400, detail="Order is already paid")

    existing_payment = await db.payments.find_one({"order_id": payload.order_id})
    if existing_payment and existing_payment.get("razorpay_order_id") and existing_payment.get("status") == PaymentStatus.PENDING.value:
        return {
            "razorpay_order_id": existing_payment["razorpay_order_id"],
            "amount": int(round(float(order["total_amount"]) * 100)),
            "currency": "INR",
            "key_id": settings.RAZORPAY_KEY_ID,
            "order_number": order["order_number"],
        }

    client = _get_razorpay_client()
    amount_paise = int(round(float(order["total_amount"]) * 100))

    try:
        rzp_order = client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": order["order_number"],
            "notes": {"order_id": payload.order_id, "customer_id": customer_id},
        })
    except Exception as exc:
        logger.error("Razorpay order creation failed: %s", str(exc))
        raise HTTPException(status_code=502, detail="Failed to initiate Razorpay payment order")

    now = utc_now()
    await db.payments.update_one(
        {"order_id": payload.order_id},
        {
            "$set": {
                "razorpay_order_id": rzp_order["id"],
                "status": PaymentStatus.PENDING.value,
                "updated_at": now,
            }
        },
    )

    return {
        "razorpay_order_id": rzp_order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "key_id": settings.RAZORPAY_KEY_ID,
        "order_number": order["order_number"],
    }


async def verify_razorpay_payment(customer_id: str, payload: RazorpayVerifyRequest) -> Dict[str, Any]:
    db = get_database()
    settings = get_settings()
    if not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=503, detail="Razorpay secret is not configured")

    order_oid = to_object_id(payload.order_id, "order_id")
    order = await db.orders.find_one({"_id": order_oid, "customer_id": customer_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payment = await db.payments.find_one({"order_id": payload.order_id})
    if payment and payment.get("status") == PaymentStatus.PAID.value:
        return {"verified": True, "payment": serialize_doc(payment)}

    if not payment or payment.get("razorpay_order_id") != payload.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Razorpay order ID mismatch")

    message = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode("utf-8")
    expected_signature = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, payload.razorpay_signature):
        await db.payments.update_one(
            {"order_id": payload.order_id},
            {"$set": {"status": PaymentStatus.FAILED.value, "updated_at": utc_now()}},
        )
        await db.orders.update_one(
            {"_id": order_oid},
            {"$set": {"payment_status": PaymentStatus.FAILED.value, "updated_at": utc_now()}},
        )
        raise HTTPException(status_code=400, detail="Invalid Razorpay payment signature")

    now = utc_now()
    await db.payments.update_one(
        {"order_id": payload.order_id},
        {
            "$set": {
                "status": PaymentStatus.PAID.value,
                "razorpay_payment_id": payload.razorpay_payment_id,
                "razorpay_signature": payload.razorpay_signature,
                "updated_at": now,
            }
        },
    )
    await db.orders.update_one(
        {"_id": order_oid},
        {"$set": {"payment_status": PaymentStatus.PAID.value, "updated_at": now}},
    )

    updated_payment = await db.payments.find_one({"order_id": payload.order_id})
    return {"verified": True, "payment": serialize_doc(updated_payment)}


async def record_razorpay_failure(customer_id: str, payload: RazorpayFailureRequest) -> Dict[str, Any]:
    db = get_database()
    order_oid = to_object_id(payload.order_id, "order_id")
    order = await db.orders.find_one({"_id": order_oid, "customer_id": customer_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    now = utc_now()
    await db.payments.update_one(
        {"order_id": payload.order_id},
        {"$set": {"status": PaymentStatus.FAILED.value, "failure_reason": payload.reason, "updated_at": now}},
    )
    await db.orders.update_one(
        {"_id": order_oid},
        {"$set": {"payment_status": PaymentStatus.FAILED.value, "updated_at": now}},
    )
    payment = await db.payments.find_one({"order_id": payload.order_id})
    return {"payment": serialize_doc(payment)}


async def handle_razorpay_webhook(raw_body: bytes, signature: str) -> Dict[str, str]:
    settings = get_settings()
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="RAZORPAY_WEBHOOK_SECRET is not configured")

    expected = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature or ""):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event = json.loads(raw_body.decode("utf-8"))
    event_name = event.get("event", "")
    db = get_database()
    now = utc_now()

    payment_entity = event.get("payload", {}).get("payment", {}).get("entity", {})
    rzp_order_id = payment_entity.get("order_id")
    rzp_payment_id = payment_entity.get("id")

    if rzp_order_id:
        payment = await db.payments.find_one({"razorpay_order_id": rzp_order_id})
        if payment:
            if event_name == "payment.captured" and payment.get("status") != PaymentStatus.PAID.value:
                await db.payments.update_one(
                    {"_id": payment["_id"]},
                    {"$set": {"status": PaymentStatus.PAID.value, "razorpay_payment_id": rzp_payment_id, "updated_at": now}},
                )
                await db.orders.update_one(
                    {"_id": ObjectId(payment["order_id"])},
                    {"$set": {"payment_status": PaymentStatus.PAID.value, "updated_at": now}},
                )
            elif event_name == "payment.failed":
                await db.payments.update_one(
                    {"_id": payment["_id"]},
                    {"$set": {"status": PaymentStatus.FAILED.value, "updated_at": now}},
                )
                await db.orders.update_one(
                    {"_id": ObjectId(payment["order_id"])},
                    {"$set": {"payment_status": PaymentStatus.FAILED.value, "updated_at": now}},
                )

    return {"status": "processed"}

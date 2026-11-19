import json
import logging
from typing import Any, Dict
from fastapi import HTTPException

from app.ai.gemini_client import GeminiServiceError, generate_gemini_response
from app.database.mongodb import get_database
from app.utils.serializers import serialize_docs

logger = logging.getLogger(__name__)


async def customer_chatbot_reply(customer: Dict[str, Any], message: str) -> Dict[str, Any]:
    """Answer customer questions using verified MongoDB catalog and the customer's own orders."""
    clean_msg = message.strip()
    if not clean_msg or len(clean_msg) > 1000:
        raise HTTPException(status_code=400, detail="Message must be between 1 and 1000 characters")

    db = get_database()

    restaurants = await db.restaurants.find(
        {"is_active": True},
        {
            "name": 1,
            "cuisine": 1,
            "is_open": 1,
            "opening_hours": 1,
            "rating": 1,
            "delivery_time_mins": 1,
            "delivery_fee": 1,
        },
    ).sort("rating", -1).limit(30).to_list(length=30)

    foods = await db.food_items.find(
        {"is_available": True},
        {
            "name": 1,
            "price": 1,
            "is_veg": 1,
            "rating": 1,
            "restaurant_id": 1,
            "description": 1,
        },
    ).sort("rating", -1).limit(60).to_list(length=60)

    rest_name_map = {str(r["_id"]): r["name"] for r in restaurants}
    food_context = [
        {
            "name": f["name"],
            "price_inr": f["price"],
            "is_veg": f.get("is_veg", True),
            "rating": f.get("rating", 0),
            "restaurant": rest_name_map.get(f.get("restaurant_id", ""), "Unknown"),
        }
        for f in foods
    ]

    rest_context = [
        {
            "name": r["name"],
            "cuisine": r.get("cuisine", []),
            "is_open": r.get("is_open", True),
            "opening_hours": r.get("opening_hours", {}),
            "rating": r.get("rating", 0),
            "delivery_time_mins": r.get("delivery_time_mins", 30),
            "delivery_fee_inr": r.get("delivery_fee", 35),
        }
        for r in restaurants
    ]

    # Restrict strictly to the authenticated customer's own orders
    my_orders = await db.orders.find(
        {"customer_id": customer["id"]},
        {
            "order_number": 1,
            "status": 1,
            "restaurant_name": 1,
            "total_amount": 1,
            "payment_method": 1,
            "payment_status": 1,
            "created_at": 1,
        },
    ).sort("created_at", -1).limit(5).to_list(length=5)

    orders_context = serialize_docs(my_orders)

    system_instruction = (
        "You are DoorDelight's helpful AI food delivery assistant. "
        "You MUST ONLY use the verified database context provided below. "
        "Never invent restaurants, dishes, prices, opening hours, or order statuses. "
        "You cannot place, cancel, or modify orders, change prices, or process payments. "
        "If the user asks to perform an action, explain how they can do it in the DoorDelight UI. "
        "Keep answers concise, friendly, and accurate. Prices are in INR (₹)."
    )

    context_payload = {
        "customer_name": customer.get("name"),
        "available_restaurants": rest_context,
        "available_food_items": food_context,
        "customer_recent_orders": orders_context,
        "ordering_process": "Browse restaurants -> Add dishes to cart -> Select delivery address -> Choose Razorpay or Cash on Delivery -> Place order -> Track live status in Orders.",
    }

    user_prompt = (
        f"Verified Database Context:\n{json.dumps(context_payload, default=str)}\n\n"
        f"Customer Question: {clean_msg}"
    )

    try:
        reply = await generate_gemini_response(
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            temperature=0.3,
            max_output_tokens=600,
        )
        return {"reply": reply, "ai_configured": True}
    except GeminiServiceError as exc:
        logger.warning("Chatbot Gemini fallback (%s): %s", exc.code, exc.user_message)
        return {
            "reply": (
                f"{exc.user_message} "
                f"(Live DB status: {len(rest_context)} active restaurants, "
                f"{len(food_context)} available dishes, and {len(orders_context)} recent orders on your account.)"
            ),
            "ai_configured": False,
            "error_code": exc.code,
        }

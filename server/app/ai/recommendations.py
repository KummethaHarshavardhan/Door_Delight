import json
import logging
from typing import Any, Dict, List, Optional

from app.ai.gemini_client import GeminiServiceError, generate_gemini_response
from app.database.mongodb import get_database
from app.utils.serializers import serialize_docs

logger = logging.getLogger(__name__)


async def get_ai_food_recommendations(
    customer: Dict[str, Any],
    max_price: Optional[float] = None,
    is_veg: Optional[bool] = None,
    preference_note: str = "",
) -> Dict[str, Any]:
    """Recommend real available dishes based on customer history, ratings, and budget."""
    db = get_database()

    open_rests = await db.restaurants.find({"is_active": True, "is_open": True}).to_list(length=100)
    open_rest_ids = [str(r["_id"]) for r in open_rests]
    rest_map = {str(r["_id"]): r["name"] for r in open_rests}

    query: Dict[str, Any] = {
        "is_available": True,
        "restaurant_id": {"$in": open_rest_ids} if open_rest_ids else {"$exists": True},
    }
    if max_price is not None and max_price > 0:
        query["price"] = {"$lte": max_price}
    if is_veg is not None:
        query["is_veg"] = is_veg

    candidates = (
        await db.food_items.find(query)
        .sort([("rating", -1), ("is_popular", -1)])
        .limit(12)
        .to_list(length=12)
    )
    serialized_candidates = serialize_docs(candidates)
    for item in serialized_candidates:
        item["restaurant_name"] = rest_map.get(item.get("restaurant_id", ""), "")

    past_orders = await db.orders.find({"customer_id": customer["id"]}).sort("created_at", -1).limit(5).to_list(length=5)
    past_dish_names: List[str] = []
    for o in past_orders:
        for i in o.get("items", []):
            past_dish_names.append(i["name"])

    summary_text = ""
    ai_configured = False
    if serialized_candidates:
        prompt_data = {
            "customer_preferences": customer.get("dietary_preferences", []),
            "past_ordered_dishes": list(dict.fromkeys(past_dish_names))[:10],
            "budget_max_inr": max_price,
            "veg_only": is_veg,
            "note": preference_note,
            "available_dishes": [
                {
                    "name": d["name"],
                    "restaurant": d["restaurant_name"],
                    "price_inr": d["price"],
                    "is_veg": d["is_veg"],
                    "rating": d["rating"],
                }
                for d in serialized_candidates[:6]
            ],
        }
        try:
            summary_text = await generate_gemini_response(
                system_instruction=(
                    "You are DoorDelight's food recommendation assistant. "
                    "Briefly explain in 2-3 sentences why these verified dishes match the customer's taste and budget. "
                    "Only mention dishes from the provided list."
                ),
                user_prompt=json.dumps(prompt_data),
                temperature=0.4,
                max_output_tokens=250,
            )
            ai_configured = True
        except GeminiServiceError as exc:
            logger.warning("Recommendations Gemini fallback (%s): %s", exc.code, exc.user_message)

    if not summary_text:
        summary_text = (
            "Top-rated available dishes from open restaurants matched to your filters."
            if serialized_candidates
            else "No available dishes matched your current filters."
        )

    return {
        "recommendations": serialized_candidates[:6],
        "explanation": summary_text,
        "ai_configured": ai_configured,
    }

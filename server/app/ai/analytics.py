import json
import logging
from typing import Any, Dict
from fastapi import HTTPException

from app.ai.gemini_client import GeminiServiceError, generate_gemini_response
from app.services.admin_service import get_admin_analytics

logger = logging.getLogger(__name__)


async def admin_analytics_assistant(question: str) -> Dict[str, Any]:
    """Compute verified MongoDB analytics first, then use Gemini to explain insights for Admin."""
    clean_q = question.strip()
    if not clean_q or len(clean_q) > 1000:
        raise HTTPException(status_code=400, detail="Question must be between 1 and 1000 characters")

    verified_analytics = await get_admin_analytics()

    system_instruction = (
        "You are DoorDelight's AI Business Analytics Assistant for platform administrators. "
        "You MUST base your entire answer strictly on the verified MongoDB analytics JSON provided. "
        "Never fabricate numbers, restaurants, or trends. Highlight actionable insights clearly."
    )

    user_prompt = (
        f"Verified MongoDB Analytics:\n{json.dumps(verified_analytics, default=str)}\n\n"
        f"Admin Question: {clean_q}"
    )

    try:
        answer = await generate_gemini_response(
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            temperature=0.2,
            max_output_tokens=700,
        )
        return {
            "answer": answer,
            "verified_data": verified_analytics["summary"],
            "ai_configured": True,
        }
    except GeminiServiceError as exc:
        logger.warning("Admin analytics Gemini fallback (%s): %s", exc.code, exc.user_message)
        c = verified_analytics["summary"]
        return {
            "answer": (
                f"{exc.user_message}\n\n"
                f"Verified DB Summary: Total Revenue ₹{c['total_revenue']:.2f}, Total Orders {c['total_orders']}, "
                f"Active {c['active_orders']}, Completed {c['completed_orders']}, Cancelled {c['cancelled_orders']}."
            ),
            "verified_data": verified_analytics["summary"],
            "ai_configured": False,
            "error_code": exc.code,
        }

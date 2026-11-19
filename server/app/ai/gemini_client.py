import asyncio
import logging
from typing import Optional

from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


class GeminiServiceError(Exception):
    """Raised when the Gemini AI service is unavailable, misconfigured, or returns an error."""

    def __init__(self, user_message: str, code: str = "GEMINI_ERROR"):
        super().__init__(user_message)
        self.user_message = user_message
        self.code = code


def get_gemini_client() -> genai.Client:
    """Initialize and return a configured Google Gen AI client."""
    settings = get_settings()
    api_key = (settings.GEMINI_API_KEY or "").strip()
    if not api_key or api_key == "your_google_api_key":
        raise GeminiServiceError(
            "Google Gemini AI is not configured. Set GEMINI_API_KEY in the backend .env file.",
            code="GEMINI_NOT_CONFIGURED",
        )
    return genai.Client(api_key=api_key)


async def generate_gemini_response(
    system_instruction: str,
    user_prompt: str,
    temperature: float = 0.3,
    max_output_tokens: int = 700,
    timeout_seconds: float = 25.0,
) -> str:
    """Generate a text response from Google Gemini with timeout and error handling."""
    settings = get_settings()
    model_name = (settings.GEMINI_MODEL or "gemini-2.5-flash").strip()
    client = get_gemini_client()

    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )

    def _call_sync() -> Optional[str]:
        response = client.models.generate_content(
            model=model_name,
            contents=user_prompt,
            config=config,
        )
        return getattr(response, "text", None)

    try:
        text = await asyncio.wait_for(asyncio.to_thread(_call_sync), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        logger.warning("Gemini request timed out after %.1fs", timeout_seconds)
        raise GeminiServiceError(
            "AI assistant timed out while generating a response. Please try again.",
            code="GEMINI_TIMEOUT",
        )
    except APIError as exc:
        status_code = getattr(exc, "code", None)
        logger.error("Gemini APIError (status=%s): %s", status_code, str(exc))
        if status_code in (401, 403):
            raise GeminiServiceError(
                "Gemini API authentication failed. Please verify GEMINI_API_KEY.",
                code="GEMINI_INVALID_KEY",
            )
        if status_code == 429:
            raise GeminiServiceError(
                "AI rate limit or quota exceeded. Please try again shortly.",
                code="GEMINI_QUOTA_EXCEEDED",
            )
        raise GeminiServiceError(
            "AI service is temporarily unavailable. Please try again later.",
            code="GEMINI_API_ERROR",
        )
    except Exception as exc:
        logger.error("Unexpected error calling Gemini: %s", type(exc).__name__)
        raise GeminiServiceError(
            "Unable to reach the AI service right now. Please try again later.",
            code="GEMINI_NETWORK_ERROR",
        )

    cleaned = (text or "").strip()
    if not cleaned:
        raise GeminiServiceError(
            "AI assistant returned an empty response. Please rephrase your question.",
            code="GEMINI_EMPTY_RESPONSE",
        )
    return cleaned

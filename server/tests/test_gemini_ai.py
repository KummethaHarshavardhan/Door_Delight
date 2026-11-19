import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.ai.gemini_client import GeminiServiceError, get_gemini_client


def test_missing_api_key_raises_service_error(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    from app.config.settings import get_settings
    get_settings.cache_clear()
    with pytest.raises(GeminiServiceError) as exc_info:
        get_gemini_client()
    assert exc_info.value.code == "GEMINI_NOT_CONFIGURED"
    get_settings.cache_clear()


def test_placeholder_api_key_raises_service_error(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "your_google_api_key")
    from app.config.settings import get_settings
    get_settings.cache_clear()
    with pytest.raises(GeminiServiceError) as exc_info:
        get_gemini_client()
    assert exc_info.value.code == "GEMINI_NOT_CONFIGURED"
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_chatbot_graceful_fallback_when_unconfigured(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    from app.config.settings import get_settings
    get_settings.cache_clear()

    fake_cursor = MagicMock()
    fake_cursor.sort.return_value = fake_cursor
    fake_cursor.limit.return_value = fake_cursor
    fake_cursor.to_list = AsyncMock(return_value=[])

    fake_db = MagicMock()
    fake_db.restaurants.find.return_value = fake_cursor
    fake_db.food_items.find.return_value = fake_cursor
    fake_db.orders.find.return_value = fake_cursor

    with patch("app.ai.chatbot.get_database", return_value=fake_db):
        from app.ai.chatbot import customer_chatbot_reply
        res = await customer_chatbot_reply({"id": "cust1", "name": "Test"}, "What is available?")
        assert res["ai_configured"] is False
        assert res["error_code"] == "GEMINI_NOT_CONFIGURED"
        assert "GEMINI_API_KEY" in res["reply"]
    get_settings.cache_clear()

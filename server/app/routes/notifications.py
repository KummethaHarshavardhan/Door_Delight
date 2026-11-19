from typing import Any, Dict
from fastapi import APIRouter, Depends

from app.database.mongodb import get_database
from app.middleware.auth import get_current_user
from app.utils.serializers import serialize_docs

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
async def get_my_notifications(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    db = get_database()
    docs = await db.notifications.find({"user_id": current_user["id"]}).sort("created_at", -1).to_list(length=50)
    return {"notifications": serialize_docs(docs)}


@router.put("/read-all")
async def mark_all_read(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    db = get_database()
    await db.notifications.update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}},
    )
    return {"message": "All notifications marked as read"}

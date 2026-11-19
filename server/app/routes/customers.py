from typing import Any, Dict
from fastapi import APIRouter, Depends

from app.database.mongodb import get_database
from app.middleware.auth import require_roles
from app.models.enums import UserRole
from app.schemas.auth import ProfileUpdateRequest
from app.services.auth_service import update_user_profile
from app.utils.serializers import serialize_docs

router = APIRouter(prefix="/api/customers", tags=["Customers"])


@router.get("/profile")
async def get_customer_profile(
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    return {"profile": current_user}


@router.put("/profile")
async def update_customer_profile(
    payload: ProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    updated = await update_user_profile(current_user["id"], payload)
    return {"profile": updated}


@router.get("/orders")
async def get_customer_orders(
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    db = get_database()
    orders = await db.orders.find({"customer_id": current_user["id"]}).sort("created_at", -1).to_list(length=100)
    return {"orders": serialize_docs(orders)}

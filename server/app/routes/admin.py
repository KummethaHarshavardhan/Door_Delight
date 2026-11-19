from datetime import timedelta
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, status
from app.utils.serializers import serialize_docs, utc_now

from app.database.mongodb import get_database
from app.middleware.auth import require_roles
from app.models.enums import UserRole
from app.schemas.admin import AdminCreateUserRequest, AdminUpdateUserRequest
from app.services.admin_service import (
    create_user_admin,
    delete_user_admin,
    get_admin_analytics,
    get_admin_dashboard_stats,
    list_users_admin,
    update_user_admin,
)
from app.services.catalog_service import list_foods, list_restaurants
from app.utils.serializers import serialize_docs

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/dashboard")
async def admin_dashboard(
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    return await get_admin_dashboard_stats()


@router.get("/users")
async def admin_list_users(
    search: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    users = await list_users_admin(search=search, role=role)
    return {"users": users}


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    payload: AdminCreateUserRequest,
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    user = await create_user_admin(payload)
    return {"user": user}


@router.put("/users/{user_id}")
async def admin_update_user(
    user_id: str,
    payload: AdminUpdateUserRequest,
    current_admin: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    user = await update_user_admin(user_id, payload, current_admin["id"])
    return {"user": user}


@router.delete("/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    current_admin: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, str]:
    await delete_user_admin(user_id, current_admin["id"])
    return {"message": "User deleted successfully"}


@router.get("/restaurants")
async def admin_restaurants(
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    restaurants = await list_restaurants(include_inactive=True)
    return {"restaurants": restaurants}


@router.get("/foods")
async def admin_foods(
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    foods = await list_foods(available_only=False)
    return {"foods": foods}


@router.get("/orders")
async def admin_orders(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    search: Optional[str] = Query(default=None),
    timeframe: Optional[str] = Query(default=None),
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    db = get_database()
    query: Dict[str, Any] = {}
    if status_filter:
        query["status"] = status_filter
    if timeframe:
        now = utc_now()
        if timeframe == "today":
            query["created_at"] = {"$gte": now.replace(hour=0, minute=0, second=0, microsecond=0)}
        elif timeframe == "week":
            query["created_at"] = {"$gte": now - timedelta(days=7)}
        elif timeframe == "month":
            query["created_at"] = {"$gte": now - timedelta(days=30)}
    if search:
        query["$or"] = [
            {"order_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"restaurant_name": {"$regex": search, "$options": "i"}},
        ]
    orders = await db.orders.find(query).sort("created_at", -1).to_list(length=300)
    return {"orders": serialize_docs(orders)}


@router.get("/payments")
async def admin_payments(
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    db = get_database()
    payments = await db.payments.find({}).sort("created_at", -1).to_list(length=300)
    return {"payments": serialize_docs(payments)}


@router.get("/analytics")
async def admin_analytics(
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    return await get_admin_analytics()

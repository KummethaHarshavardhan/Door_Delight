import os
import uuid
from typing import Any, Dict
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.config.settings import get_settings
from app.database.mongodb import get_database
from app.middleware.auth import require_roles
from app.models.enums import OrderStatus, UserRole
from app.services.cod_service import confirm_cod_order_returned
from app.services.cod_settlement_service import get_manager_cod_settlements
from app.utils.serializers import serialize_doc, serialize_docs

router = APIRouter(prefix="/api/manager", tags=["Restaurant Manager"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.get("/restaurant")
async def get_assigned_restaurant(
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.RESTAURANT_MANAGER)),
) -> Dict[str, Any]:
    db = get_database()
    restaurant = await db.restaurants.find_one({"manager_id": current_user["id"], "is_active": True})
    if not restaurant:
        return {"restaurant": None, "menu": []}
    rest_id = str(restaurant["_id"])
    menu = await db.food_items.find({"restaurant_id": rest_id}).sort("created_at", -1).to_list(length=300)
    return {"restaurant": serialize_doc(restaurant), "menu": serialize_docs(menu)}


@router.get("/orders")
async def get_restaurant_orders(
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.RESTAURANT_MANAGER)),
) -> Dict[str, Any]:
    db = get_database()
    rest = await db.restaurants.find_one({"manager_id": current_user["id"], "is_active": True})
    if not rest:
        return {"orders": []}
    orders = await db.orders.find({"restaurant_id": str(rest["_id"])}).sort("created_at", -1).to_list(length=200)
    return {"orders": serialize_docs(orders)}


@router.get("/analytics")
async def get_restaurant_analytics(
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.RESTAURANT_MANAGER)),
) -> Dict[str, Any]:
    db = get_database()
    rest = await db.restaurants.find_one({"manager_id": current_user["id"], "is_active": True})
    if not rest:
        return {
            "total_orders": 0,
            "completed_orders": 0,
            "active_orders": 0,
            "cancelled_or_rejected": 0,
            "total_revenue": 0.0,
            "top_items": [],
        }

    rest_id = str(rest["_id"])
    pipeline = [
        {"$match": {"restaurant_id": rest_id}},
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "revenue": {"$sum": "$total_amount"},
            }
        },
    ]
    status_stats = await db.orders.aggregate(pipeline).to_list(length=20)

    total_orders = sum(s["count"] for s in status_stats)
    completed_orders = sum(s["count"] for s in status_stats if s["_id"] == OrderStatus.DELIVERED.value)
    cancelled_or_rejected = sum(
        s["count"] for s in status_stats if s["_id"] in {OrderStatus.CANCELLED.value, OrderStatus.REJECTED.value}
    )
    active_orders = total_orders - completed_orders - cancelled_or_rejected
    total_revenue = round(
        sum(
            s["revenue"]
            for s in status_stats
            if s["_id"] not in {OrderStatus.CANCELLED.value, OrderStatus.REJECTED.value}
        ),
        2,
    )

    top_items_agg = await db.orders.aggregate([
        {
            "$match": {
                "restaurant_id": rest_id,
                "status": {"$nin": [OrderStatus.CANCELLED.value, OrderStatus.REJECTED.value]},
            }
        },
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": "$items.name",
                "total_qty": {"$sum": "$items.quantity"},
                "revenue": {"$sum": "$items.line_total"},
            }
        },
        {"$sort": {"total_qty": -1}},
        {"$limit": 5},
    ]).to_list(length=5)

    return {
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "active_orders": active_orders,
        "cancelled_or_rejected": cancelled_or_rejected,
        "total_revenue": total_revenue,
        "top_items": [
            {"name": item["_id"], "quantity": item["total_qty"], "revenue": round(item["revenue"], 2)}
            for item in top_items_agg
        ],
    }


@router.post("/upload-image")
async def upload_food_image(
    file: UploadFile = File(...),
    _: Dict[str, Any] = Depends(require_roles(UserRole.RESTAURANT_MANAGER, UserRole.ADMIN)),
) -> Dict[str, str]:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WEBP, and GIF images are allowed")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size must be 5MB or less")

    settings = get_settings()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    return {"image_url": f"/uploads/{filename}"}


@router.put("/orders/{order_id}/cod-returned")
async def manager_confirm_cod_returned(
    order_id: str,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.RESTAURANT_MANAGER, UserRole.ADMIN)),
) -> Dict[str, Any]:
    return await confirm_cod_order_returned(order_id=order_id, actor=current_user)


@router.get("/cod-settlements")
async def manager_cod_settlements(
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.RESTAURANT_MANAGER)),
) -> Dict[str, Any]:
    return await get_manager_cod_settlements(current_user["id"])

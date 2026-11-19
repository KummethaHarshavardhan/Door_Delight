from datetime import timedelta
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status

from app.database.mongodb import get_database
from app.models.enums import OrderStatus, UserRole
from app.schemas.admin import AdminCreateUserRequest, AdminUpdateUserRequest
from app.utils.security import hash_password
from app.utils.serializers import serialize_doc, serialize_docs, to_object_id, utc_now


async def get_admin_dashboard_stats() -> Dict[str, Any]:
    """Compute real-time platform statistics using MongoDB aggregations."""
    db = get_database()

    # Role counts
    role_counts_agg = await db.users.aggregate([
        {"$group": {"_id": "$role", "count": {"$sum": 1}}}
    ]).to_list(length=10)
    role_map = {r["_id"]: r["count"] for r in role_counts_agg}

    total_restaurants = await db.restaurants.count_documents({"is_active": True})
    total_food_items = await db.food_items.count_documents({})

    # Order status & revenue aggregation
    order_agg = await db.orders.aggregate([
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "revenue": {"$sum": "$total_amount"},
            }
        }
    ]).to_list(length=20)

    total_orders = sum(o["count"] for o in order_agg)
    completed_orders = sum(o["count"] for o in order_agg if o["_id"] == OrderStatus.DELIVERED.value)
    cancelled_orders = sum(
        o["count"] for o in order_agg if o["_id"] in {OrderStatus.CANCELLED.value, OrderStatus.REJECTED.value}
    )
    active_orders = total_orders - completed_orders - cancelled_orders
    total_revenue = round(
        sum(
            o["revenue"]
            for o in order_agg
            if o["_id"] not in {OrderStatus.CANCELLED.value, OrderStatus.REJECTED.value}
        ),
        2,
    )

    recent_orders_docs = await db.orders.find({}).sort("created_at", -1).limit(10).to_list(length=10)

    popular_foods = await db.orders.aggregate([
        {"$match": {"status": {"$nin": [OrderStatus.CANCELLED.value, OrderStatus.REJECTED.value]}}},
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": "$items.food_item_id",
                "name": {"$first": "$items.name"},
                "total_ordered": {"$sum": "$items.quantity"},
                "revenue": {"$sum": "$items.line_total"},
            }
        },
        {"$sort": {"total_ordered": -1}},
        {"$limit": 8},
    ]).to_list(length=8)

    restaurant_perf = await db.orders.aggregate([
        {"$match": {"status": {"$nin": [OrderStatus.CANCELLED.value, OrderStatus.REJECTED.value]}}},
        {
            "$group": {
                "_id": "$restaurant_id",
                "restaurant_name": {"$first": "$restaurant_name"},
                "orders_count": {"$sum": 1},
                "revenue": {"$sum": "$total_amount"},
            }
        },
        {"$sort": {"revenue": -1}},
        {"$limit": 10},
    ]).to_list(length=10)

    return {
        "counts": {
            "total_customers": role_map.get(UserRole.CUSTOMER.value, 0),
            "total_restaurants": total_restaurants,
            "total_food_items": total_food_items,
            "total_restaurant_managers": role_map.get(UserRole.RESTAURANT_MANAGER.value, 0),
            "total_delivery_partners": role_map.get(UserRole.DELIVERY_PARTNER.value, 0),
            "total_orders": total_orders,
            "active_orders": active_orders,
            "completed_orders": completed_orders,
            "cancelled_orders": cancelled_orders,
            "total_revenue": total_revenue,
        },
        "recent_orders": serialize_docs(recent_orders_docs),
        "popular_food_items": [
            {
                "food_item_id": p["_id"],
                "name": p["name"],
                "total_ordered": p["total_ordered"],
                "revenue": round(p["revenue"], 2),
            }
            for p in popular_foods
        ],
        "restaurant_performance": [
            {
                "restaurant_id": r["_id"],
                "restaurant_name": r["restaurant_name"],
                "orders_count": r["orders_count"],
                "revenue": round(r["revenue"], 2),
            }
            for r in restaurant_perf
        ],
    }


async def get_admin_analytics() -> Dict[str, Any]:
    """Compute daily, weekly, monthly sales, status stats, and customer activity."""
    db = get_database()
    now = utc_now()
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    non_cancelled_match = {"status": {"$nin": [OrderStatus.CANCELLED.value, OrderStatus.REJECTED.value]}}

    daily_sales = await db.orders.aggregate([
        {"$match": {**non_cancelled_match, "created_at": {"$gte": seven_days_ago}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "orders": {"$sum": 1},
                "revenue": {"$sum": "$total_amount"},
            }
        },
        {"$sort": {"_id": 1}},
    ]).to_list(length=30)

    weekly_sales = await db.orders.aggregate([
        {"$match": {**non_cancelled_match, "created_at": {"$gte": thirty_days_ago}}},
        {
            "$group": {
                "_id": {"$isoWeek": "$created_at"},
                "orders": {"$sum": 1},
                "revenue": {"$sum": "$total_amount"},
            }
        },
        {"$sort": {"_id": 1}},
    ]).to_list(length=10)

    monthly_sales = await db.orders.aggregate([
        {"$match": non_cancelled_match},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}},
                "orders": {"$sum": 1},
                "revenue": {"$sum": "$total_amount"},
            }
        },
        {"$sort": {"_id": 1}},
    ]).to_list(length=12)

    status_stats = await db.orders.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(length=20)

    top_customers = await db.orders.aggregate([
        {"$match": non_cancelled_match},
        {
            "$group": {
                "_id": "$customer_id",
                "customer_name": {"$first": "$customer_name"},
                "orders": {"$sum": 1},
                "total_spent": {"$sum": "$total_amount"},
            }
        },
        {"$sort": {"total_spent": -1}},
        {"$limit": 10},
    ]).to_list(length=10)

    dashboard = await get_admin_dashboard_stats()
    return {
        "summary": dashboard["counts"],
        "daily_sales": [{"date": d["_id"], "orders": d["orders"], "revenue": round(d["revenue"], 2)} for d in daily_sales],
        "weekly_sales": [{"week": f"W{w['_id']}", "orders": w["orders"], "revenue": round(w["revenue"], 2)} for w in weekly_sales],
        "monthly_sales": [{"month": m["_id"], "orders": m["orders"], "revenue": round(m["revenue"], 2)} for m in monthly_sales],
        "order_status_stats": [{"status": s["_id"], "count": s["count"]} for s in status_stats],
        "restaurant_performance": dashboard["restaurant_performance"],
        "popular_food_items": dashboard["popular_food_items"],
        "customer_activity": [
            {
                "customer_id": c["_id"],
                "customer_name": c["customer_name"],
                "orders": c["orders"],
                "total_spent": round(c["total_spent"], 2),
            }
            for c in top_customers
        ],
    }


async def list_users_admin(search: Optional[str] = None, role: Optional[str] = None) -> List[Dict[str, Any]]:
    db = get_database()
    query: Dict[str, Any] = {}
    if role:
        query["role"] = role
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.users.find(query).sort("created_at", -1).to_list(length=300)
    return serialize_docs(docs, exclude=["password_hash"])


async def create_user_admin(payload: AdminCreateUserRequest) -> Dict[str, Any]:
    db = get_database()
    email_lower = payload.email.strip().lower()
    if await db.users.find_one({"email": email_lower}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    now = utc_now()
    doc = {
        "name": payload.name.strip(),
        "email": email_lower,
        "password_hash": hash_password(payload.password),
        "phone": payload.phone.strip(),
        "role": payload.role.value,
        "is_active": payload.is_active,
        "avatar_url": "",
        "dietary_preferences": [],
        "created_at": now,
        "updated_at": now,
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc, exclude=["password_hash"])


async def update_user_admin(user_id: str, payload: AdminUpdateUserRequest, current_admin_id: str) -> Dict[str, Any]:
    db = get_database()
    oid = to_object_id(user_id, "user_id")
    existing = await db.users.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    if user_id == current_admin_id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own admin account")

    updates = {k: (v.value if hasattr(v, "value") else v) for k, v in payload.model_dump(exclude_none=True).items()}
    updates["updated_at"] = utc_now()
    await db.users.update_one({"_id": oid}, {"$set": updates})
    doc = await db.users.find_one({"_id": oid})
    return serialize_doc(doc, exclude=["password_hash"])


async def delete_user_admin(user_id: str, current_admin_id: str) -> None:
    db = get_database()
    oid = to_object_id(user_id, "user_id")
    if user_id == current_admin_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account")
    existing = await db.users.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent deleting users with active orders
    active_orders = await db.orders.count_documents({
        "$or": [{"customer_id": user_id}, {"delivery_partner_id": user_id}],
        "status": {
            "$nin": [OrderStatus.DELIVERED.value, OrderStatus.CANCELLED.value, OrderStatus.REJECTED.value]
        },
    })
    if active_orders > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete user with active orders. Deactivate the account instead.",
        )

    await db.users.delete_one({"_id": oid})

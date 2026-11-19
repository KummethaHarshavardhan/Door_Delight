import re
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status

from app.database.mongodb import get_database
from app.models.enums import OrderStatus, UserRole
from app.schemas.catalog import (
    CategoryCreateRequest,
    CategoryUpdateRequest,
    FoodItemCreateRequest,
    FoodItemUpdateRequest,
    RestaurantCreateRequest,
    RestaurantUpdateRequest,
    ReviewCreateRequest,
)
from app.utils.serializers import serialize_doc, serialize_docs, to_object_id, utc_now


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


async def list_categories(active_only: bool = True) -> List[Dict[str, Any]]:
    db = get_database()
    query = {"is_active": True} if active_only else {}
    docs = await db.food_categories.find(query).sort("name", 1).to_list(length=100)
    return serialize_docs(docs)


async def create_category(payload: CategoryCreateRequest) -> Dict[str, Any]:
    db = get_database()
    slug = payload.slug or _slugify(payload.name)
    existing = await db.food_categories.find_one({"slug": slug})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category already exists")
    now = utc_now()
    doc = {
        "name": payload.name.strip(),
        "slug": slug,
        "icon": payload.icon,
        "description": payload.description.strip(),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    res = await db.food_categories.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc)


async def update_category(category_id: str, payload: CategoryUpdateRequest) -> Dict[str, Any]:
    db = get_database()
    oid = to_object_id(category_id, "category_id")
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        doc = await db.food_categories.find_one({"_id": oid})
        if not doc:
            raise HTTPException(status_code=404, detail="Category not found")
        return serialize_doc(doc)
    updates["updated_at"] = utc_now()
    res = await db.food_categories.update_one({"_id": oid}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    doc = await db.food_categories.find_one({"_id": oid})
    return serialize_doc(doc)


async def list_restaurants(
    search: Optional[str] = None,
    cuisine: Optional[str] = None,
    is_open: Optional[bool] = None,
    featured_only: bool = False,
    include_inactive: bool = False,
) -> List[Dict[str, Any]]:
    db = get_database()
    query: Dict[str, Any] = {}
    if not include_inactive:
        query["is_active"] = True
    if is_open is not None:
        query["is_open"] = is_open
    if featured_only:
        query["is_featured"] = True
    if cuisine:
        query["cuisine"] = {"$regex": cuisine, "$options": "i"}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"cuisine": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.restaurants.find(query).sort([("is_featured", -1), ("rating", -1)]).to_list(length=200)
    return serialize_docs(docs)


async def get_restaurant_by_id(restaurant_id: str) -> Dict[str, Any]:
    db = get_database()
    oid = to_object_id(restaurant_id, "restaurant_id")
    doc = await db.restaurants.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    return serialize_doc(doc)


async def create_restaurant(payload: RestaurantCreateRequest, current_user: Dict[str, Any]) -> Dict[str, Any]:
    db = get_database()
    manager_id = payload.manager_id
    if current_user["role"] == UserRole.RESTAURANT_MANAGER.value:
        manager_id = current_user["id"]
    elif manager_id:
        mgr_oid = to_object_id(manager_id, "manager_id")
        mgr = await db.users.find_one({"_id": mgr_oid, "role": UserRole.RESTAURANT_MANAGER.value})
        if not mgr:
            raise HTTPException(status_code=400, detail="Assigned manager must be an existing RESTAURANT_MANAGER")

    now = utc_now()
    doc = {
        "name": payload.name.strip(),
        "description": payload.description.strip(),
        "cuisine": payload.cuisine,
        "address": payload.address.strip(),
        "city": payload.city.strip(),
        "phone": payload.phone.strip(),
        "upi_id": payload.upi_id.strip(),
        "image_url": payload.image_url.strip(),
        "opening_hours": payload.opening_hours,
        "delivery_time_mins": payload.delivery_time_mins,
        "delivery_fee": float(payload.delivery_fee),
        "min_order_amount": float(payload.min_order_amount),
        "is_open": payload.is_open,
        "is_active": True,
        "is_featured": payload.is_featured,
        "manager_id": manager_id or "",
        "rating": 0.0,
        "review_count": 0,
        "created_by": current_user["id"],
        "updated_by": current_user["id"],
        "created_at": now,
        "updated_at": now,
    }
    res = await db.restaurants.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc)


async def update_restaurant(
    restaurant_id: str,
    payload: RestaurantUpdateRequest,
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    db = get_database()
    oid = to_object_id(restaurant_id, "restaurant_id")
    existing = await db.restaurants.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    if (
        current_user["role"] == UserRole.RESTAURANT_MANAGER.value
        and existing.get("manager_id") != current_user["id"]
    ):
        raise HTTPException(status_code=403, detail="You can only manage your assigned restaurant")

    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if current_user["role"] != UserRole.ADMIN.value:
        updates.pop("manager_id", None)
        updates.pop("is_active", None)
        updates.pop("is_featured", None)
    elif "manager_id" in updates and updates["manager_id"]:
        mgr_oid = to_object_id(updates["manager_id"], "manager_id")
        mgr = await db.users.find_one({"_id": mgr_oid, "role": UserRole.RESTAURANT_MANAGER.value})
        if not mgr:
            raise HTTPException(status_code=400, detail="Assigned manager must be an existing RESTAURANT_MANAGER")

    updates["updated_at"] = utc_now()
    await db.restaurants.update_one({"_id": oid}, {"$set": updates})
    updated = await db.restaurants.find_one({"_id": oid})
    return serialize_doc(updated)


async def delete_restaurant(restaurant_id: str) -> None:
    db = get_database()
    oid = to_object_id(restaurant_id, "restaurant_id")
    res = await db.restaurants.update_one(
        {"_id": oid},
        {"$set": {"is_active": False, "is_open": False, "updated_at": utc_now()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant not found")


async def list_foods(
    restaurant_id: Optional[str] = None,
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    is_veg: Optional[bool] = None,
    available_only: bool = True,
    popular_only: bool = False,
) -> List[Dict[str, Any]]:
    db = get_database()
    query: Dict[str, Any] = {}
    if available_only:
        query["is_available"] = True
    if popular_only:
        query["is_popular"] = True
    if restaurant_id:
        to_object_id(restaurant_id, "restaurant_id")
        query["restaurant_id"] = restaurant_id
    if category_id:
        to_object_id(category_id, "category_id")
        query["category_id"] = category_id
    if is_veg is not None:
        query["is_veg"] = is_veg
    if min_price is not None or max_price is not None:
        price_filter: Dict[str, float] = {}
        if min_price is not None:
            price_filter["$gte"] = min_price
        if max_price is not None:
            price_filter["$lte"] = max_price
        query["price"] = price_filter
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}},
        ]

    docs = await db.food_items.find(query).sort([("is_popular", -1), ("rating", -1)]).to_list(length=300)

    # Enrich with restaurant name & category name
    rest_ids = list({ObjectId(d["restaurant_id"]) for d in docs if ObjectId.is_valid(d.get("restaurant_id", ""))})
    cat_ids = list({ObjectId(d["category_id"]) for d in docs if ObjectId.is_valid(d.get("category_id", ""))})

    rest_map = {}
    if rest_ids:
        rests = await db.restaurants.find({"_id": {"$in": rest_ids}}).to_list(length=200)
        rest_map = {str(r["_id"]): r["name"] for r in rests}

    cat_map = {}
    if cat_ids:
        cats = await db.food_categories.find({"_id": {"$in": cat_ids}}).to_list(length=100)
        cat_map = {str(c["_id"]): c["name"] for c in cats}

    serialized = serialize_docs(docs)
    for item in serialized:
        item["restaurant_name"] = rest_map.get(item.get("restaurant_id", ""), "")
        item["category_name"] = cat_map.get(item.get("category_id", ""), "")
    return serialized


async def get_food_by_id(food_id: str) -> Dict[str, Any]:
    db = get_database()
    oid = to_object_id(food_id, "food_id")
    doc = await db.food_items.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Food item not found")
    item = serialize_doc(doc)
    if ObjectId.is_valid(item.get("restaurant_id", "")):
        rest = await db.restaurants.find_one({"_id": ObjectId(item["restaurant_id"])})
        item["restaurant_name"] = rest["name"] if rest else ""
    if ObjectId.is_valid(item.get("category_id", "")):
        cat = await db.food_categories.find_one({"_id": ObjectId(item["category_id"])})
        item["category_name"] = cat["name"] if cat else ""
    return item


async def create_food_item(payload: FoodItemCreateRequest, current_user: Dict[str, Any]) -> Dict[str, Any]:
    db = get_database()
    rest_id = payload.restaurant_id

    if current_user["role"] == UserRole.RESTAURANT_MANAGER.value:
        rest = await db.restaurants.find_one({"manager_id": current_user["id"], "is_active": True})
        if not rest:
            raise HTTPException(status_code=400, detail="No active restaurant assigned to your manager account")
        if rest_id and rest_id != str(rest["_id"]):
            raise HTTPException(status_code=403, detail="You can only add food to your assigned restaurant")
        rest_id = str(rest["_id"])
    else:
        if not rest_id:
            raise HTTPException(status_code=400, detail="restaurant_id is required")
        rest_oid = to_object_id(rest_id, "restaurant_id")
        rest = await db.restaurants.find_one({"_id": rest_oid})
        if not rest:
            raise HTTPException(status_code=404, detail="Restaurant not found")

    cat_oid = to_object_id(payload.category_id, "category_id")
    cat = await db.food_categories.find_one({"_id": cat_oid})
    if not cat:
        raise HTTPException(status_code=404, detail="Food category not found")

    now = utc_now()
    doc = {
        "restaurant_id": rest_id,
        "category_id": payload.category_id,
        "name": payload.name.strip(),
        "description": payload.description.strip(),
        "price": round(float(payload.price), 2),
        "discount_percent": round(float(payload.discount_percent or 0.0), 2),
        "image_url": payload.image_url.strip(),
        "is_veg": payload.is_veg,
        "is_available": payload.is_available,
        "is_popular": payload.is_popular,
        "prep_time_mins": payload.prep_time_mins,
        "tags": payload.tags,
        "rating": 0.0,
        "review_count": 0,
        "created_by": current_user["id"],
        "updated_by": current_user["id"],
        "created_at": now,
        "updated_at": now,
    }
    res = await db.food_items.insert_one(doc)
    doc["_id"] = res.inserted_id
    return await get_food_by_id(str(doc["_id"]))


async def update_food_item(
    food_id: str,
    payload: FoodItemUpdateRequest,
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    db = get_database()
    oid = to_object_id(food_id, "food_id")
    existing = await db.food_items.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Food item not found")

    if current_user["role"] == UserRole.RESTAURANT_MANAGER.value:
        rest = await db.restaurants.find_one({"_id": ObjectId(existing["restaurant_id"])})
        if not rest or rest.get("manager_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only edit food in your assigned restaurant")

    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "category_id" in updates:
        cat_oid = to_object_id(updates["category_id"], "category_id")
        if not await db.food_categories.find_one({"_id": cat_oid}):
            raise HTTPException(status_code=404, detail="Food category not found")
    if "price" in updates:
        updates["price"] = round(float(updates["price"]), 2)
    if "discount_percent" in updates:
        updates["discount_percent"] = round(float(updates["discount_percent"]), 2)
    updates["updated_by"] = current_user["id"]
    updates["updated_at"] = utc_now()

    await db.food_items.update_one({"_id": oid}, {"$set": updates})
    return await get_food_by_id(food_id)


async def delete_food_item(food_id: str, current_user: Dict[str, Any]) -> None:
    db = get_database()
    oid = to_object_id(food_id, "food_id")
    existing = await db.food_items.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Food item not found")

    if current_user["role"] == UserRole.RESTAURANT_MANAGER.value:
        rest = await db.restaurants.find_one({"_id": ObjectId(existing["restaurant_id"])})
        if not rest or rest.get("manager_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only delete food in your assigned restaurant")

    await db.food_items.delete_one({"_id": oid})


async def create_review(payload: ReviewCreateRequest, customer: Dict[str, Any]) -> Dict[str, Any]:
    db = get_database()
    order_oid = to_object_id(payload.order_id, "order_id")
    to_object_id(payload.food_item_id, "food_item_id")

    order = await db.orders.find_one({"_id": order_oid, "customer_id": customer["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") != OrderStatus.DELIVERED.value:
        raise HTTPException(status_code=400, detail="You can only review items from delivered orders")

    ordered_food_ids = {item["food_item_id"] for item in order.get("items", [])}
    if payload.food_item_id not in ordered_food_ids:
        raise HTTPException(status_code=400, detail="Food item was not part of this order")

    existing = await db.reviews.find_one({
        "customer_id": customer["id"],
        "order_id": payload.order_id,
        "food_item_id": payload.food_item_id,
    })
    if existing:
        raise HTTPException(status_code=409, detail="You have already reviewed this item for this order")

    now = utc_now()
    doc = {
        "customer_id": customer["id"],
        "customer_name": customer["name"],
        "order_id": payload.order_id,
        "food_item_id": payload.food_item_id,
        "restaurant_id": order["restaurant_id"],
        "rating": payload.rating,
        "comment": payload.comment.strip(),
        "created_at": now,
    }
    res = await db.reviews.insert_one(doc)
    doc["_id"] = res.inserted_id

    # Recompute food item & restaurant average ratings
    food_agg = await db.reviews.aggregate([
        {"$match": {"food_item_id": payload.food_item_id}},
        {"$group": {"_id": "$food_item_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]).to_list(length=1)
    if food_agg:
        await db.food_items.update_one(
            {"_id": ObjectId(payload.food_item_id)},
            {"$set": {"rating": round(food_agg[0]["avg"], 2), "review_count": food_agg[0]["count"]}},
        )

    rest_agg = await db.reviews.aggregate([
        {"$match": {"restaurant_id": order["restaurant_id"]}},
        {"$group": {"_id": "$restaurant_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]).to_list(length=1)
    if rest_agg:
        await db.restaurants.update_one(
            {"_id": ObjectId(order["restaurant_id"])},
            {"$set": {"rating": round(rest_agg[0]["avg"], 2), "review_count": rest_agg[0]["count"]}},
        )

    return serialize_doc(doc)


async def list_reviews_for_food(food_id: str) -> List[Dict[str, Any]]:
    db = get_database()
    to_object_id(food_id, "food_id")
    docs = await db.reviews.find({"food_item_id": food_id}).sort("created_at", -1).to_list(length=100)
    return serialize_docs(docs)

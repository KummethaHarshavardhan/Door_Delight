from typing import Any, Dict, List
from bson import ObjectId
from fastapi import HTTPException, status

from app.database.mongodb import get_database
from app.schemas.customer import CartAddItemRequest, CartUpdateItemRequest
from app.utils.serializers import to_object_id, utc_now

TAX_RATE = 0.05  # 5% GST on food subtotal


async def compute_cart_details(customer_id: str) -> Dict[str, Any]:
    """Fetch cart and compute authoritative prices, taxes, and delivery fee from DB."""
    db = get_database()
    cart = await db.carts.find_one({"customer_id": customer_id})
    if not cart or not cart.get("items"):
        return {
            "customer_id": customer_id,
            "restaurant_id": None,
            "restaurant_name": None,
            "items": [],
            "subtotal": 0.0,
            "delivery_fee": 0.0,
            "tax_amount": 0.0,
            "total_amount": 0.0,
            "item_count": 0,
        }

    restaurant_id = cart.get("restaurant_id")
    restaurant = None
    if restaurant_id and ObjectId.is_valid(restaurant_id):
        restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})

    enriched_items: List[Dict[str, Any]] = []
    subtotal = 0.0
    total_qty = 0

    for entry in cart.get("items", []):
        fid = entry["food_item_id"]
        if not ObjectId.is_valid(fid):
            continue
        food = await db.food_items.find_one({"_id": ObjectId(fid)})
        if not food:
            continue
        qty = int(entry["quantity"])
        raw_price = float(food["price"])
        discount_pct = float(food.get("discount_percent", 0.0) or 0.0)
        unit_price = round(raw_price * (1.0 - discount_pct / 100.0), 2)
        line_total = round(unit_price * qty, 2)
        subtotal += line_total
        total_qty += qty
        enriched_items.append({
            "food_item_id": str(food["_id"]),
            "name": food["name"],
            "price": unit_price,
            "original_price": raw_price,
            "discount_percent": discount_pct,
            "quantity": qty,
            "line_total": line_total,
            "image_url": food.get("image_url", ""),
            "is_veg": food.get("is_veg", True),
            "is_available": food.get("is_available", False),
        })

    subtotal = round(subtotal, 2)
    delivery_fee = round(float(restaurant.get("delivery_fee", 35.0)), 2) if (restaurant and enriched_items) else 0.0
    tax_amount = round(subtotal * TAX_RATE, 2)
    total_amount = round(subtotal + delivery_fee + tax_amount, 2)

    return {
        "customer_id": customer_id,
        "restaurant_id": restaurant_id,
        "restaurant_name": restaurant["name"] if restaurant else None,
        "items": enriched_items,
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "item_count": total_qty,
    }


async def add_item_to_cart(customer_id: str, payload: CartAddItemRequest) -> Dict[str, Any]:
    db = get_database()
    food_oid = to_object_id(payload.food_item_id, "food_item_id")
    food = await db.food_items.find_one({"_id": food_oid})
    if not food:
        raise HTTPException(status_code=404, detail="Food item not found")
    if not food.get("is_available", False):
        raise HTTPException(status_code=400, detail="This food item is currently unavailable")

    restaurant = await db.restaurants.find_one({"_id": ObjectId(food["restaurant_id"]), "is_active": True})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant is not available")
    if not restaurant.get("is_open", True):
        raise HTTPException(status_code=400, detail="This restaurant is currently closed")

    cart = await db.carts.find_one({"customer_id": customer_id})
    now = utc_now()
    food_rest_id = food["restaurant_id"]

    if not cart or not cart.get("items"):
        await db.carts.update_one(
            {"customer_id": customer_id},
            {
                "$set": {
                    "customer_id": customer_id,
                    "restaurant_id": food_rest_id,
                    "items": [{"food_item_id": payload.food_item_id, "quantity": payload.quantity}],
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        return await compute_cart_details(customer_id)

    if cart.get("restaurant_id") and cart["restaurant_id"] != food_rest_id:
        if not payload.replace_cart:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Your cart contains items from another restaurant. Clear or replace your cart to add this item.",
            )
        await db.carts.update_one(
            {"customer_id": customer_id},
            {
                "$set": {
                    "restaurant_id": food_rest_id,
                    "items": [{"food_item_id": payload.food_item_id, "quantity": payload.quantity}],
                    "updated_at": now,
                }
            },
        )
        return await compute_cart_details(customer_id)

    items = cart.get("items", [])
    found = False
    for item in items:
        if item["food_item_id"] == payload.food_item_id:
            item["quantity"] = min(50, int(item["quantity"]) + payload.quantity)
            found = True
            break
    if not found:
        items.append({"food_item_id": payload.food_item_id, "quantity": payload.quantity})

    await db.carts.update_one(
        {"customer_id": customer_id},
        {"$set": {"restaurant_id": food_rest_id, "items": items, "updated_at": now}},
    )
    return await compute_cart_details(customer_id)


async def update_cart_item(customer_id: str, food_item_id: str, payload: CartUpdateItemRequest) -> Dict[str, Any]:
    db = get_database()
    to_object_id(food_item_id, "food_item_id")
    cart = await db.carts.find_one({"customer_id": customer_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart is empty")

    items = cart.get("items", [])
    if payload.quantity == 0:
        new_items = [i for i in items if i["food_item_id"] != food_item_id]
    else:
        food = await db.food_items.find_one({"_id": ObjectId(food_item_id)})
        if not food or not food.get("is_available", False):
            raise HTTPException(status_code=400, detail="Food item is unavailable")
        found = False
        new_items = []
        for i in items:
            if i["food_item_id"] == food_item_id:
                new_items.append({"food_item_id": food_item_id, "quantity": payload.quantity})
                found = True
            else:
                new_items.append(i)
        if not found:
            raise HTTPException(status_code=404, detail="Item not found in cart")

    rest_id = cart.get("restaurant_id") if new_items else None
    await db.carts.update_one(
        {"customer_id": customer_id},
        {"$set": {"items": new_items, "restaurant_id": rest_id, "updated_at": utc_now()}},
    )
    return await compute_cart_details(customer_id)


async def remove_cart_item(customer_id: str, food_item_id: str) -> Dict[str, Any]:
    return await update_cart_item(customer_id, food_item_id, CartUpdateItemRequest(quantity=0))


async def clear_cart(customer_id: str) -> None:
    db = get_database()
    await db.carts.update_one(
        {"customer_id": customer_id},
        {"$set": {"items": [], "restaurant_id": None, "updated_at": utc_now()}},
    )

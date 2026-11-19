"""Optional sample catalog seeder for DoorDelight development & demo."""
import asyncio
from app.database.mongodb import close_mongo_connection, connect_to_mongo, get_database
from app.models.enums import UserRole
from app.services.bootstrap import initialize_admin_and_defaults
from app.utils.security import hash_password
from app.utils.serializers import utc_now


async def seed():
    await connect_to_mongo()
    await initialize_admin_and_defaults()
    db = get_database()

    if await db.restaurants.count_documents({}) > 0:
        print("Restaurants already exist. Skipping sample seed.")
        await close_mongo_connection()
        return

    now = utc_now()
    cats = await db.food_categories.find({}).to_list(length=50)
    cat_by_slug = {c["slug"]: str(c["_id"]) for c in cats}

    # Create sample manager & delivery partner accounts for testing
    mgr_doc = {
        "name": "Aarav Sharma",
        "email": "manager@doordelight.com",
        "password_hash": hash_password("Manager@123"),
        "phone": "+91 9876500001",
        "role": UserRole.RESTAURANT_MANAGER.value,
        "is_active": True,
        "avatar_url": "",
        "dietary_preferences": [],
        "created_at": now,
        "updated_at": now,
    }
    mgr_res = await db.users.insert_one(mgr_doc)
    mgr_id = str(mgr_res.inserted_id)

    dp_doc = {
        "name": "Vikram Rao",
        "email": "delivery@doordelight.com",
        "password_hash": hash_password("Delivery@123"),
        "phone": "+91 9876500002",
        "role": UserRole.DELIVERY_PARTNER.value,
        "is_active": True,
        "avatar_url": "",
        "vehicle_number": "KA-01-DD-4092",
        "is_available_for_delivery": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(dp_doc)

    restaurants_data = [
        {
            "name": "Spice Route Kitchen",
            "description": "Authentic North Indian curries, dum biryanis, and smoky tandoori classics.",
            "cuisine": ["North Indian", "Biryani", "Tandoor"],
            "address": "42 Indiranagar 100 Feet Road",
            "city": "Bengaluru",
            "phone": "+91 8041234567",
            "image_url": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&auto=format&fit=crop",
            "opening_hours": {"open": "10:00", "close": "23:30"},
            "delivery_time_mins": 28,
            "delivery_fee": 35.0,
            "min_order_amount": 149.0,
            "is_open": True,
            "is_active": True,
            "is_featured": True,
            "manager_id": mgr_id,
            "rating": 4.7,
            "review_count": 124,
            "created_at": now,
            "updated_at": now,
        },
        {
            "name": "Napoli Woodfire Oven",
            "description": "Hand-stretched Neapolitan pizzas, creamy pastas, and artisanal garlic bread.",
            "cuisine": ["Pizza", "Italian"],
            "address": "18 Koramangala 4th Block",
            "city": "Bengaluru",
            "phone": "+91 8041234568",
            "image_url": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop",
            "opening_hours": {"open": "11:00", "close": "23:00"},
            "delivery_time_mins": 32,
            "delivery_fee": 40.0,
            "min_order_amount": 199.0,
            "is_open": True,
            "is_active": True,
            "is_featured": True,
            "manager_id": "",
            "rating": 4.6,
            "review_count": 98,
            "created_at": now,
            "updated_at": now,
        },
        {
            "name": "Urban Smash & Bowl",
            "description": "Juicy smash burgers, crispy wraps, and fresh protein-packed salad bowls.",
            "cuisine": ["Burgers", "Healthy", "Fast Food"],
            "address": "7 Church Street",
            "city": "Bengaluru",
            "phone": "+91 8041234569",
            "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop",
            "opening_hours": {"open": "09:30", "close": "23:00"},
            "delivery_time_mins": 22,
            "delivery_fee": 25.0,
            "min_order_amount": 99.0,
            "is_open": True,
            "is_active": True,
            "is_featured": True,
            "manager_id": "",
            "rating": 4.5,
            "review_count": 76,
            "created_at": now,
            "updated_at": now,
        },
    ]

    rest_res = await db.restaurants.insert_many(restaurants_data)
    r1, r2, r3 = [str(oid) for oid in rest_res.inserted_ids]

    foods_data = [
        {
            "restaurant_id": r1,
            "category_id": cat_by_slug.get("biryani-rice", ""),
            "name": "Hyderabadi Paneer Dum Biryani",
            "description": "Slow-cooked saffron basmati rice layered with spiced paneer and caramelized onions.",
            "price": 249.0,
            "image_url": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=700&auto=format&fit=crop",
            "is_veg": True,
            "is_available": True,
            "is_popular": True,
            "prep_time_mins": 20,
            "tags": ["biryani", "spicy", "vegetarian"],
            "rating": 4.8,
            "review_count": 45,
            "created_at": now,
            "updated_at": now,
        },
        {
            "restaurant_id": r1,
            "category_id": cat_by_slug.get("north-indian", ""),
            "name": "Butter Chicken & Garlic Naan",
            "description": "Velvety tomato-butter gravy with char-grilled chicken tikka and 2 butter garlic naans.",
            "price": 329.0,
            "image_url": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=700&auto=format&fit=crop",
            "is_veg": False,
            "is_available": True,
            "is_popular": True,
            "prep_time_mins": 22,
            "tags": ["curry", "naan", "bestseller"],
            "rating": 4.9,
            "review_count": 62,
            "created_at": now,
            "updated_at": now,
        },
        {
            "restaurant_id": r1,
            "category_id": cat_by_slug.get("north-indian", ""),
            "name": "Dal Makhani Bowl",
            "description": "24-hour simmered black lentils finished with cream and jeera rice.",
            "price": 179.0,
            "image_url": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=700&auto=format&fit=crop",
            "is_veg": True,
            "is_available": True,
            "is_popular": False,
            "prep_time_mins": 15,
            "tags": ["under-200", "vegetarian", "comfort"],
            "rating": 4.6,
            "review_count": 28,
            "created_at": now,
            "updated_at": now,
        },
        {
            "restaurant_id": r2,
            "category_id": cat_by_slug.get("pizza-italian", ""),
            "name": "Margherita Classica Pizza",
            "description": "San Marzano tomato sauce, fresh buffalo mozzarella, basil, and extra virgin olive oil.",
            "price": 279.0,
            "image_url": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=700&auto=format&fit=crop",
            "is_veg": True,
            "is_available": True,
            "is_popular": True,
            "prep_time_mins": 18,
            "tags": ["pizza", "vegetarian", "cheese"],
            "rating": 4.7,
            "review_count": 51,
            "created_at": now,
            "updated_at": now,
        },
        {
            "restaurant_id": r2,
            "category_id": cat_by_slug.get("pizza-italian", ""),
            "name": "Truffle Mushroom Alfredo Pasta",
            "description": "Penne tossed in creamy parmesan sauce with roasted mushrooms and herbs.",
            "price": 299.0,
            "image_url": "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=700&auto=format&fit=crop",
            "is_veg": True,
            "is_available": True,
            "is_popular": False,
            "prep_time_mins": 20,
            "tags": ["pasta", "vegetarian"],
            "rating": 4.5,
            "review_count": 22,
            "created_at": now,
            "updated_at": now,
        },
        {
            "restaurant_id": r3,
            "category_id": cat_by_slug.get("burgers-wraps", ""),
            "name": "Crispy Peri-Peri Paneer Burger",
            "description": "Crunchy spiced paneer patty, melted cheddar, jalapeno slaw on toasted brioche.",
            "price": 169.0,
            "image_url": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=700&auto=format&fit=crop",
            "is_veg": True,
            "is_available": True,
            "is_popular": True,
            "prep_time_mins": 14,
            "tags": ["burger", "under-200", "vegetarian"],
            "rating": 4.6,
            "review_count": 37,
            "created_at": now,
            "updated_at": now,
        },
        {
            "restaurant_id": r3,
            "category_id": cat_by_slug.get("healthy-salads", ""),
            "name": "Mediterranean Quinoa Power Bowl",
            "description": "Tri-color quinoa, roasted chickpeas, avocado, cherry tomatoes, and lemon-herb dressing.",
            "price": 195.0,
            "image_url": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=700&auto=format&fit=crop",
            "is_veg": True,
            "is_available": True,
            "is_popular": True,
            "prep_time_mins": 12,
            "tags": ["healthy", "salad", "under-200", "vegan"],
            "rating": 4.7,
            "review_count": 31,
            "created_at": now,
            "updated_at": now,
        },
        {
            "restaurant_id": r3,
            "category_id": cat_by_slug.get("desserts-beverages", ""),
            "name": "Belgian Dark Chocolate Brownie",
            "description": "Warm fudgy dark chocolate brownie drizzled with salted caramel.",
            "price": 129.0,
            "image_url": "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=700&auto=format&fit=crop",
            "is_veg": True,
            "is_available": True,
            "is_popular": False,
            "prep_time_mins": 8,
            "tags": ["dessert", "chocolate", "under-200"],
            "rating": 4.8,
            "review_count": 40,
            "created_at": now,
            "updated_at": now,
        },
    ]

    await db.food_items.insert_many(foods_data)
    print("Seeded 3 restaurants, 8 food items, 1 manager, and 1 delivery partner.")
    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(seed())

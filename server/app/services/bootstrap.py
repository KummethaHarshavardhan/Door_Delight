import logging
from app.config.settings import get_settings
from app.database.mongodb import get_database
from app.models.enums import UserRole
from app.utils.security import hash_password
from app.utils.serializers import utc_now

logger = logging.getLogger(__name__)

DEFAULT_CATEGORIES = [
    {"name": "Biryani & Rice", "slug": "biryani-rice", "icon": "Flame", "description": "Aromatic biryanis and rice bowls"},
    {"name": "Burgers & Wraps", "slug": "burgers-wraps", "icon": "Sandwich", "description": "Gourmet burgers, sliders, and wraps"},
    {"name": "Pizza & Italian", "slug": "pizza-italian", "icon": "Pizza", "description": "Wood-fired pizzas and artisan pasta"},
    {"name": "North Indian", "slug": "north-indian", "icon": "UtensilsCrossed", "description": "Rich curries, tandoori grills, and naan"},
    {"name": "South Indian", "slug": "south-indian", "icon": "Coffee", "description": "Crispy dosas, idlis, and filter coffee"},
    {"name": "Chinese & Asian", "slug": "chinese-asian", "icon": "Soup", "description": "Wok-tossed noodles, dim sum, and bowls"},
    {"name": "Healthy & Salads", "slug": "healthy-salads", "icon": "Salad", "description": "Fresh salads, smoothie bowls, and protein meals"},
    {"name": "Desserts & Beverages", "slug": "desserts-beverages", "icon": "IceCream", "description": "Cakes, shakes, ice cream, and mocktails"},
]


async def initialize_admin_and_defaults() -> None:
    """Create initial admin from environment variables and ensure default food categories."""
    settings = get_settings()
    db = get_database()

    if settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD:
        admin_email = settings.ADMIN_EMAIL.strip().lower()
        existing_admin = await db.users.find_one({"email": admin_email})
        if not existing_admin:
            now = utc_now()
            await db.users.insert_one({
                "name": "DoorDelight Admin",
                "email": admin_email,
                "password_hash": hash_password(settings.ADMIN_PASSWORD),
                "phone": "",
                "role": UserRole.ADMIN.value,
                "is_active": True,
                "avatar_url": "",
                "dietary_preferences": [],
                "created_at": now,
                "updated_at": now,
            })
            logger.info("Initial ADMIN user created for %s.", admin_email)
        else:
            logger.info("Initial ADMIN user already exists.")
    else:
        logger.warning("ADMIN_EMAIL or ADMIN_PASSWORD not set; skipping initial admin creation.")

    # Ensure baseline food categories exist so restaurants/menus can be categorized immediately
    existing_cat_count = await db.food_categories.count_documents({})
    if existing_cat_count == 0:
        now = utc_now()
        docs = [{**cat, "is_active": True, "created_at": now, "updated_at": now} for cat in DEFAULT_CATEGORIES]
        await db.food_categories.insert_many(docs)
        logger.info("Seeded %d default food categories.", len(docs))

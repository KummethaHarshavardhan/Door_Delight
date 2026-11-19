import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages the async Motor MongoDB client and database lifecycle."""

    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None


db_manager = DatabaseManager()


async def connect_to_mongo() -> None:
    """Initialize MongoDB connection and create required indexes."""
    settings = get_settings()
    logger.info("Connecting to MongoDB...")
    db_manager.client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        serverSelectionTimeoutMS=5000,
    )
    db_manager.db = db_manager.client[settings.MONGODB_DB_NAME]
    await db_manager.client.admin.command("ping")
    logger.info("Connected to MongoDB database '%s'.", settings.MONGODB_DB_NAME)
    await create_indexes(db_manager.db)


async def close_mongo_connection() -> None:
    """Close MongoDB client connection."""
    if db_manager.client is not None:
        db_manager.client.close()
        db_manager.client = None
        db_manager.db = None
        logger.info("MongoDB connection closed.")


def get_database() -> AsyncIOMotorDatabase:
    """Return active database instance."""
    if db_manager.db is None:
        raise RuntimeError("Database is not initialized. Call connect_to_mongo() first.")
    return db_manager.db


async def create_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create indexes for all DoorDelight collections."""
    # Users
    await db.users.create_index([("email", ASCENDING)], unique=True)
    await db.users.create_index([("role", ASCENDING)])

    # Restaurants
    await db.restaurants.create_index([("manager_id", ASCENDING)])
    await db.restaurants.create_index([("is_active", ASCENDING), ("is_open", ASCENDING)])
    await db.restaurants.create_index([("name", "text"), ("cuisine", "text"), ("description", "text")])

    # Food categories
    await db.food_categories.create_index([("slug", ASCENDING)], unique=True)

    # Food items
    await db.food_items.create_index([("restaurant_id", ASCENDING), ("is_available", ASCENDING)])
    await db.food_items.create_index([("category_id", ASCENDING)])
    await db.food_items.create_index([("name", "text"), ("description", "text")])

    # Carts
    await db.carts.create_index([("customer_id", ASCENDING)], unique=True)

    # Addresses
    await db.addresses.create_index([("customer_id", ASCENDING)])

    # Orders
    await db.orders.create_index([("customer_id", ASCENDING), ("created_at", DESCENDING)])
    await db.orders.create_index([("restaurant_id", ASCENDING), ("status", ASCENDING)])
    await db.orders.create_index([("delivery_partner_id", ASCENDING), ("status", ASCENDING)])
    await db.orders.create_index([("order_number", ASCENDING)], unique=True)

    # Payments
    await db.payments.create_index([("order_id", ASCENDING)])
    await db.payments.create_index([("razorpay_order_id", ASCENDING)], sparse=True)
    await db.payments.create_index([("idempotency_key", ASCENDING)], unique=True, sparse=True)

    # Reviews
    await db.reviews.create_index([("food_item_id", ASCENDING), ("created_at", DESCENDING)])
    await db.reviews.create_index([("restaurant_id", ASCENDING)])
    await db.reviews.create_index([("customer_id", ASCENDING), ("order_id", ASCENDING), ("food_item_id", ASCENDING)], unique=True)

    # Delivery assignments
    await db.delivery_assignments.create_index([("order_id", ASCENDING)], unique=True)
    await db.delivery_assignments.create_index([("delivery_partner_id", ASCENDING), ("status", ASCENDING)])

    # Notifications
    await db.notifications.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])

    # Delivery Partner KYC
    await db.delivery_partner_kyc.create_index([("partner_id", ASCENDING)], unique=True)
    await db.delivery_partner_kyc.create_index([("kyc_status", ASCENDING)])

    # Delivery Earnings (1 immutable record per delivered order)
    await db.delivery_earnings.create_index([("order_id", ASCENDING)], unique=True)
    await db.delivery_earnings.create_index([("delivery_partner_id", ASCENDING), ("created_at", DESCENDING)])
    await db.delivery_earnings.create_index([("payout_status", ASCENDING)])

    # Delivery Payouts Ledger
    await db.delivery_payouts.create_index([("transaction_reference", ASCENDING)], unique=True, sparse=True)
    await db.delivery_payouts.create_index([("idempotency_key", ASCENDING)], unique=True, sparse=True)
    await db.delivery_payouts.create_index([("delivery_partner_id", ASCENDING), ("created_at", DESCENDING)])

    # Delivery Rate Configuration
    await db.delivery_rate_config.create_index([("config_key", ASCENDING)], unique=True)

    # COD Incidents
    await db.cod_incidents.create_index([("order_id", ASCENDING)], unique=True)
    await db.cod_incidents.create_index([("delivery_partner_id", ASCENDING), ("status", ASCENDING)])

    # Delivery Audit Logs
    await db.delivery_audit_logs.create_index([("entity_id", ASCENDING), ("created_at", DESCENDING)])

    # COD Collections & Settlements
    await db.cod_collections.create_index([("order_id", ASCENDING)], unique=True)
    await db.cod_collections.create_index([("delivery_partner_id", ASCENDING), ("restaurant_id", ASCENDING)])
    await db.cod_settlements.create_index([("transaction_reference", ASCENDING)], unique=True)
    await db.cod_settlements.create_index([("idempotency_key", ASCENDING)], unique=True, sparse=True)
    await db.cod_settlements.create_index([("delivery_partner_id", ASCENDING), ("restaurant_id", ASCENDING)])
    await db.cod_reminder_history.create_index(
        [("delivery_partner_id", ASCENDING), ("restaurant_id", ASCENDING), ("reminder_day", ASCENDING), ("period_key", ASCENDING)],
        unique=True,
    )
    await db.partner_restrictions.create_index([("delivery_partner_id", ASCENDING)], unique=True)
    logger.info("MongoDB indexes ensured.")

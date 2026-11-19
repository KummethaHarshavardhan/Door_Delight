import asyncio
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config.settings import get_settings
from app.database.mongodb import close_mongo_connection, connect_to_mongo, get_database
from app.middleware.rate_limit import limiter
from app.routes import (
    addresses,
    admin,
    ai,
    auth,
    cart,
    categories,
    cod,
    customers,
    delivery,
    foods,
    kyc,
    manager,
    notifications,
    orders,
    payments,
    payouts,
    restaurants,
    reviews,
    ws,
)
from app.services.bootstrap import initialize_admin_and_defaults
from app.services.cod_settlement_service import run_cod_reminder_and_overdue_check

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def _cod_reminder_loop():
    while True:
        try:
            await run_cod_reminder_and_overdue_check()
        except Exception:
            logger.exception("COD reminder scheduler iteration failed")
        await asyncio.sleep(6 * 3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    await connect_to_mongo()
    await initialize_admin_and_defaults()
    reminder_task = asyncio.create_task(_cod_reminder_loop())
    yield
    reminder_task.cancel()
    await close_mongo_connection()


settings = get_settings()
app = FastAPI(
    title="DoorDelight API",
    description="Production-style full-stack food delivery platform backend",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    headers = {}
    origin = request.headers.get("origin")
    if origin and origin in settings.cors_origins:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred"},
        headers=headers,
    )


@app.get("/api/health", tags=["Health"])
async def health_check():
    db = get_database()
    await db.command("ping")
    return {"status": "healthy", "service": "doordelight-api"}


app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(categories.router)
app.include_router(restaurants.router)
app.include_router(foods.router)
app.include_router(cart.router)
app.include_router(addresses.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(manager.router)
app.include_router(delivery.router)
app.include_router(kyc.router)
app.include_router(payouts.router)
app.include_router(cod.router)
app.include_router(admin.router)
app.include_router(reviews.router)
app.include_router(notifications.router)
app.include_router(ai.router)
app.include_router(ws.router)

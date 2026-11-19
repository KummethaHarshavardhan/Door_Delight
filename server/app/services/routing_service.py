import logging
from typing import Optional, Tuple
import httpx

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


async def geocode_address_text(address_text: str) -> Optional[Tuple[float, float]]:
    """Resolve address text to (lat, lng) using Nominatim if coordinates are not stored."""
    if not address_text or not address_text.strip():
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": address_text.strip(), "format": "json", "limit": 1},
                headers={"User-Agent": "DoorDelight/1.0"},
            )
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) > 0:
                    return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as exc:
        logger.warning("Geocoding failed: %s", type(exc).__name__)
    return None


async def calculate_road_distance_km(
    origin_lat: Optional[float],
    origin_lng: Optional[float],
    dest_lat: Optional[float],
    dest_lng: Optional[float],
) -> Tuple[Optional[float], str]:
    """
    Calculate actual road route distance in KM using OpenRouteService (if configured) or OSRM.
    Never returns straight-line Haversine distance or invented numbers.
    Returns (distance_km, provider_name) or (None, 'UNAVAILABLE').
    """
    if None in (origin_lat, origin_lng, dest_lat, dest_lng):
        return None, "UNAVAILABLE"

    settings = get_settings()

    # 1. Try OpenRouteService if ORS_API_KEY is configured
    if settings.ORS_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.openrouteservice.org/v2/directions/driving-car",
                    params={
                        "start": f"{origin_lng},{origin_lat}",
                        "end": f"{dest_lng},{dest_lat}",
                    },
                    headers={"Authorization": settings.ORS_API_KEY},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    meters = data["features"][0]["properties"]["summary"]["distance"]
                    return round(float(meters) / 1000.0, 2), "OPENROUTESERVICE"
        except Exception as exc:
            logger.warning("OpenRouteService routing failed: %s", type(exc).__name__)

    # 2. Try configured OSRM routing server
    osrm_base = (settings.OSRM_BASE_URL or "https://router.project-osrm.org").rstrip("/")
    try:
        url = f"{osrm_base}/route/v1/driving/{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params={"overview": "false"})
            if resp.status_code == 200:
                data = resp.json()
                routes = data.get("routes") or []
                if routes:
                    meters = routes[0]["distance"]
                    return round(float(meters) / 1000.0, 2), "OSRM"
    except Exception as exc:
        logger.warning("OSRM routing failed: %s", type(exc).__name__)

    return None, "UNAVAILABLE"

from typing import Any, Dict, Optional
from app.database.mongodb import get_database
from app.utils.serializers import utc_now


async def log_delivery_audit(
    action: str,
    entity_type: str,
    entity_id: str,
    actor_id: str,
    actor_role: str,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Persist an immutable audit log entry without sensitive identity or bank numbers."""
    db = get_database()
    await db.delivery_audit_logs.insert_one({
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "actor_id": actor_id,
        "actor_role": actor_role,
        "details": details or {},
        "created_at": utc_now(),
    })

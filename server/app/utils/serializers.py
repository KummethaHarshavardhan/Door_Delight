from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status


def utc_now() -> datetime:
    """Return current UTC datetime."""
    return datetime.now(timezone.utc)


def to_object_id(id_str: str, field_name: str = "id") -> ObjectId:
    """Validate and convert string to MongoDB ObjectId."""
    if not ObjectId.is_valid(id_str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field_name} format",
        )
    return ObjectId(id_str)


def serialize_doc(doc: Optional[Dict[str, Any]], exclude: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
    """Convert MongoDB document ObjectIds and datetimes into JSON-safe values."""
    if doc is None:
        return None
    excluded = set(exclude or [])
    result: Dict[str, Any] = {}
    for key, value in doc.items():
        if key in excluded:
            continue
        if key == "_id":
            result["id"] = str(value)
        elif isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, list):
            result[key] = [
                serialize_doc(item) if isinstance(item, dict)
                else (str(item) if isinstance(item, ObjectId) else (item.isoformat() if isinstance(item, datetime) else item))
                for item in value
            ]
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        else:
            result[key] = value
    return result


def serialize_docs(docs: List[Dict[str, Any]], exclude: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Serialize a list of MongoDB documents."""
    return [serialize_doc(d, exclude=exclude) for d in docs if d is not None]

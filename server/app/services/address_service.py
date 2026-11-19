from typing import Any, Dict, List
from fastapi import HTTPException

from app.database.mongodb import get_database
from app.schemas.customer import AddressCreateRequest, AddressUpdateRequest
from app.utils.serializers import serialize_doc, serialize_docs, to_object_id, utc_now


async def list_addresses(customer_id: str) -> List[Dict[str, Any]]:
    db = get_database()
    docs = await db.addresses.find({"customer_id": customer_id}).sort([("is_default", -1), ("created_at", -1)]).to_list(length=50)
    return serialize_docs(docs)


async def create_address(customer_id: str, payload: AddressCreateRequest) -> Dict[str, Any]:
    db = get_database()
    now = utc_now()
    existing_count = await db.addresses.count_documents({"customer_id": customer_id})
    is_default = payload.is_default or existing_count == 0

    if is_default:
        await db.addresses.update_many({"customer_id": customer_id}, {"$set": {"is_default": False}})

    doc = {
        "customer_id": customer_id,
        "label": payload.label.strip(),
        "street": payload.street.strip(),
        "landmark": payload.landmark.strip(),
        "city": payload.city.strip(),
        "state": payload.state.strip(),
        "pincode": payload.pincode.strip(),
        "phone": payload.phone.strip(),
        "lat": payload.lat,
        "lng": payload.lng,
        "is_default": is_default,
        "created_at": now,
        "updated_at": now,
    }
    res = await db.addresses.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc)


async def update_address(customer_id: str, address_id: str, payload: AddressUpdateRequest) -> Dict[str, Any]:
    db = get_database()
    oid = to_object_id(address_id, "address_id")
    existing = await db.addresses.find_one({"_id": oid, "customer_id": customer_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Address not found")

    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if updates.get("is_default"):
        await db.addresses.update_many({"customer_id": customer_id}, {"$set": {"is_default": False}})
    updates["updated_at"] = utc_now()
    await db.addresses.update_one({"_id": oid}, {"$set": updates})
    doc = await db.addresses.find_one({"_id": oid})
    return serialize_doc(doc)


async def delete_address(customer_id: str, address_id: str) -> None:
    db = get_database()
    oid = to_object_id(address_id, "address_id")
    res = await db.addresses.delete_one({"_id": oid, "customer_id": customer_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Address not found")

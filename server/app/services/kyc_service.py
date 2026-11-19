import os
import uuid
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, UploadFile

from app.config.settings import get_settings
from app.database.mongodb import get_database
from app.models.enums import KYCStatus, UserRole
from app.services.audit_service import log_delivery_audit
from app.utils.encryption import (
    decrypt_sensitive,
    encrypt_sensitive,
    mask_aadhaar,
    mask_bank_account,
    mask_pan,
)
from app.utils.serializers import serialize_doc, serialize_docs, to_object_id, utc_now

ALLOWED_KYC_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_KYC_FILE_BYTES = 5 * 1024 * 1024  # 5MB


async def save_private_kyc_file(partner_id: str, doc_type: str, file: UploadFile) -> str:
    """Validate and save KYC document in private non-public storage."""
    if file.content_type not in ALLOWED_KYC_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type for {doc_type}. Allowed: JPEG, PNG, WEBP, PDF",
        )
    contents = await file.read()
    if not contents or len(contents) > MAX_KYC_FILE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"{doc_type} must be non-empty and under 5MB",
        )

    settings = get_settings()
    target_dir = os.path.join(settings.PRIVATE_KYC_DIR, partner_id)
    os.makedirs(target_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "doc.bin")[1] or ".bin"
    filename = f"{doc_type}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(target_dir, filename)

    with open(filepath, "wb") as f:
        f.write(contents)
    return filepath


def format_kyc_public_view(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Return KYC record with masked sensitive fields and never raw encrypted tokens."""
    if not doc:
        return None
    raw_aadhaar = decrypt_sensitive(doc.get("aadhaar_encrypted", ""))
    raw_pan = decrypt_sensitive(doc.get("pan_encrypted", ""))
    raw_acct = decrypt_sensitive(doc.get("bank_account_encrypted", ""))
    raw_ifsc = decrypt_sensitive(doc.get("ifsc_encrypted", ""))

    return {
        "id": str(doc["_id"]),
        "partner_id": doc["partner_id"],
        "full_name": doc.get("full_name", ""),
        "mobile_number": doc.get("mobile_number", ""),
        "email": doc.get("email", ""),
        "address": doc.get("address", ""),
        "bank_holder_name": doc.get("bank_holder_name", ""),
        "aadhaar_masked": mask_aadhaar(raw_aadhaar),
        "pan_masked": mask_pan(raw_pan),
        "bank_account_masked": mask_bank_account(raw_acct),
        "ifsc_code": raw_ifsc,
        "has_profile_photo": bool(doc.get("profile_photo_path")),
        "has_aadhaar_doc": bool(doc.get("aadhaar_doc_path")),
        "has_pan_doc": bool(doc.get("pan_doc_path")),
        "consent_accepted": bool(doc.get("consent_accepted")),
        "kyc_status": doc.get("kyc_status", KYCStatus.NOT_SUBMITTED.value),
        "rejection_reason": doc.get("rejection_reason", ""),
        "reviewed_by": doc.get("reviewed_by", ""),
        "reviewed_at": doc.get("reviewed_at").isoformat() if doc.get("reviewed_at") else None,
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        "updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else None,
    }


async def submit_or_update_kyc(
    partner_id: str,
    actor: Dict[str, Any],
    full_name: str,
    mobile_number: str,
    email: str,
    address: str,
    aadhaar_number: str,
    pan_number: str,
    bank_holder_name: str,
    bank_account_number: str,
    ifsc_code: str,
    consent_accepted: bool,
    profile_photo: Optional[UploadFile] = None,
    aadhaar_doc: Optional[UploadFile] = None,
    pan_doc: Optional[UploadFile] = None,
) -> Dict[str, Any]:
    if not consent_accepted:
        raise HTTPException(
            status_code=400,
            detail="Explicit consent is required to collect and process KYC documents",
        )

    db = get_database()
    partner_oid = to_object_id(partner_id, "partner_id")
    partner = await db.users.find_one({"_id": partner_oid, "role": UserRole.DELIVERY_PARTNER.value})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")

    existing = await db.delivery_partner_kyc.find_one({"partner_id": partner_id})
    now = utc_now()

    photo_path = existing.get("profile_photo_path", "") if existing else ""
    aadhaar_path = existing.get("aadhaar_doc_path", "") if existing else ""
    pan_path = existing.get("pan_doc_path", "") if existing else ""

    if profile_photo:
        photo_path = await save_private_kyc_file(partner_id, "profile_photo", profile_photo)
    if aadhaar_doc:
        aadhaar_path = await save_private_kyc_file(partner_id, "aadhaar_doc", aadhaar_doc)
    if pan_doc:
        pan_path = await save_private_kyc_file(partner_id, "pan_doc", pan_doc)

    if not photo_path or not aadhaar_path or not pan_path:
        raise HTTPException(
            status_code=400,
            detail="Profile photo, Aadhaar document, and PAN card document are all required",
        )

    kyc_doc = {
        "partner_id": partner_id,
        "full_name": full_name.strip(),
        "mobile_number": mobile_number.strip(),
        "email": email.strip().lower(),
        "address": address.strip(),
        "aadhaar_encrypted": encrypt_sensitive(aadhaar_number),
        "pan_encrypted": encrypt_sensitive(pan_number.upper()),
        "bank_holder_name": bank_holder_name.strip(),
        "bank_account_encrypted": encrypt_sensitive(bank_account_number),
        "ifsc_encrypted": encrypt_sensitive(ifsc_code.upper()),
        "profile_photo_path": photo_path,
        "aadhaar_doc_path": aadhaar_path,
        "pan_doc_path": pan_path,
        "consent_accepted": True,
        "consent_timestamp": now,
        "kyc_status": KYCStatus.PENDING_VERIFICATION.value,
        "rejection_reason": "",
        "updated_at": now,
    }

    await db.delivery_partner_kyc.update_one(
        {"partner_id": partner_id},
        {"$set": kyc_doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    await db.users.update_one(
        {"_id": partner_oid},
        {"$set": {"kyc_status": KYCStatus.PENDING_VERIFICATION.value, "updated_at": now}},
    )

    await log_delivery_audit(
        action="KYC_SUBMITTED",
        entity_type="DELIVERY_PARTNER_KYC",
        entity_id=partner_id,
        actor_id=actor["id"],
        actor_role=actor["role"],
        details={"status": KYCStatus.PENDING_VERIFICATION.value},
    )

    saved = await db.delivery_partner_kyc.find_one({"partner_id": partner_id})
    return format_kyc_public_view(saved)


async def list_all_kyc_records(status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    db = get_database()
    query = {"kyc_status": status_filter} if status_filter else {}
    docs = await db.delivery_partner_kyc.find(query).sort("updated_at", -1).to_list(length=300)
    return [format_kyc_public_view(d) for d in docs]


async def review_kyc_record(
    partner_id: str,
    target_status: KYCStatus,
    rejection_reason: str,
    admin_user: Dict[str, Any],
) -> Dict[str, Any]:
    if target_status in {KYCStatus.REJECTED, KYCStatus.RESUBMISSION_REQUIRED} and not rejection_reason.strip():
        raise HTTPException(
            status_code=400,
            detail="A rejection or resubmission reason is required",
        )
    if target_status not in {KYCStatus.APPROVED, KYCStatus.REJECTED, KYCStatus.RESUBMISSION_REQUIRED}:
        raise HTTPException(status_code=400, detail="Invalid KYC review status")

    db = get_database()
    partner_oid = to_object_id(partner_id, "partner_id")
    existing = await db.delivery_partner_kyc.find_one({"partner_id": partner_id})
    if not existing:
        raise HTTPException(status_code=404, detail="KYC record not found for this partner")

    now = utc_now()
    await db.delivery_partner_kyc.update_one(
        {"partner_id": partner_id},
        {
            "$set": {
                "kyc_status": target_status.value,
                "rejection_reason": rejection_reason.strip() if target_status != KYCStatus.APPROVED else "",
                "reviewed_by": admin_user["id"],
                "reviewed_at": now,
                "updated_at": now,
            }
        },
    )
    user_updates: Dict[str, Any] = {"kyc_status": target_status.value, "updated_at": now}
    if target_status != KYCStatus.APPROVED:
        user_updates["is_online"] = False
        user_updates["delivery_status"] = "OFFLINE"

    await db.users.update_one({"_id": partner_oid}, {"$set": user_updates})

    await log_delivery_audit(
        action=f"KYC_{target_status.value}",
        entity_type="DELIVERY_PARTNER_KYC",
        entity_id=partner_id,
        actor_id=admin_user["id"],
        actor_role=admin_user["role"],
        details={"reason": rejection_reason.strip()},
    )

    updated = await db.delivery_partner_kyc.find_one({"partner_id": partner_id})
    return format_kyc_public_view(updated)


def _normalize_kyc_status(raw_status: Any) -> Optional[str]:
    if not isinstance(raw_status, str):
        return None
    normalized = raw_status.strip().upper()
    valid_values = {item.value for item in KYCStatus}
    return normalized if normalized in valid_values else None


async def resolve_partner_kyc_status(
    partner_id: str,
    user_doc: Optional[Dict[str, Any]] = None,
) -> tuple[str, Optional[Dict[str, Any]]]:
    """
    Resolve the authoritative KYC status from delivery_partner_kyc (primary source of truth)
    and keep db.users.kyc_status synchronized without modifying submitted KYC documents.
    """
    db = get_database()
    kyc_doc = await db.delivery_partner_kyc.find_one({"partner_id": partner_id})
    doc_status = _normalize_kyc_status(kyc_doc.get("kyc_status")) if kyc_doc else None
    user_status = _normalize_kyc_status(user_doc.get("kyc_status")) if user_doc else None

    authoritative_status = doc_status or user_status or KYCStatus.NOT_SUBMITTED.value

    if user_doc is not None and user_status != authoritative_status and ObjectId.is_valid(partner_id):
        await db.users.update_one(
            {"_id": ObjectId(partner_id)},
            {"$set": {"kyc_status": authoritative_status, "updated_at": utc_now()}},
        )

    return authoritative_status, kyc_doc


async def get_kyc_document_path(partner_id: str, doc_type: str, actor: Dict[str, Any]) -> str:
    db = get_database()
    doc = await db.delivery_partner_kyc.find_one({"partner_id": partner_id})
    if not doc:
        raise HTTPException(status_code=404, detail="KYC record not found")

    field_map = {
        "profile_photo": "profile_photo_path",
        "aadhaar_doc": "aadhaar_doc_path",
        "pan_doc": "pan_doc_path",
    }
    if doc_type not in field_map:
        raise HTTPException(status_code=400, detail="Invalid document type")

    filepath = doc.get(field_map[doc_type], "")
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Document file not found")

    await log_delivery_audit(
        action="KYC_DOCUMENT_ACCESSED",
        entity_type="DELIVERY_PARTNER_KYC",
        entity_id=partner_id,
        actor_id=actor["id"],
        actor_role=actor["role"],
        details={"doc_type": doc_type},
    )
    return filepath

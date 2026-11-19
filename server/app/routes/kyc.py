from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.database.mongodb import get_database
from app.middleware.auth import require_roles
from app.models.enums import KYCStatus, UserRole
from app.services.kyc_service import (
    format_kyc_public_view,
    get_kyc_document_path,
    list_all_kyc_records,
    resolve_partner_kyc_status,
    review_kyc_record,
    submit_or_update_kyc,
)

router = APIRouter(tags=["Delivery Partner KYC"])


class KYCReviewRequest(BaseModel):
    kyc_status: KYCStatus
    rejection_reason: str = Field(default="", max_length=400)


@router.get("/api/kyc/me")
async def get_my_kyc(
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.DELIVERY_PARTNER)),
) -> Dict[str, Any]:
    authoritative_status, doc = await resolve_partner_kyc_status(current_user["id"], current_user)
    return {
        "kyc": format_kyc_public_view(doc),
        "kyc_status": authoritative_status,
    }


@router.post("/api/kyc/submit")
async def submit_my_kyc(
    full_name: str = Form(...),
    mobile_number: str = Form(...),
    email: str = Form(...),
    address: str = Form(...),
    aadhaar_number: str = Form(...),
    pan_number: str = Form(...),
    bank_holder_name: str = Form(...),
    bank_account_number: str = Form(...),
    ifsc_code: str = Form(...),
    consent_accepted: bool = Form(...),
    profile_photo: Optional[UploadFile] = File(default=None),
    aadhaar_doc: Optional[UploadFile] = File(default=None),
    pan_doc: Optional[UploadFile] = File(default=None),
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.DELIVERY_PARTNER)),
) -> Dict[str, Any]:
    kyc = await submit_or_update_kyc(
        partner_id=current_user["id"],
        actor=current_user,
        full_name=full_name,
        mobile_number=mobile_number,
        email=email,
        address=address,
        aadhaar_number=aadhaar_number,
        pan_number=pan_number,
        bank_holder_name=bank_holder_name,
        bank_account_number=bank_account_number,
        ifsc_code=ifsc_code,
        consent_accepted=consent_accepted,
        profile_photo=profile_photo,
        aadhaar_doc=aadhaar_doc,
        pan_doc=pan_doc,
    )
    return {"kyc": kyc}


@router.post("/api/admin/kyc/{partner_id}")
async def admin_submit_partner_kyc(
    partner_id: str,
    full_name: str = Form(...),
    mobile_number: str = Form(...),
    email: str = Form(...),
    address: str = Form(...),
    aadhaar_number: str = Form(...),
    pan_number: str = Form(...),
    bank_holder_name: str = Form(...),
    bank_account_number: str = Form(...),
    ifsc_code: str = Form(...),
    consent_accepted: bool = Form(...),
    profile_photo: Optional[UploadFile] = File(default=None),
    aadhaar_doc: Optional[UploadFile] = File(default=None),
    pan_doc: Optional[UploadFile] = File(default=None),
    current_admin: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    kyc = await submit_or_update_kyc(
        partner_id=partner_id,
        actor=current_admin,
        full_name=full_name,
        mobile_number=mobile_number,
        email=email,
        address=address,
        aadhaar_number=aadhaar_number,
        pan_number=pan_number,
        bank_holder_name=bank_holder_name,
        bank_account_number=bank_account_number,
        ifsc_code=ifsc_code,
        consent_accepted=consent_accepted,
        profile_photo=profile_photo,
        aadhaar_doc=aadhaar_doc,
        pan_doc=pan_doc,
    )
    return {"kyc": kyc}


@router.get("/api/admin/kyc")
async def admin_list_kyc(
    kyc_status: Optional[str] = Query(default=None),
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    records = await list_all_kyc_records(status_filter=kyc_status)
    return {"records": records}


@router.post("/api/admin/kyc/{partner_id}/review")
async def admin_review_kyc(
    partner_id: str,
    payload: KYCReviewRequest,
    current_admin: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    kyc = await review_kyc_record(
        partner_id=partner_id,
        target_status=payload.kyc_status,
        rejection_reason=payload.rejection_reason,
        admin_user=current_admin,
    )
    return {"kyc": kyc}


@router.get("/api/admin/kyc/{partner_id}/documents/{doc_type}")
async def admin_download_kyc_doc(
    partner_id: str,
    doc_type: str,
    current_admin: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
):
    filepath = await get_kyc_document_path(partner_id, doc_type, current_admin)
    return FileResponse(filepath)

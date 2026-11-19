from typing import Any, Dict
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field

from app.middleware.auth import require_roles
from app.models.enums import UserRole
from app.services.cod_service import list_cod_incidents, resolve_cod_incident
from app.services.cod_settlement_service import (
    admin_restore_partner_account,
    admin_verify_cod_settlement,
    export_cod_settlements_csv,
    get_admin_cod_settlements,
    run_cod_reminder_and_overdue_check,
)

router = APIRouter(tags=["Admin COD Protection & Settlements"])


class ResolveCODIncidentRequest(BaseModel):
    resolution_note: str = Field(..., min_length=3, max_length=500)


class VerifySettlementRequest(BaseModel):
    approve: bool
    note: str = Field(default="", max_length=400)


class RestorePartnerRequest(BaseModel):
    note: str = Field(default="Restored by administrator", max_length=400)


@router.get("/api/admin/cod-incidents")
async def admin_list_cod_incidents(
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    incidents = await list_cod_incidents()
    return {"incidents": incidents}


@router.put("/api/admin/cod-incidents/{incident_id}/resolve")
async def admin_resolve_cod_incident(
    incident_id: str,
    payload: ResolveCODIncidentRequest,
    current_admin: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    incident = await resolve_cod_incident(
        incident_id=incident_id,
        resolution_note=payload.resolution_note,
        admin_user=current_admin,
    )
    return {"incident": incident}


@router.get("/api/admin/cod-settlements")
async def admin_cod_settlements(
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    return await get_admin_cod_settlements()


@router.post("/api/admin/cod-settlements/{settlement_id}/verify")
async def admin_verify_settlement(
    settlement_id: str,
    payload: VerifySettlementRequest,
    current_admin: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    settlement = await admin_verify_cod_settlement(
        settlement_id=settlement_id,
        approve=payload.approve,
        note=payload.note,
        admin_user=current_admin,
    )
    return {"settlement": settlement}


@router.post("/api/admin/cod-partners/{partner_id}/restore")
async def admin_restore_partner(
    partner_id: str,
    payload: RestorePartnerRequest,
    current_admin: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    return await admin_restore_partner_account(
        partner_id=partner_id,
        note=payload.note,
        admin_user=current_admin,
    )


@router.post("/api/admin/cod-reminders/run")
async def trigger_cod_reminder_check(
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    return await run_cod_reminder_and_overdue_check()


@router.get("/api/admin/cod-settlements/export")
async def download_cod_settlements_csv(
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
):
    csv_data = await export_cod_settlements_csv()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=doordelight-cod-settlements.csv"},
    )

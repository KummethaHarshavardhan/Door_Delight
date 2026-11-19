from typing import Any, Dict
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field

from app.middleware.auth import require_roles
from app.models.enums import UserRole
from app.services.earnings_service import get_rate_config, update_rate_config
from app.services.payout_service import (
    export_payouts_csv,
    get_admin_payout_overview,
    process_manual_payout,
)

router = APIRouter(prefix="/api/admin", tags=["Admin Payouts & Rates"])


class RateConfigUpdateRequest(BaseModel):
    base_amount: float = Field(..., ge=0, le=5000)
    per_km_rate: float = Field(..., ge=0, le=500)
    minimum_payout: float = Field(..., ge=0, le=5000)
    default_incentive: float = Field(default=0.0, ge=0, le=2000)


class ProcessPayoutRequest(BaseModel):
    partner_id: str
    amount: float = Field(..., gt=0)
    transaction_reference: str = Field(..., min_length=3, max_length=120)
    payment_method: str = Field(default="BANK_TRANSFER", max_length=40)
    notes: str = Field(default="", max_length=300)
    idempotency_key: str = Field(default="", max_length=120)


@router.get("/delivery-rates")
async def get_delivery_rates(
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    return {"rates": await get_rate_config()}


@router.put("/delivery-rates")
async def save_delivery_rates(
    payload: RateConfigUpdateRequest,
    current_admin: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    rates = await update_rate_config(
        base_amount=payload.base_amount,
        per_km_rate=payload.per_km_rate,
        minimum_payout=payload.minimum_payout,
        default_incentive=payload.default_incentive,
        admin_user=current_admin,
    )
    return {"rates": rates}


@router.get("/payouts/summary")
async def get_payouts_summary(
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    return await get_admin_payout_overview()


@router.post("/payouts")
async def create_payout(
    payload: ProcessPayoutRequest,
    current_admin: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
) -> Dict[str, Any]:
    payout = await process_manual_payout(
        partner_id=payload.partner_id,
        amount=payload.amount,
        transaction_reference=payload.transaction_reference,
        payment_method=payload.payment_method,
        notes=payload.notes,
        idempotency_key=payload.idempotency_key,
        admin_user=current_admin,
    )
    return {"payout": payout}


@router.get("/payouts/export")
async def download_payouts_csv(
    _: Dict[str, Any] = Depends(require_roles(UserRole.ADMIN)),
):
    csv_data = await export_payouts_csv()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=doordelight-payouts.csv"},
    )

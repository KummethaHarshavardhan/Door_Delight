import pytest
from app.main import app
from app.models.enums import ALLOWED_STATUS_TRANSITIONS, KYCStatus, OrderStatus, PaymentStatus
from app.services.routing_service import calculate_road_distance_km
from app.utils.encryption import (
    decrypt_sensitive,
    encrypt_sensitive,
    mask_aadhaar,
    mask_bank_account,
    mask_pan,
)


def test_kyc_encryption_and_masking():
    aadhaar = "123456789012"
    pan = "ABCDE1234F"
    acct = "98765432101234"

    enc_a = encrypt_sensitive(aadhaar)
    enc_p = encrypt_sensitive(pan)
    enc_b = encrypt_sensitive(acct)

    assert enc_a != aadhaar
    assert decrypt_sensitive(enc_a) == aadhaar
    assert decrypt_sensitive(enc_p) == pan
    assert decrypt_sensitive(enc_b) == acct

    assert mask_aadhaar(aadhaar) == "XXXX-XXXX-9012"
    assert mask_pan(pan) == "AB****4F"
    assert mask_bank_account(acct).endswith("1234")
    assert "987654" not in mask_bank_account(acct)


def test_cod_and_kyc_enums_and_transitions():
    assert KYCStatus.APPROVED.value == "APPROVED"
    assert PaymentStatus.COD_PAYMENT_FAILED.value == "COD_PAYMENT_FAILED"
    assert OrderStatus.COD_PAYMENT_FAILED in ALLOWED_STATUS_TRANSITIONS[OrderStatus.OUT_FOR_DELIVERY]
    assert OrderStatus.COD_RETURN_PENDING in ALLOWED_STATUS_TRANSITIONS[OrderStatus.COD_PAYMENT_FAILED]
    assert OrderStatus.COD_RETURNED in ALLOWED_STATUS_TRANSITIONS[OrderStatus.COD_RETURN_PENDING]
    assert OrderStatus.COD_RESOLVED in ALLOWED_STATUS_TRANSITIONS[OrderStatus.COD_RETURNED]


@pytest.mark.asyncio
async def test_road_distance_does_not_invent_when_missing_coords():
    dist, provider = await calculate_road_distance_km(None, None, 12.97, 77.59)
    assert dist is None
    assert provider == "UNAVAILABLE"


def test_new_routes_registered():
    paths = {r.path for r in app.routes}
    assert "/api/kyc/me" in paths
    assert "/api/kyc/submit" in paths
    assert "/api/admin/kyc" in paths
    assert "/api/admin/kyc/{partner_id}/review" in paths
    assert "/api/admin/kyc/{partner_id}/documents/{doc_type}" in paths
    assert "/api/admin/delivery-rates" in paths
    assert "/api/admin/payouts/summary" in paths
    assert "/api/admin/payouts" in paths
    assert "/api/admin/payouts/export" in paths
    assert "/api/admin/cod-incidents" in paths
    assert "/api/admin/cod-incidents/{incident_id}/resolve" in paths
    assert "/api/delivery/orders/{order_id}/cod-refused" in paths

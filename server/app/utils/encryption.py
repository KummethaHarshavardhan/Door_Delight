import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken

from app.config.settings import get_settings


def _get_fernet() -> Fernet:
    settings = get_settings()
    raw_key = (settings.KYC_ENCRYPTION_KEY or "").strip()
    if raw_key:
        try:
            return Fernet(raw_key.encode("utf-8"))
        except Exception:
            pass
    # Derive deterministic 32-byte Fernet key from JWT_SECRET
    digest = hashlib.sha256(settings.JWT_SECRET.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_sensitive(value: str) -> str:
    """Encrypt sensitive KYC or banking value at rest."""
    clean = (value or "").strip()
    if not clean:
        return ""
    return _get_fernet().encrypt(clean.encode("utf-8")).decode("utf-8")


def decrypt_sensitive(token: str) -> str:
    """Decrypt stored sensitive KYC or banking value."""
    if not token:
        return ""
    try:
        return _get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""


def mask_aadhaar(raw: str) -> str:
    digits = "".join(ch for ch in (raw or "") if ch.isdigit())
    if len(digits) < 4:
        return "XXXX-XXXX-XXXX"
    return f"XXXX-XXXX-{digits[-4:]}"


def mask_pan(raw: str) -> str:
    clean = (raw or "").strip().upper()
    if len(clean) < 4:
        return "XXXXX****X"
    return f"{clean[:2]}****{clean[-2:]}"


def mask_bank_account(raw: str) -> str:
    clean = (raw or "").strip()
    if len(clean) < 4:
        return "XXXXXX"
    return f"{'X' * max(4, len(clean) - 4)}{clean[-4:]}"

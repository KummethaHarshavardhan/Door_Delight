from typing import Any, Dict
from fastapi import APIRouter, Depends, status

from app.middleware.auth import require_roles
from app.models.enums import UserRole
from app.schemas.customer import AddressCreateRequest, AddressUpdateRequest
from app.services.address_service import (
    create_address,
    delete_address,
    list_addresses,
    update_address,
)

router = APIRouter(prefix="/api/addresses", tags=["Addresses"])


@router.get("")
async def get_addresses(
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    addresses = await list_addresses(current_user["id"])
    return {"addresses": addresses}


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_address(
    payload: AddressCreateRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    address = await create_address(current_user["id"], payload)
    return {"address": address}


@router.put("/{address_id}")
async def edit_address(
    address_id: str,
    payload: AddressUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, Any]:
    address = await update_address(current_user["id"], address_id, payload)
    return {"address": address}


@router.delete("/{address_id}")
async def remove_address(
    address_id: str,
    current_user: Dict[str, Any] = Depends(require_roles(UserRole.CUSTOMER)),
) -> Dict[str, str]:
    await delete_address(current_user["id"], address_id)
    return {"message": "Address deleted"}

import csv
import io
from typing import Any, Dict, List
from bson import ObjectId
from fastapi import HTTPException

from app.database.mongodb import get_database
from app.models.enums import UserRole
from app.services.audit_service import log_delivery_audit
from app.services.kyc_service import format_kyc_public_view
from app.utils.serializers import serialize_doc, serialize_docs, to_object_id, utc_now


async def get_admin_payout_overview() -> Dict[str, Any]:
    db = get_database()
    partners = await db.users.find({"role": UserRole.DELIVERY_PARTNER.value}).sort("created_at", -1).to_list(length=300)

    earnings_agg = await db.delivery_earnings.aggregate([
        {
            "$group": {
                "_id": {"partner_id": "$delivery_partner_id", "status": "$payout_status"},
                "total": {"$sum": "$final_earnings"},
                "count": {"$sum": 1},
            }
        }
    ]).to_list(length=1000)

    partner_stats: Dict[str, Dict[str, Any]] = {}
    for row in earnings_agg:
        pid = row["_id"]["partner_id"]
        st = row["_id"]["status"]
        entry = partner_stats.setdefault(pid, {"paid": 0.0, "unpaid": 0.0, "deliveries": 0})
        entry["deliveries"] += row["count"]
        if st == "PAID":
            entry["paid"] += float(row["total"])
        else:
            entry["unpaid"] += float(row["total"])

    kyc_docs = await db.delivery_partner_kyc.find({}).to_list(length=300)
    kyc_map = {k["partner_id"]: format_kyc_public_view(k) for k in kyc_docs}

    partner_rows: List[Dict[str, Any]] = []
    for p in partners:
        pid = str(p["_id"])
        st = partner_stats.get(pid, {"paid": 0.0, "unpaid": 0.0, "deliveries": 0})
        kyc = kyc_map.get(pid)
        partner_rows.append({
            "partner_id": pid,
            "name": p.get("name", ""),
            "email": p.get("email", ""),
            "phone": p.get("phone", ""),
            "kyc_status": p.get("kyc_status", "NOT_SUBMITTED"),
            "completed_deliveries": st["deliveries"],
            "pending_earnings": round(st["unpaid"], 2),
            "paid_earnings": round(st["paid"], 2),
            "bank_account_masked": kyc["bank_account_masked"] if kyc else "-",
            "ifsc_code": kyc["ifsc_code"] if kyc else "-",
        })

    payouts = await db.delivery_payouts.find({}).sort("created_at", -1).to_list(length=300)
    return {"partners": partner_rows, "payouts": serialize_docs(payouts)}


async def process_manual_payout(
    partner_id: str,
    amount: float,
    transaction_reference: str,
    payment_method: str,
    notes: str,
    idempotency_key: str,
    admin_user: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Record a verified manual bank transfer payout to a delivery partner.
    Never exceeds eligible unpaid earnings and rejects duplicate transaction references.
    """
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Payout amount must be greater than zero")
    clean_ref = transaction_reference.strip()
    if not clean_ref:
        raise HTTPException(status_code=400, detail="Transaction reference is required")

    db = get_database()
    to_object_id(partner_id, "partner_id")
    partner = await db.users.find_one({"_id": ObjectId(partner_id), "role": UserRole.DELIVERY_PARTNER.value})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")

    if idempotency_key:
        existing_idem = await db.delivery_payouts.find_one({"idempotency_key": idempotency_key})
        if existing_idem:
            return serialize_doc(existing_idem)

    if await db.delivery_payouts.find_one({"transaction_reference": clean_ref}):
        raise HTTPException(status_code=409, detail="Duplicate transaction reference")

    unpaid_records = await db.delivery_earnings.find({
        "delivery_partner_id": partner_id,
        "payout_status": "UNPAID",
    }).sort("delivered_at", 1).to_list(length=1000)

    total_unpaid = round(sum(float(r["final_earnings"]) for r in unpaid_records), 2)
    if round(amount, 2) > total_unpaid:
        raise HTTPException(
            status_code=400,
            detail=f"Requested payout ₹{amount:.2f} exceeds eligible unpaid earnings ₹{total_unpaid:.2f}",
        )

    # Select unpaid earnings records covered by this payout (or require exact sum of selected/oldest records)
    selected_ids: List[ObjectId] = []
    running = 0.0
    for rec in unpaid_records:
        if running + float(rec["final_earnings"]) <= round(amount, 2) + 0.01:
            selected_ids.append(rec["_id"])
            running = round(running + float(rec["final_earnings"]), 2)

    if abs(running - round(amount, 2)) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Payout amount must settle whole delivery earnings records (e.g. full pending ₹{total_unpaid:.2f})",
        )

    now = utc_now()
    payout_doc = {
        "delivery_partner_id": partner_id,
        "partner_name": partner.get("name", ""),
        "amount": round(amount, 2),
        "currency": "INR",
        "transaction_reference": clean_ref,
        "payment_method": payment_method.strip().upper(),
        "payout_mode": "MANUAL_BANK_TRANSFER",
        "status": "PAID",
        "notes": notes.strip(),
        "earnings_count": len(selected_ids),
        "processed_by": admin_user["id"],
        "idempotency_key": idempotency_key or None,
        "paid_at": now,
        "created_at": now,
    }
    res = await db.delivery_payouts.insert_one(payout_doc)
    payout_id = str(res.inserted_id)
    payout_doc["_id"] = res.inserted_id

    if selected_ids:
        await db.delivery_earnings.update_many(
            {"_id": {"$in": selected_ids}},
            {"$set": {"payout_status": "PAID", "payout_id": payout_id, "paid_at": now}},
        )

    await log_delivery_audit(
        action="PAYOUT_RECORDED",
        entity_type="DELIVERY_PAYOUT",
        entity_id=payout_id,
        actor_id=admin_user["id"],
        actor_role=admin_user["role"],
        details={"partner_id": partner_id, "amount": round(amount, 2), "tx_ref": clean_ref},
    )
    return serialize_doc(payout_doc)


async def export_payouts_csv() -> str:
    db = get_database()
    payouts = await db.delivery_payouts.find({}).sort("created_at", -1).to_list(length=1000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Payout ID", "Partner ID", "Partner Name", "Amount (INR)", "Method", "Transaction Reference", "Status", "Paid At"])
    for p in payouts:
        writer.writerow([
            str(p["_id"]),
            p.get("delivery_partner_id", ""),
            p.get("partner_name", ""),
            p.get("amount", 0),
            p.get("payment_method", ""),
            p.get("transaction_reference", ""),
            p.get("status", ""),
            p.get("paid_at").isoformat() if p.get("paid_at") else "",
        ])
    return output.getvalue()

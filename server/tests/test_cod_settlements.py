from datetime import datetime, timedelta, timezone
from bson import ObjectId
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.main import app
from app.models.enums import ALLOWED_STATUS_TRANSITIONS, OrderStatus, SettlementStatus, UserRole
from app.schemas.order import OrderStatusUpdateRequest
from app.services import cod_settlement_service


class _InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class _FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)

    def sort(self, field, direction):
        reverse = direction == -1
        self.docs.sort(key=lambda d: d.get(field) or datetime.min, reverse=reverse)
        return self

    async def to_list(self, length=100):
        return [dict(d) for d in self.docs[:length]]


class _FakeCollection:
    def __init__(self, unique_fields=()):
        self.docs = []
        self.unique_fields = tuple(unique_fields)

    def _matches(self, doc, query):
        for k, v in query.items():
            if k == "$ne":
                continue
            if isinstance(v, dict) and "$in" in v:
                if doc.get(k) not in v["$in"]:
                    return False
            elif doc.get(k) != v:
                return False
        return True

    def find(self, query=None):
        query = query or {}
        matched = [d for d in self.docs if self._matches(d, query)]
        return _FakeCursor(matched)

    async def find_one(self, query):
        for d in self.docs:
            if self._matches(d, query):
                return dict(d)
        return None

    async def insert_one(self, doc):
        copy = dict(doc)
        if "_id" not in copy:
            copy["_id"] = ObjectId()
        for uf in self.unique_fields:
            if isinstance(uf, tuple):
                key = tuple(copy.get(f) for f in uf)
                if any(tuple(existing.get(f) for f in uf) == key for existing in self.docs):
                    raise DuplicateKeyError("Duplicate composite key")
            else:
                val = copy.get(uf)
                if val is not None and any(existing.get(uf) == val for existing in self.docs):
                    raise DuplicateKeyError(f"Duplicate {uf}")
        self.docs.append(copy)
        return _InsertResult(copy["_id"])

    async def update_one(self, query, update, upsert=False):
        for d in self.docs:
            if self._matches(d, query):
                if "$set" in update:
                    d.update(update["$set"])
                return
        if upsert:
            new_doc = dict(query)
            if "$set" in update:
                new_doc.update(update["$set"])
            await self.insert_one(new_doc)


class _FakeDB:
    def __init__(self):
        self.users = _FakeCollection()
        self.restaurants = _FakeCollection()
        self.cod_collections = _FakeCollection(unique_fields=("order_id",))
        self.cod_settlements = _FakeCollection(unique_fields=("transaction_reference",))
        self.cod_reminder_history = _FakeCollection(
            unique_fields=(("delivery_partner_id", "restaurant_id", "reminder_day", "period_key"),)
        )
        self.partner_restrictions = _FakeCollection(unique_fields=("delivery_partner_id",))
        self.notifications = _FakeCollection()
        self.delivery_audit_logs = _FakeCollection()


def test_order_status_enums_and_request_schema():
    assert OrderStatus.REACHED_RESTAURANT in ALLOWED_STATUS_TRANSITIONS[OrderStatus.READY_FOR_PICKUP]
    assert OrderStatus.PICKED_UP in ALLOWED_STATUS_TRANSITIONS[OrderStatus.REACHED_RESTAURANT]
    assert OrderStatus.REACHED_CUSTOMER in ALLOWED_STATUS_TRANSITIONS[OrderStatus.OUT_FOR_DELIVERY]
    assert OrderStatus.DELIVERED in ALLOWED_STATUS_TRANSITIONS[OrderStatus.REACHED_CUSTOMER]
    assert OrderStatus.DELIVERY_REFUSED in ALLOWED_STATUS_TRANSITIONS[OrderStatus.REACHED_CUSTOMER]

    req = OrderStatusUpdateRequest(status=OrderStatus.DELIVERED, cod_collected=True)
    assert req.cod_collected is True
    assert SettlementStatus.PAYMENT_VERIFICATION_PENDING.value == "PAYMENT_VERIFICATION_PENDING"


async def test_zero_rupee_outstanding_rule(monkeypatch=None):
    fake_db = _FakeDB()
    partner_id = ObjectId()
    await fake_db.users.insert_one({
        "_id": partner_id,
        "name": "Zero Balance Rider",
        "phone": "+919999999999",
        "role": UserRole.DELIVERY_PARTNER.value,
        "cod_restricted": False,
        "account_status": "ACTIVE",
    })

    orig_get_db = cod_settlement_service.get_database
    cod_settlement_service.get_database = lambda: fake_db
    try:
        res = await cod_settlement_service.run_cod_reminder_and_overdue_check()
        assert res["day1_reminders"] == 0
        assert res["day2_alerts"] == 0
        assert res["restricted_partners"] == 0
        assert len(fake_db.cod_reminder_history.docs) == 0
        assert len(fake_db.notifications.docs) == 0
        user = await fake_db.users.find_one({"_id": partner_id})
        assert user["cod_restricted"] is False
        assert user["account_status"] == "ACTIVE"
    finally:
        cod_settlement_service.get_database = orig_get_db


async def test_overdue_cod_reminder_and_two_day_restriction():
    fake_db = _FakeDB()
    partner_id = ObjectId()
    rest_id = ObjectId()
    admin_id = ObjectId()
    await fake_db.users.insert_one({
        "_id": partner_id,
        "name": "Overdue Rider",
        "phone": "+919888888888",
        "role": UserRole.DELIVERY_PARTNER.value,
        "cod_restricted": False,
        "account_status": "ACTIVE",
    })
    await fake_db.users.insert_one({
        "_id": admin_id,
        "name": "Admin",
        "role": UserRole.ADMIN.value,
        "is_active": True,
    })
    await fake_db.restaurants.insert_one({
        "_id": rest_id,
        "name": "Spice Hub",
        "upi_id": "spicehub@upi",
    })

    now = datetime(2026, 11, 19, 10, 0, 0, tzinfo=timezone.utc).replace(tzinfo=None)
    # Due 3 days ago -> overdue_days == 3 >= COD_OVERDUE_DAYS (2)
    await fake_db.cod_collections.insert_one({
        "order_id": str(ObjectId()),
        "order_number": "DD-1001",
        "delivery_partner_id": str(partner_id),
        "delivery_partner_name": "Overdue Rider",
        "restaurant_id": str(rest_id),
        "restaurant_name": "Spice Hub",
        "amount": 450.0,
        "collected_at": now - timedelta(days=5),
        "due_at": now - timedelta(days=3),
        "created_at": now - timedelta(days=5),
    })

    orig_get_db = cod_settlement_service.get_database
    cod_settlement_service.get_database = lambda: fake_db
    try:
        res = await cod_settlement_service.run_cod_reminder_and_overdue_check(now_override=now)
        assert res["restricted_partners"] == 1
        assert res["day2_alerts"] == 1
        user = await fake_db.users.find_one({"_id": partner_id})
        assert user["cod_restricted"] is True
        assert user["account_status"] == "COD_SETTLEMENT_OVERDUE"
        # Verify partial settlement & duplicate transaction reference rejection
        partner_actor = {"id": str(partner_id), "name": "Overdue Rider", "role": UserRole.DELIVERY_PARTNER.value}
        settlement = await cod_settlement_service.initiate_cod_upi_settlement(
            partner=partner_actor,
            restaurant_id=str(rest_id),
            amount=200.0,
            transaction_reference="UTR-123456",
            upi_app="GPay",
        )
        assert settlement["amount"] == 200.0
        assert settlement["status"] == SettlementStatus.PAYMENT_VERIFICATION_PENDING.value

        try:
            await cod_settlement_service.initiate_cod_upi_settlement(
                partner=partner_actor,
                restaurant_id=str(rest_id),
                amount=100.0,
                transaction_reference="UTR-123456",
                upi_app="PhonePe",
            )
            assert False, "Expected duplicate transaction reference HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409
    finally:
        cod_settlement_service.get_database = orig_get_db


def test_cod_routes_registered():
    paths = {r.path for r in app.routes}
    assert "/api/delivery/cod-settlements" in paths
    assert "/api/delivery/cod-settlements/pay" in paths
    assert "/api/manager/cod-settlements" in paths
    assert "/api/admin/cod-settlements" in paths
    assert "/api/admin/cod-settlements/{settlement_id}/verify" in paths
    assert "/api/admin/cod-partners/{partner_id}/restore" in paths
    assert "/api/admin/cod-reminders/run" in paths
    assert "/api/admin/cod-settlements/export" in paths

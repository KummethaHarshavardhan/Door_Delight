from datetime import datetime
from typing import Any, Dict, List
from bson import ObjectId
import httpx
from pymongo.errors import DuplicateKeyError

from app.main import app
from app.models.enums import DeliveryAssignmentStatus, KYCStatus, OrderStatus, PaymentMethod, PaymentStatus, UserRole
from app.routes import delivery as delivery_routes
from app.services import audit_service, earnings_service, kyc_service, order_service
from app.utils.security import create_access_token


class _InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class _FakeCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self.docs = list(docs)

    def sort(self, field: str, direction: int):
        reverse = direction == -1
        self.docs.sort(key=lambda d: d.get(field) or datetime.min, reverse=reverse)
        return self

    async def to_list(self, length: int = 100):
        return [dict(d) for d in self.docs[:length]]


class _FakeCollection:
    def __init__(self, unique_fields=()):
        self.docs: List[Dict[str, Any]] = []
        self.unique_fields = tuple(unique_fields)

    def _matches(self, doc: Dict[str, Any], query: Dict[str, Any]) -> bool:
        for k, v in query.items():
            if k == "$or":
                if not any(self._matches(doc, sub) for sub in v):
                    return False
                continue
            if isinstance(v, dict):
                if "$in" in v and doc.get(k) not in v["$in"]:
                    return False
                if "$ne" in v and doc.get(k) == v["$ne"]:
                    return False
                if "$nin" in v and doc.get(k) in v["$nin"]:
                    return False
            elif doc.get(k) != v:
                return False
        return True

    def _apply_update(self, doc: Dict[str, Any], update: Dict[str, Any], is_insert: bool = False) -> None:
        if "$set" in update:
            doc.update(update["$set"])
        if is_insert and "$setOnInsert" in update:
            doc.update(update["$setOnInsert"])
        if "$push" in update:
            for field, val in update["$push"].items():
                doc.setdefault(field, []).append(val)

    def find(self, query: Dict[str, Any] = None):
        query = query or {}
        return _FakeCursor([d for d in self.docs if self._matches(d, query)])

    async def find_one(self, query: Dict[str, Any]):
        for d in self.docs:
            if self._matches(d, query):
                return dict(d)
        return None

    async def insert_one(self, doc: Dict[str, Any]):
        copy = dict(doc)
        if "_id" not in copy:
            copy["_id"] = ObjectId()
        for uf in self.unique_fields:
            val = copy.get(uf)
            if val is not None and any(existing.get(uf) == val for existing in self.docs):
                raise DuplicateKeyError(f"Duplicate {uf}")
        self.docs.append(copy)
        return _InsertResult(copy["_id"])

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False):
        for d in self.docs:
            if self._matches(d, query):
                self._apply_update(d, update, is_insert=False)
                return
        if upsert:
            new_doc = {k: v for k, v in query.items() if not isinstance(v, dict) and not k.startswith("$")}
            self._apply_update(new_doc, update, is_insert=True)
            await self.insert_one(new_doc)

    async def find_one_and_update(self, query: Dict[str, Any], update: Dict[str, Any], return_document: bool = True):
        for d in self.docs:
            if self._matches(d, query):
                self._apply_update(d, update, is_insert=False)
                return dict(d)
        return None


class _FakeDB:
    def __init__(self):
        self.users = _FakeCollection()
        self.restaurants = _FakeCollection()
        self.orders = _FakeCollection()
        self.delivery_assignments = _FakeCollection(unique_fields=("order_id",))
        self.delivery_partner_kyc = _FakeCollection(unique_fields=("partner_id",))
        self.delivery_earnings = _FakeCollection()
        self.delivery_payouts = _FakeCollection()
        self.delivery_audit_logs = _FakeCollection()
        self.notifications = _FakeCollection()
        self.payments = _FakeCollection()


async def test_end_to_end_ready_for_pickup_to_two_partners():
    fake_db = _FakeDB()
    now = datetime.utcnow()

    customer_id = ObjectId()
    manager_id = ObjectId()
    partner1_id = ObjectId()
    partner2_id = ObjectId()
    rest_id = ObjectId()
    order_id = ObjectId()

    await fake_db.users.insert_one({
        "_id": customer_id, "name": "Test Customer", "email": "cust@test.com",
        "role": UserRole.CUSTOMER.value, "is_active": True,
    })
    await fake_db.users.insert_one({
        "_id": manager_id, "name": "Test Manager", "email": "mgr@test.com",
        "role": UserRole.RESTAURANT_MANAGER.value, "is_active": True,
    })
    await fake_db.users.insert_one({
        "_id": partner1_id, "name": "Partner One", "email": "dp1@test.com", "phone": "9000000001",
        "role": UserRole.DELIVERY_PARTNER.value, "is_active": True,
        "kyc_status": KYCStatus.APPROVED.value, "is_online": True, "cod_restricted": False,
        "delivery_status": "AVAILABLE", "active_order_id": None,
    })
    await fake_db.users.insert_one({
        "_id": partner2_id, "name": "Partner Two", "email": "dp2@test.com", "phone": "9000000002",
        "role": UserRole.DELIVERY_PARTNER.value, "is_active": True,
        "kyc_status": KYCStatus.APPROVED.value, "is_online": True, "cod_restricted": False,
        "delivery_status": "AVAILABLE", "active_order_id": None,
    })
    await fake_db.restaurants.insert_one({
        "_id": rest_id, "name": "Spice Garden", "address": "12 MG Road",
        "manager_id": str(manager_id), "is_active": True,
    })
    await fake_db.orders.insert_one({
        "_id": order_id,
        "order_number": "DD-E2E-101",
        "customer_id": str(customer_id),
        "customer_name": "Test Customer",
        "customer_phone": "9999999999",
        "restaurant_id": str(rest_id),
        "restaurant_name": "Spice Garden",
        "restaurant_address": "12 MG Road",
        "items": [],
        "subtotal": 250.0,
        "delivery_fee": 30.0,
        "tax": 12.5,
        "total_amount": 292.5,
        "payment_method": PaymentMethod.COD.value,
        "payment_status": PaymentStatus.COD_PENDING.value,
        "delivery_address": {"street": "45 Indiranagar", "city": "Bengaluru", "lat": 12.97, "lng": 77.64},
        "status": OrderStatus.PLACED.value,
        "status_history": [],
        "delivery_partner_id": None,
        "created_at": now,
        "updated_at": now,
    })

    # Patch get_database across auth middleware, order_service, kyc_service, and delivery routes
    from app.middleware import auth as auth_mw
    orig_auth_db = auth_mw.get_database
    orig_order_db = order_service.get_database
    orig_kyc_db = kyc_service.get_database
    orig_deliv_db = delivery_routes.get_database
    orig_audit_db = audit_service.get_database
    auth_mw.get_database = lambda: fake_db
    order_service.get_database = lambda: fake_db
    kyc_service.get_database = lambda: fake_db
    delivery_routes.get_database = lambda: fake_db
    audit_service.get_database = lambda: fake_db

    ws_events = []
    orig_broadcast = order_service.ws_manager.broadcast_order_event
    async def capture_ws(order, event_type="ORDER_UPDATED", restaurant_manager_id=None):
        ws_events.append((event_type, order.get("id"), order.get("status"), order.get("delivery_partner_id")))
    order_service.ws_manager.broadcast_order_event = capture_ws
    delivery_routes.ws_manager.broadcast_order_event = capture_ws

    try:
        mgr_token = create_access_token({"sub": str(manager_id), "role": UserRole.RESTAURANT_MANAGER.value})
        dp1_token = create_access_token({"sub": str(partner1_id), "role": UserRole.DELIVERY_PARTNER.value})
        dp2_token = create_access_token({"sub": str(partner2_id), "role": UserRole.DELIVERY_PARTNER.value})
        cust_token = create_access_token({"sub": str(customer_id), "role": UserRole.CUSTOMER.value})

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Manager: CONFIRMED -> PREPARING -> READY_FOR_PICKUP
            for st in ("CONFIRMED", "PREPARING", "READY_FOR_PICKUP"):
                r = await client.put(
                    f"/api/orders/{order_id}/status",
                    json={"status": st},
                    headers={"Authorization": f"Bearer {mgr_token}"},
                )
                assert r.status_code == 200, f"Status {st} failed: {r.text}"
                assert r.json()["order"]["status"] == st

            # 2. Verify MongoDB order and delivery_assignments state
            db_order = await fake_db.orders.find_one({"_id": order_id})
            assert db_order["status"] == "READY_FOR_PICKUP"
            db_assign = await fake_db.delivery_assignments.find_one({"order_id": str(order_id)})
            assert db_assign is not None
            assert db_assign["status"] == DeliveryAssignmentStatus.AVAILABLE.value

            # Verify WebSocket event fired for READY_FOR_PICKUP
            assert any(ev[0] == "ORDER_STATUS_UPDATED" and ev[2] == "READY_FOR_PICKUP" for ev in ws_events)

            # 3. Both online eligible partners call GET /api/delivery/assignments
            r1 = await client.get("/api/delivery/assignments", headers={"Authorization": f"Bearer {dp1_token}"})
            r2 = await client.get("/api/delivery/assignments", headers={"Authorization": f"Bearer {dp2_token}"})
            assert r1.status_code == 200 and r2.status_code == 200
            avail1 = r1.json()["available_assignments"]
            avail2 = r2.json()["available_assignments"]
            assert len(avail1) == 1 and avail1[0]["order_id"] == str(order_id)
            assert len(avail2) == 1 and avail2[0]["order_id"] == str(order_id)
            assert avail1[0]["delivery_address"]["city"] == "Bengaluru"

            assign_id = avail1[0]["id"]

            # 4. Partner 1 accepts -> 200 OK
            acc1 = await client.post(
                f"/api/delivery/assignments/{assign_id}/accept",
                headers={"Authorization": f"Bearer {dp1_token}"},
            )
            assert acc1.status_code == 200, acc1.text
            assert acc1.json()["order"]["delivery_partner_id"] == str(partner1_id)

            # 5. Partner 2 tries to accept the SAME order -> 409 Conflict
            acc2 = await client.post(
                f"/api/delivery/assignments/{assign_id}/accept",
                headers={"Authorization": f"Bearer {dp2_token}"},
            )
            assert acc2.status_code == 409

            # 6. Partner 2 refreshes available list -> empty; Partner 1 sees it in active_orders
            r2_after = await client.get("/api/delivery/assignments", headers={"Authorization": f"Bearer {dp2_token}"})
            r1_after = await client.get("/api/delivery/assignments", headers={"Authorization": f"Bearer {dp1_token}"})
            assert r2_after.json()["available_assignments"] == []
            assert len(r1_after.json()["active_orders"]) == 1
            assert r1_after.json()["active_orders"][0]["id"] == str(order_id)

            # 7. Customer sees assigned delivery partner
            rc = await client.get(f"/api/orders/{order_id}", headers={"Authorization": f"Bearer {cust_token}"})
            assert rc.status_code == 200
            assert rc.json()["order"]["delivery_partner_id"] == str(partner1_id)
            assert rc.json()["order"]["delivery_partner_name"] == "Partner One"
    finally:
        auth_mw.get_database = orig_auth_db
        order_service.get_database = orig_order_db
        kyc_service.get_database = orig_kyc_db
        delivery_routes.get_database = orig_deliv_db
        audit_service.get_database = orig_audit_db
        order_service.ws_manager.broadcast_order_event = orig_broadcast
        delivery_routes.ws_manager.broadcast_order_event = orig_broadcast


async def test_earnings_naive_datetime_and_cors_headers():
    fake_db = _FakeDB()
    dp_id = ObjectId()
    await fake_db.users.insert_one({
        "_id": dp_id, "name": "Rider", "email": "rider@test.com",
        "role": UserRole.DELIVERY_PARTNER.value, "is_active": True,
    })
    # Insert naive datetime record (exactly as PyMongo/Motor returns from MongoDB)
    naive_now = datetime.utcnow()
    await fake_db.delivery_earnings.insert_one({
        "order_id": str(ObjectId()),
        "order_number": "DD-EARN-1",
        "delivery_partner_id": str(dp_id),
        "final_earnings": 42.5,
        "eligible_distance_km": 2.8,
        "payout_status": "UNPAID",
        "delivered_at": naive_now,
        "created_at": naive_now,
    })

    from app.middleware import auth as auth_mw
    orig_auth_db = auth_mw.get_database
    orig_earn_db = earnings_service.get_database
    auth_mw.get_database = lambda: fake_db
    earnings_service.get_database = lambda: fake_db

    try:
        token = create_access_token({"sub": str(dp_id), "role": UserRole.DELIVERY_PARTNER.value})
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.get(
                "/api/delivery/earnings",
                headers={"Authorization": f"Bearer {token}", "Origin": "http://localhost:5173"},
            )
            assert res.status_code == 200, res.text
            assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
            data = res.json()
            assert data["today_deliveries"] == 1
            assert data["today_earnings"] == 42.5
            assert data["total_deliveries"] == 1
    finally:
        auth_mw.get_database = orig_auth_db
        earnings_service.get_database = orig_earn_db


async def test_live_gps_location_updates_and_rbac():
    fake_db = _FakeDB()
    dp1_id = ObjectId()
    dp2_id = ObjectId()
    cust_id = ObjectId()
    rest_id = ObjectId()
    order_id = ObjectId()

    await fake_db.users.insert_one({"_id": dp1_id, "name": "Rider 1", "role": UserRole.DELIVERY_PARTNER.value, "is_active": True})
    await fake_db.users.insert_one({"_id": dp2_id, "name": "Rider 2", "role": UserRole.DELIVERY_PARTNER.value, "is_active": True})
    await fake_db.users.insert_one({"_id": cust_id, "name": "Customer", "role": UserRole.CUSTOMER.value, "is_active": True})
    await fake_db.restaurants.insert_one({"_id": rest_id, "name": "Spice Garden", "lat": 12.9716, "lng": 77.5946, "manager_id": str(ObjectId())})
    await fake_db.orders.insert_one({
        "_id": order_id,
        "order_number": "DD-GPS-1",
        "customer_id": str(cust_id),
        "restaurant_id": str(rest_id),
        "restaurant_name": "Spice Garden",
        "delivery_partner_id": str(dp1_id),
        "delivery_address": {"street": "MG Road", "city": "Bengaluru", "lat": 12.975, "lng": 77.605},
        "items": [],
        "status": OrderStatus.OUT_FOR_DELIVERY.value,
    })

    from app.middleware import auth as auth_mw
    orig_auth_db = auth_mw.get_database
    orig_deliv_db = delivery_routes.get_database
    orig_order_db = order_service.get_database
    auth_mw.get_database = lambda: fake_db
    delivery_routes.get_database = lambda: fake_db
    order_service.get_database = lambda: fake_db

    ws_gps_events = []
    orig_broadcast = delivery_routes.ws_manager.broadcast_order_event
    async def capture_gps_ws(order, event_type="ORDER_UPDATED", restaurant_manager_id=None):
        ws_gps_events.append((event_type, order.get("id"), order.get("partner_location"), order.get("partner_gps_status")))
    delivery_routes.ws_manager.broadcast_order_event = capture_gps_ws

    try:
        dp1_token = create_access_token({"sub": str(dp1_id), "role": UserRole.DELIVERY_PARTNER.value})
        dp2_token = create_access_token({"sub": str(dp2_id), "role": UserRole.DELIVERY_PARTNER.value})
        cust_token = create_access_token({"sub": str(cust_id), "role": UserRole.CUSTOMER.value})

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # Assigned partner sends real coordinates -> 200 OK & broadcast
            r_ok = await client.post(
                "/api/delivery/location",
                json={"order_id": str(order_id), "lat": 12.9725, "lng": 77.5988, "accuracy": 14.0},
                headers={"Authorization": f"Bearer {dp1_token}"},
            )
            assert r_ok.status_code == 200, r_ok.text
            assert r_ok.json()["location"]["lat"] == 12.9725
            assert r_ok.json()["partner_gps_status"] == "ACTIVE"
            assert len(ws_gps_events) == 1 and ws_gps_events[0][0] == "PARTNER_LOCATION_UPDATED"

            # Unassigned partner cannot spoof/update another partner's order location -> 403
            r_forbid = await client.post(
                "/api/delivery/location",
                json={"order_id": str(order_id), "lat": 12.99, "lng": 77.61, "accuracy": 10.0},
                headers={"Authorization": f"Bearer {dp2_token}"},
            )
            assert r_forbid.status_code == 403

            # Invalid coordinate range rejected -> 422
            r_bad = await client.post(
                "/api/delivery/location",
                json={"order_id": str(order_id), "lat": 199.0, "lng": 77.61},
                headers={"Authorization": f"Bearer {dp1_token}"},
            )
            assert r_bad.status_code == 422

            # Customer fetches order -> sees partner_location + restaurant_location
            r_cust = await client.get(f"/api/orders/{order_id}", headers={"Authorization": f"Bearer {cust_token}"})
            assert r_cust.status_code == 200
            cust_order = r_cust.json()["order"]
            assert cust_order["partner_location"]["lat"] == 12.9725
            assert cust_order["restaurant_location"]["lat"] == 12.9716
    finally:
        auth_mw.get_database = orig_auth_db
        delivery_routes.get_database = orig_deliv_db
        order_service.get_database = orig_order_db
        delivery_routes.ws_manager.broadcast_order_event = orig_broadcast


async def test_kyc_sync_between_kyc_me_and_dashboard_when_user_out_of_sync():
    fake_db = _FakeDB()
    approved_dp_id = ObjectId()
    pending_dp_id = ObjectId()

    # Approved partner has NO kyc_status on db.users, but has APPROVED in delivery_partner_kyc
    await fake_db.users.insert_one({
        "_id": approved_dp_id, "name": "Approved Rider", "email": "approved@test.com",
        "role": UserRole.DELIVERY_PARTNER.value, "is_active": True,
        "is_online": False, "cod_restricted": False,
    })
    await fake_db.delivery_partner_kyc.insert_one({
        "partner_id": str(approved_dp_id),
        "full_name": "Approved Rider",
        "kyc_status": "APPROVED",
    })

    await fake_db.users.insert_one({
        "_id": pending_dp_id, "name": "Pending Rider", "email": "pending@test.com",
        "role": UserRole.DELIVERY_PARTNER.value, "is_active": True,
        "is_online": False, "cod_restricted": False,
    })
    await fake_db.delivery_partner_kyc.insert_one({
        "partner_id": str(pending_dp_id),
        "full_name": "Pending Rider",
        "kyc_status": "PENDING_VERIFICATION",
    })

    from app.middleware import auth as auth_mw
    orig_auth_db = auth_mw.get_database
    orig_kyc_db = kyc_service.get_database
    orig_deliv_db = delivery_routes.get_database
    auth_mw.get_database = lambda: fake_db
    kyc_service.get_database = lambda: fake_db
    delivery_routes.get_database = lambda: fake_db

    try:
        approved_token = create_access_token({"sub": str(approved_dp_id), "role": UserRole.DELIVERY_PARTNER.value})
        pending_token = create_access_token({"sub": str(pending_dp_id), "role": UserRole.DELIVERY_PARTNER.value})
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            r_kyc = await client.get("/api/kyc/me", headers={"Authorization": f"Bearer {approved_token}"})
            assert r_kyc.status_code == 200
            assert r_kyc.json()["kyc_status"] == "APPROVED"

            r_dash = await client.get("/api/delivery/assignments", headers={"Authorization": f"Bearer {approved_token}"})
            assert r_dash.status_code == 200
            assert r_dash.json()["partner_status"]["kyc_status"] == "APPROVED"

            # Partner can now go online
            r_online = await client.put(
                "/api/delivery/status",
                json={"is_online": True},
                headers={"Authorization": f"Bearer {approved_token}"},
            )
            assert r_online.status_code == 200
            assert r_online.json()["is_online"] is True

            # Pending partner is blocked from going online (403) and sees PENDING_VERIFICATION on dashboard
            r_pend_dash = await client.get("/api/delivery/assignments", headers={"Authorization": f"Bearer {pending_token}"})
            assert r_pend_dash.json()["partner_status"]["kyc_status"] == "PENDING_VERIFICATION"
            r_pend_online = await client.put(
                "/api/delivery/status",
                json={"is_online": True},
                headers={"Authorization": f"Bearer {pending_token}"},
            )
            assert r_pend_online.status_code == 403
    finally:
        auth_mw.get_database = orig_auth_db
        kyc_service.get_database = orig_kyc_db
        delivery_routes.get_database = orig_deliv_db

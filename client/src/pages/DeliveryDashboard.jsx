import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bike, CheckCircle2, DollarSign, MapPin, Navigation, Power, TrendingUp } from 'lucide-react';
import { deliveryAPI, kycAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { formatCurrency } from '../utils/formatters';

export default function DeliveryDashboard() {
  const { showToast } = useToast();
  const [partnerStatus, setPartnerStatus] = useState({
    is_online: true,
    delivery_status: 'AVAILABLE',
    active_order_id: null,
  });
  const [available, setAvailable] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [earnings, setEarnings] = useState({
    today_deliveries: 0,
    today_earnings: 0,
    weekly_earnings: 0,
    monthly_earnings: 0,
    total_deliveries: 0,
  });
  const [sharingGps, setSharingGps] = useState(false);
  const [codModalOrder, setCodModalOrder] = useState(null);
  const [codReason, setCodReason] = useState('');
  const [confirmDeliveryOrder, setConfirmDeliveryOrder] = useState(null);
  const [codCollectedConfirm, setCodCollectedConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gpsStatusNote, setGpsStatusNote] = useState('');
  const [sectionErrors, setSectionErrors] = useState({ assignments: '', earnings: '' });
  const watchIdRef = useRef(null);
  const watchedOrderIdRef = useRef(null);
  const lastGpsSentAtRef = useRef(0);
  const seenAvailableIdsRef = useRef(new Set());

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const [assignRes, earnRes, kycRes] = await Promise.allSettled([
        deliveryAPI.getAssignments(),
        deliveryAPI.getEarnings(),
        kycAPI.getMyKyc(),
      ]);

      const nextErrors = { assignments: '', earnings: '' };
      let rawStatus = null;

      if (assignRes.status === 'fulfilled') {
        const assignData = assignRes.value.data || {};
        const nextAvailable = assignData.available_assignments || [];
        nextAvailable.forEach((item) => {
          if (item.order_id) seenAvailableIdsRef.current.add(item.order_id);
        });
        rawStatus = assignData.partner_status || {
          is_online: false,
          delivery_status: 'OFFLINE',
          active_order_id: null,
        };
        setAvailable(nextAvailable);
        setActiveOrders(assignData.active_orders || []);
      } else {
        nextErrors.assignments =
          assignRes.reason?.response?.data?.detail || 'Could not load delivery assignments';
      }

      if (earnRes.status === 'fulfilled') {
        setEarnings(earnRes.value.data || {});
      } else {
        nextErrors.earnings =
          earnRes.reason?.response?.data?.detail || 'Could not load earnings summary';
      }

      const kycData = kycRes.status === 'fulfilled' ? kycRes.value.data : null;
      if (rawStatus || kycData) {
        setPartnerStatus((prev) => {
          const base = rawStatus || prev;
          const resolvedKycStatus =
            rawStatus?.kyc_status ||
            kycData?.kyc_status ||
            kycData?.kyc?.kyc_status ||
            prev.kyc_status ||
            'NOT_SUBMITTED';
          return {
            ...base,
            kyc_status: resolvedKycStatus,
            kyc_rejection_reason:
              base.kyc_rejection_reason || kycData?.kyc?.rejection_reason || '',
          };
        });
      }

      setSectionErrors(nextErrors);
      if (!silent && (nextErrors.assignments || nextErrors.earnings)) {
        showToast(nextErrors.assignments || nextErrors.earnings, 'error');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
    const pollTimer = setInterval(() => {
      loadData({ silent: true });
    }, 5000);
    return () => clearInterval(pollTimer);
  }, [loadData]);

  useOrderWebSocket({
    onMessage: (data) => {
      if (data?.order) {
        if (
          data.order.status === 'READY_FOR_PICKUP' &&
          !data.order.delivery_partner_id &&
          !seenAvailableIdsRef.current.has(data.order.id)
        ) {
          seenAvailableIdsRef.current.add(data.order.id);
          showToast(`New order ready for pickup: ${data.order.order_number}`, 'info');
        }
        loadData({ silent: true });
      }
    },
  });

  // Stop GPS watcher cleanly when no active order or on unmount
  const stopGpsWatch = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    watchedOrderIdRef.current = null;
    setSharingGps(false);
  }, []);

  // Unmount-only cleanup (never tear down watchPosition when sharingGps toggles)
  useEffect(() => {
    return () => stopGpsWatch();
  }, [stopGpsWatch]);

  const startGpsWatch = useCallback((orderId, { silent = false } = {}) => {
    if (!orderId) return;
    if (watchIdRef.current !== null && watchedOrderIdRef.current === orderId) {
      return;
    }
    if (watchIdRef.current !== null) {
      stopGpsWatch();
    }
    if (!navigator.geolocation) {
      setGpsStatusNote('Browser geolocation is not supported on this device.');
      if (!silent) showToast('Browser geolocation is not supported on this device', 'error');
      return;
    }

    watchedOrderIdRef.current = orderId;
    setSharingGps(true);
    setGpsStatusNote('Acquiring live GPS signal...');
    lastGpsSentAtRef.current = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const nowMs = Date.now();
        if (nowMs - lastGpsSentAtRef.current < 3000) return;
        lastGpsSentAtRef.current = nowMs;
        setGpsStatusNote(`Live GPS active (±${Math.round(pos.coords.accuracy || 0)}m)`);
        try {
          await deliveryAPI.sendLocation({
            order_id: orderId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        } catch {
          // Ignore transient network errors; next watchPosition tick will retry
        }
      },
      async (err) => {
        const statusCode =
          err.code === 1
            ? 'PERMISSION_DENIED'
            : err.code === 2
              ? 'GPS_UNAVAILABLE'
              : 'TIMEOUT';
        const humanMsg =
          err.code === 1
            ? 'Location permission denied. Enable GPS permission to share live location.'
            : err.code === 2
              ? 'Device GPS position is currently unavailable.'
              : 'GPS signal timed out; retrying...';
        setGpsStatusNote(humanMsg);
        if (err.code === 1) {
          stopGpsWatch();
        }
        try {
          await deliveryAPI.sendGpsStatus({ order_id: orderId, gps_status: statusCode });
        } catch {
          // Ignore status sync failure
        }
        if (!silent) showToast(humanMsg, 'error');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    if (!silent) showToast('Live GPS sharing enabled for active delivery', 'success');
  }, [showToast, stopGpsWatch]);

  // Automatically share real GPS whenever an active delivery is in progress
  const activeOrder = activeOrders[0] || null;
  const activeOrderId = activeOrder?.id || null;
  const activeOrderStatus = activeOrder?.status || null;

  useEffect(() => {
    const activeGpsStates = new Set([
      'READY_FOR_PICKUP',
      'REACHED_RESTAURANT',
      'PICKED_UP',
      'OUT_FOR_DELIVERY',
      'REACHED_CUSTOMER',
    ]);
    if (activeOrderId && activeGpsStates.has(activeOrderStatus)) {
      startGpsWatch(activeOrderId, { silent: true });
    } else if (watchIdRef.current !== null) {
      stopGpsWatch();
    }
  }, [activeOrderId, activeOrderStatus, startGpsWatch, stopGpsWatch]);

  const toggleOnline = async () => {
    try {
      const next = !partnerStatus.is_online;
      await deliveryAPI.setOnlineStatus(next);
      showToast(next ? 'You are now ONLINE' : 'You are now OFFLINE', 'info');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update online status', 'error');
    }
  };

  const toggleGpsSharing = (orderId) => {
    if (sharingGps) {
      stopGpsWatch();
      setGpsStatusNote('Live GPS sharing paused by rider.');
      deliveryAPI.sendGpsStatus({ order_id: orderId, gps_status: 'STOPPED' }).catch(() => {});
      showToast('Live GPS sharing stopped', 'info');
      return;
    }
    startGpsWatch(orderId, { silent: false });
  };

  const handleAccept = async (assignmentId) => {
    try {
      await deliveryAPI.acceptAssignment(assignmentId);
      showToast('Delivery assignment accepted!', 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not accept assignment', 'error');
    }
  };

  const handleStatusUpdate = async (orderId, status, extra = {}) => {
    try {
      await deliveryAPI.updateOrderStatus(orderId, { status, ...extra });
      if (status === 'DELIVERED' || status === 'DELIVERY_REFUSED') {
        stopGpsWatch();
      }
      showToast(`Order updated to ${status.replace(/_/g, ' ')}`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update status', 'error');
    }
  };

  const handleConfirmFinalDelivery = async () => {
    if (!confirmDeliveryOrder) return;
    const isCod = confirmDeliveryOrder.payment_method === 'COD';
    if (isCod && !codCollectedConfirm) {
      showToast('Please confirm that you collected the full COD cash amount', 'error');
      return;
    }
    await handleStatusUpdate(
      confirmDeliveryOrder.id,
      'DELIVERED',
      isCod ? { cod_collected: true } : {}
    );
    setConfirmDeliveryOrder(null);
    setCodCollectedConfirm(false);
  };

  const handleCodRefused = async () => {
    if (!codModalOrder || !codReason.trim()) {
      showToast('Please enter the reason for COD refusal', 'error');
      return;
    }
    try {
      await deliveryAPI.reportCodRefused(codModalOrder.id, { reason: codReason.trim() });
      stopGpsWatch();
      showToast('COD payment failure reported. Return order to restaurant.', 'info');
      setCodModalOrder(null);
      setCodReason('');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to report COD refusal', 'error');
    }
  };

  const handleCodReturnPending = async (orderId) => {
    try {
      await deliveryAPI.markCodReturnPending(orderId);
      showToast('Marked as returning to restaurant', 'info');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update status', 'error');
    }
  };

  if (loading) return <p>Loading delivery portal...</p>;

  const isBusy = partnerStatus.delivery_status === 'BUSY' || activeOrders.length > 0;
  const kycStatus = partnerStatus.kyc_status || 'NOT_SUBMITTED';
  const kycApproved = kycStatus === 'APPROVED';
  const codRestricted = Boolean(
    partnerStatus.cod_restricted || partnerStatus.account_status === 'COD_SETTLEMENT_OVERDUE'
  );

  const kycMessageMap = {
    NOT_SUBMITTED: 'Complete your KYC verification to go online and accept delivery assignments.',
    PENDING_VERIFICATION: 'Your KYC verification is pending Admin review. You can go online once approved.',
    REJECTED: 'Your KYC was rejected. Please review the admin note and resubmit your KYC documents.',
    RESUBMISSION_REQUIRED: 'KYC resubmission is required. Please update your documents and submit again.',
  };

  return (
    <div className="page-enter">
      {codRestricted && (
        <div className="card card-body" style={{ marginBottom: 18, borderColor: 'var(--danger)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={20} color="var(--danger)" />
              <div>
                <strong style={{ color: 'var(--danger)' }}>Account Restricted: COD Settlement Overdue</strong>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                  Your COD cash settlement is overdue. Settle your pending balance via UPI to restore delivery access.
                </p>
              </div>
            </div>
            <Link to="/delivery/cod-settlement" className="btn btn-danger btn-sm">
              Settle COD Now
            </Link>
          </div>
        </div>
      )}
      {!kycApproved && (
        <div
          className="card card-body"
          style={{
            marginBottom: 18,
            borderColor:
              kycStatus === 'REJECTED' || kycStatus === 'RESUBMISSION_REQUIRED'
                ? 'var(--danger)'
                : 'var(--warning)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <strong>KYC Status: {kycStatus}</strong>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                {kycMessageMap[kycStatus] ||
                  'Only APPROVED delivery partners can go online or accept delivery assignments.'}
              </p>
              {partnerStatus.kyc_rejection_reason && (
                <p style={{ fontSize: '0.84rem', color: 'var(--danger)', marginTop: 4 }}>
                  Admin Note: {partnerStatus.kyc_rejection_reason}
                </p>
              )}
            </div>
            <Link to="/delivery/kyc" className="btn btn-primary btn-sm">
              {kycStatus === 'NOT_SUBMITTED'
                ? 'Complete KYC'
                : kycStatus === 'PENDING_VERIFICATION'
                  ? 'View KYC Status'
                  : 'Resubmit KYC'}
            </Link>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Rider Command Center</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <span className={`badge ${isBusy ? 'badge-warning' : partnerStatus.is_online ? 'badge-success' : 'badge-neutral'}`}>
              {isBusy ? 'BUSY (1 Active Order)' : partnerStatus.is_online ? 'AVAILABLE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        <button
          type="button"
          className={`btn ${partnerStatus.is_online ? 'btn-success' : 'btn-secondary'}`}
          disabled={isBusy || !kycApproved || codRestricted}
          onClick={toggleOnline}
        >
          <Power size={16} />
          {partnerStatus.is_online ? 'Online — Go Offline' : 'Offline — Go Online'}
        </button>
      </div>

      {/* Real Daily, Weekly & Monthly Earnings */}
      {sectionErrors.earnings && (
        <div className="card card-body" style={{ marginBottom: 14, borderColor: 'var(--warning)' }}>
          <strong style={{ color: 'var(--warning)' }}>Earnings Notice:</strong> {sectionErrors.earnings}
        </div>
      )}
      {sectionErrors.assignments && (
        <div className="card card-body" style={{ marginBottom: 14, borderColor: 'var(--danger)' }}>
          <strong style={{ color: 'var(--danger)' }}>Assignments Notice:</strong> {sectionErrors.assignments}
        </div>
      )}
      <div className="grid grid-4" style={{ marginBottom: 26 }}>
        <div className="stat-card">
          <div>
            <div className="stat-label">Today Deliveries</div>
            <div className="stat-value">{earnings.today_deliveries}</div>
          </div>
          <div className="stat-icon-box grad-coral"><Bike size={22} /></div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Today Earnings</div>
            <div className="stat-value">{formatCurrency(earnings.today_earnings)}</div>
          </div>
          <div className="stat-icon-box grad-mint"><DollarSign size={22} /></div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Weekly Earnings</div>
            <div className="stat-value">{formatCurrency(earnings.weekly_earnings)}</div>
          </div>
          <div className="stat-icon-box grad-violet"><TrendingUp size={22} /></div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Monthly Earnings</div>
            <div className="stat-value">{formatCurrency(earnings.monthly_earnings)}</div>
          </div>
          <div className="stat-icon-box grad-gold"><CheckCircle2 size={22} /></div>
        </div>
      </div>

      <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 12 }}>
        My Active Delivery ({activeOrders.length}/1)
      </h2>
      {activeOrders.length === 0 ? (
        <div className="card card-glass card-body" style={{ marginBottom: 24 }}>
          No active delivery assigned. Accept an order from the pool below when online.
        </div>
      ) : (
        <div className="grid grid-2" style={{ marginBottom: 28 }}>
          {activeOrders.map((order) => (
            <div key={order.id} className="card card-glass" style={{ borderColor: 'var(--primary)' }}>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <strong>{order.order_number}</strong>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div style={{ fontSize: '0.9rem', marginBottom: 6 }}>
                  <strong>Pickup:</strong> {order.restaurant_name} — {order.restaurant_address}
                </div>
                <div style={{ fontSize: '0.9rem', marginBottom: 6 }}>
                  <strong>Dropoff:</strong> {order.customer_name} ({order.customer_phone}) —{' '}
                  {order.delivery_address?.street}, {order.delivery_address?.city}
                </div>
                <div style={{ fontSize: '0.9rem', marginBottom: 14 }}>
                  <strong>Payment:</strong> {order.payment_method} ({order.payment_status}) •{' '}
                  {formatCurrency(order.total_amount)}
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${sharingGps ? 'btn-success' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => toggleGpsSharing(order.id)}
                  >
                    <MapPin size={15} />
                    {sharingGps ? 'Live GPS Sharing ON (Tap to Stop)' : 'Share Real GPS Location'}
                  </button>
                  <a
                    href={
                      order.delivery_address?.lat && order.delivery_address?.lng
                        ? `https://www.google.com/maps/dir/?api=1&destination=${order.delivery_address.lat},${order.delivery_address.lng}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${order.delivery_address?.street || ''}, ${order.delivery_address?.city || ''}`
                          )}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-secondary"
                  >
                    <Navigation size={15} /> Navigate
                  </a>
                </div>
                {gpsStatusNote && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                    GPS: {gpsStatusNote}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {order.status === 'READY_FOR_PICKUP' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary btn-lg"
                        style={{ flex: 1 }}
                        onClick={() => handleStatusUpdate(order.id, 'REACHED_RESTAURANT')}
                      >
                        Reached Restaurant
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-lg"
                        style={{ flex: 1 }}
                        onClick={() => handleStatusUpdate(order.id, 'PICKED_UP')}
                      >
                        Mark Picked Up
                      </button>
                    </>
                  )}
                  {order.status === 'REACHED_RESTAURANT' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      style={{ flex: 1 }}
                      onClick={() => handleStatusUpdate(order.id, 'PICKED_UP')}
                    >
                      Mark Picked Up
                    </button>
                  )}
                  {order.status === 'PICKED_UP' && (
                    <button
                      type="button"
                      className="btn btn-violet btn-lg"
                      style={{ flex: 1 }}
                      onClick={() => handleStatusUpdate(order.id, 'OUT_FOR_DELIVERY')}
                    >
                      Out for Delivery
                    </button>
                  )}
                  {order.status === 'OUT_FOR_DELIVERY' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      style={{ flex: 1 }}
                      onClick={() => handleStatusUpdate(order.id, 'REACHED_CUSTOMER')}
                    >
                      Reached Customer Location
                    </button>
                  )}
                  {(order.status === 'OUT_FOR_DELIVERY' || order.status === 'REACHED_CUSTOMER') && (
                    <>
                      <button
                        type="button"
                        className="btn btn-success btn-lg"
                        style={{ flex: 1 }}
                        onClick={() => {
                          setCodCollectedConfirm(false);
                          setConfirmDeliveryOrder(order);
                        }}
                      >
                        Complete Delivery
                      </button>
                      {order.payment_method === 'COD' ? (
                        <button
                          type="button"
                          className="btn btn-danger btn-lg"
                          style={{ flex: 1 }}
                          onClick={() => setCodModalOrder(order)}
                        >
                          Customer Refused COD
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-danger btn-lg"
                          style={{ flex: 1 }}
                          onClick={() => handleStatusUpdate(order.id, 'DELIVERY_REFUSED')}
                        >
                          Customer Refused
                        </button>
                      )}
                    </>
                  )}
                  {order.status === 'COD_PAYMENT_FAILED' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      style={{ flex: 1 }}
                      onClick={() => handleCodReturnPending(order.id)}
                    >
                      Returning Order to Restaurant
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 12 }}>
        Available Delivery Pool ({available.length})
      </h2>
      {!partnerStatus.is_online ? (
        <div className="card card-glass card-body">Go Online to view and accept delivery requests.</div>
      ) : available.length === 0 ? (
        <div className="card card-glass card-body">No orders waiting for pickup right now.</div>
      ) : (
        <div className="grid grid-2">
          {available.map((item) => (
            <div key={item.id} className="card card-glass">
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong>{item.order_number}</strong>
                  <span className="badge badge-warning">READY FOR PICKUP</span>
                </div>
                <div style={{ fontSize: '0.9rem', marginBottom: 6 }}>
                  <strong>Restaurant:</strong> {item.restaurant_name} ({item.restaurant_address})
                </div>
                <div style={{ fontSize: '0.9rem', marginBottom: 6 }}>
                  <strong>Dropoff:</strong> {item.delivery_address?.street}, {item.delivery_address?.city}
                </div>
                <div style={{ fontSize: '0.9rem', marginBottom: 14 }}>
                  <strong>Order Total:</strong> {formatCurrency(item.total_amount)} • {item.payment_method}
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  disabled={isBusy}
                  onClick={() => handleAccept(item.id)}
                >
                  {isBusy ? 'Finish Active Delivery First' : 'Accept Delivery'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDeliveryOrder && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 460 }}>
            <h3 style={{ fontWeight: 800, marginBottom: 8 }}>Final Delivery Confirmation</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              Order <strong>{confirmDeliveryOrder.order_number}</strong> •{' '}
              {confirmDeliveryOrder.restaurant_name}
            </p>
            {confirmDeliveryOrder.payment_method === 'COD' ? (
              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(249,115,22,0.12)', marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 6 }}>
                  Collect Cash: {formatCurrency(confirmDeliveryOrder.total_amount)}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={codCollectedConfirm}
                    onChange={(e) => setCodCollectedConfirm(e.target.checked)}
                  />
                  I confirm I collected {formatCurrency(confirmDeliveryOrder.total_amount)} in cash from the customer.
                </label>
              </div>
            ) : (
              <div style={{ padding: 14, borderRadius: 12, background: 'rgba(16,185,129,0.12)', marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 4 }}>
                  Paid Online — Collect ₹0
                </div>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                  Hand over the order to {confirmDeliveryOrder.customer_name}. No cash collection required.
                </p>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDeliveryOrder(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                disabled={confirmDeliveryOrder.payment_method === 'COD' && !codCollectedConfirm}
                onClick={handleConfirmFinalDelivery}
              >
                Confirm Delivered
              </button>
            </div>
          </div>
        </div>
      )}

      {codModalOrder && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 440 }}>
            <h3 style={{ fontWeight: 800, marginBottom: 8 }}>Report COD Payment Refusal</h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              Order {codModalOrder.order_number} will be marked COD_PAYMENT_FAILED and must be returned to {codModalOrder.restaurant_name}.
            </p>
            <div className="form-group">
              <label className="form-label">Reason for COD Refusal</label>
              <textarea
                className="textarea"
                rows={3}
                value={codReason}
                onChange={(e) => setCodReason(e.target.value)}
                placeholder="e.g., Customer refused to pay cash / unreachable at doorstep"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setCodModalOrder(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleCodRefused}>Report COD Refusal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

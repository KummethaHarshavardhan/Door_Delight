import React, { useCallback, useEffect, useState } from 'react';
import { managerAPI, orderAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export default function ManagerOrdersPage() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await managerAPI.getOrders();
      setOrders(res.data.orders || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useOrderWebSocket({
    onMessage: (data) => {
      if (data?.order) {
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === data.order.id);
          return exists
            ? prev.map((o) => (o.id === data.order.id ? data.order : o))
            : [data.order, ...prev];
        });
        if (data.event === 'ORDER_PLACED') {
          showToast(`New order received: ${data.order.order_number}`, 'info');
        }
      }
    },
  });

  const handleStatus = async (orderId, status, reason = '') => {
    try {
      const res = await orderAPI.updateStatus(orderId, { status, reason: reason || undefined });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.data.order : o)));
      showToast(`Order marked as ${status.replace(/_/g, ' ')}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update status', 'error');
    }
  };

  if (loading) return <p>Loading incoming orders...</p>;

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 18 }}>Restaurant Orders</h1>
      {orders.length === 0 ? (
        <div className="card card-body">No orders received yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {orders.map((order) => (
            <div key={order.id} className="card">
              <div className="card-body">
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      {order.order_number} • {order.customer_name}
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      {formatDateTime(order.created_at)} • {order.payment_method} ({order.payment_status})
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <OrderStatusBadge status={order.status} />
                    <strong>{formatCurrency(order.total_amount)}</strong>
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: '0.9rem' }}>
                  {order.items.map((i) => (
                    <span key={i.food_item_id} style={{ marginRight: 14 }}>
                      {i.quantity}x {i.name}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                  {order.status === 'PLACED' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => handleStatus(order.id, 'CONFIRMED')}
                      >
                        Accept Order
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          setRejectModal(order.id);
                          setRejectReason('');
                        }}
                      >
                        Reject Order
                      </button>
                    </>
                  )}
                  {order.status === 'CONFIRMED' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleStatus(order.id, 'PREPARING')}
                    >
                      Start Preparing
                    </button>
                  )}
                  {order.status === 'PREPARING' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleStatus(order.id, 'READY_FOR_PICKUP')}
                    >
                      Mark Ready for Pickup
                    </button>
                  )}
                  {(order.status === 'COD_PAYMENT_FAILED' || order.status === 'COD_RETURN_PENDING') && (
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={async () => {
                        try {
                          const res = await managerAPI.confirmCodReturned(order.id);
                          setOrders((prev) => prev.map((o) => (o.id === order.id ? res.data.order : o)));
                          showToast('Confirmed receipt of returned COD order', 'success');
                        } catch (err) {
                          showToast(err.response?.data?.detail || 'Failed to confirm return', 'error');
                        }
                      }}
                    >
                      Confirm COD Order Returned
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 420 }}>
            <h3 style={{ fontWeight: 800, marginBottom: 10 }}>Reject Order</h3>
            <div className="form-group">
              <label className="form-label">Reason for rejection</label>
              <textarea
                className="textarea"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Item out of stock / Kitchen closing"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setRejectModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  if (!rejectReason.trim()) {
                    showToast('Please enter a rejection reason', 'error');
                    return;
                  }
                  await handleStatus(rejectModal, 'REJECTED', rejectReason.trim());
                  setRejectModal(null);
                }}
              >
                Reject Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

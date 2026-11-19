import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalogAPI, orderAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export default function CustomerOrdersPage() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orderAPI.list();
      setOrders(res.data.orders || []);
    } catch {
      showToast('Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useOrderWebSocket({
    onMessage: (data) => {
      if (data?.order) {
        setOrders((prev) => prev.map((o) => (o.id === data.order.id ? data.order : o)));
      }
    },
  });

  const handleCancel = async (orderId) => {
    try {
      const res = await orderAPI.updateStatus(orderId, {
        status: 'CANCELLED',
        reason: 'Cancelled by customer',
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.data.order : o)));
      showToast('Order cancelled', 'info');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Cannot cancel order', 'error');
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewTarget) return;
    try {
      await catalogAPI.submitReview({
        order_id: reviewTarget.orderId,
        food_item_id: reviewTarget.foodItemId,
        rating: Number(rating),
        comment,
      });
      showToast('Thank you for your review!', 'success');
      setReviewTarget(null);
      setComment('');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not submit review', 'error');
    }
  };

  if (loading) return <p>Loading your orders...</p>;

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 18 }}>Your Orders</h1>

      {orders.length === 0 ? (
        <div className="card card-body">You haven't placed any orders yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {orders.map((order) => (
            <div key={order.id} className="card">
              <div className="card-body">
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                      {order.order_number} — {order.restaurant_name}
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      {formatDateTime(order.created_at)} • {order.payment_method} ({order.payment_status})
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <OrderStatusBadge status={order.status} />
                    <span style={{ fontWeight: 800 }}>{formatCurrency(order.total_amount)}</span>
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {order.items.map((item) => (
                    <span key={item.food_item_id} style={{ marginRight: 14 }}>
                      {item.quantity}x {item.name}
                      {order.status === 'DELIVERED' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ marginLeft: 8, padding: '2px 8px', fontSize: '0.75rem' }}
                          onClick={() =>
                            setReviewTarget({
                              orderId: order.id,
                              foodItemId: item.food_item_id,
                              name: item.name,
                            })
                          }
                        >
                          Rate
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <Link to={`/customer/orders/${order.id}`} className="btn btn-primary btn-sm">
                    Track & Details
                  </Link>
                  {['PLACED', 'CONFIRMED'].includes(order.status) && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleCancel(order.id)}
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewTarget && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 420 }}>
            <h3 style={{ fontWeight: 800, marginBottom: 12 }}>Rate {reviewTarget.name}</h3>
            <form onSubmit={handleReviewSubmit}>
              <div className="form-group">
                <label className="form-label">Rating (1-5)</label>
                <select className="select" value={rating} onChange={(e) => setRating(e.target.value)}>
                  <option value={5}>5 - Excellent</option>
                  <option value={4}>4 - Very Good</option>
                  <option value={3}>3 - Good</option>
                  <option value={2}>2 - Fair</option>
                  <option value={1}>1 - Poor</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Comment</label>
                <textarea
                  className="textarea"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your experience..."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setReviewTarget(null)}>
                  Close
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

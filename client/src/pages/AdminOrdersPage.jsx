import React, { useCallback, useEffect, useState } from 'react';
import { adminAPI, orderAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export default function AdminOrdersPage() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [search, setSearch] = useState('');

  const loadOrders = useCallback(async () => {
    const res = await adminAPI.getOrders({
      status: statusFilter || undefined,
      timeframe: timeframe || undefined,
      search: search || undefined,
    });
    setOrders(res.data.orders || []);
  }, [statusFilter, timeframe, search]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useOrderWebSocket({
    onMessage: (data) => {
      if (data?.order) {
        loadOrders();
      }
    },
  });

  const handleCancelIssue = async (orderId) => {
    try {
      await orderAPI.updateStatus(orderId, { status: 'CANCELLED', reason: 'Cancelled by Admin' });
      showToast('Order cancelled', 'info');
      await loadOrders();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Cannot cancel order', 'error');
    }
  };

  return (
    <div className="page-enter">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 18 }}>Order Monitoring</h1>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Search order #, customer, restaurant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="select" style={{ maxWidth: 180 }} value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
          <option value="">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
        <select className="select" style={{ maxWidth: 210 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="PLACED">PLACED</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="PREPARING">PREPARING</option>
          <option value="READY_FOR_PICKUP">READY_FOR_PICKUP</option>
          <option value="PICKED_UP">PICKED_UP</option>
          <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
          <option value="DELIVERED">DELIVERED</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </div>

      <div className="card card-glass">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Restaurant</th>
                <th>Delivery Partner</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 700 }}>{o.order_number}</td>
                  <td>{o.customer_name}</td>
                  <td>{o.restaurant_name}</td>
                  <td>{o.delivery_partner_name || 'Unassigned'}</td>
                  <td>{formatCurrency(o.total_amount)}</td>
                  <td>{o.payment_method} ({o.payment_status})</td>
                  <td><OrderStatusBadge status={o.status} /></td>
                  <td>{formatDateTime(o.created_at)}</td>
                  <td>
                    {!['DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.status) && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleCancelIssue(o.id)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { deliveryAPI } from '../services/api';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export default function DeliveryHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    deliveryAPI
      .getHistory()
      .then((res) => setOrders(res.data.orders || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading delivery history...</p>;

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 18 }}>Completed Deliveries</h1>
      {orders.length === 0 ? (
        <div className="card card-body">No completed deliveries yet.</div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Restaurant</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Completed At</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 700 }}>{o.order_number}</td>
                    <td>{o.restaurant_name}</td>
                    <td>{o.customer_name}</td>
                    <td>{formatCurrency(o.total_amount)}</td>
                    <td><OrderStatusBadge status={o.status} /></td>
                    <td>{formatDateTime(o.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

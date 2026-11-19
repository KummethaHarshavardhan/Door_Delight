import React, { useEffect, useState } from 'react';
import { adminAPI } from '../services/api';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI
      .getPayments()
      .then((res) => setPayments(res.data.payments || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading payments...</p>;

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 18 }}>Payments & Transactions</h1>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Razorpay Order ID</th>
                <th>Razorpay Payment ID</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700 }}>{p.order_number}</td>
                  <td>{p.method}</td>
                  <td>{formatCurrency(p.amount)}</td>
                  <td><OrderStatusBadge status={p.status} /></td>
                  <td>{p.razorpay_order_id || '-'}</td>
                  <td>{p.razorpay_payment_id || '-'}</td>
                  <td>{formatDateTime(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

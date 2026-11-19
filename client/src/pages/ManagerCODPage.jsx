import React, { useEffect, useState } from 'react';
import { managerAPI } from '../services/api';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export default function ManagerCODPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    managerAPI
      .getCodSettlements()
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading restaurant COD settlements...</p>;

  return (
    <div className="page-enter">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 18 }}>Restaurant COD Settlements</h1>

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div>
            <div className="stat-label">Total COD Collected</div>
            <div className="stat-value">{formatCurrency(data?.total_cod_collected || 0)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">UPI Received (Verified)</div>
            <div className="stat-value">{formatCurrency(data?.total_upi_received || 0)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Pending COD Amount</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>
              {formatCurrency(data?.total_pending_cod || 0)}
            </div>
          </div>
        </div>
      </div>

      <div className="card card-glass" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>Partner-Wise Settlement History</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Amount</th>
                  <th>UPI App</th>
                  <th>Transaction Ref</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(data?.settlements || []).map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700 }}>{s.partner_name}</td>
                    <td>{formatCurrency(s.amount)}</td>
                    <td>{s.upi_app}</td>
                    <td>{s.transaction_reference}</td>
                    <td><OrderStatusBadge status={s.status} /></td>
                    <td>{formatDateTime(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card card-glass">
        <div className="card-body">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>Order-Wise COD Collections</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Partner</th>
                  <th>Amount</th>
                  <th>Collected At</th>
                  <th>Due At</th>
                </tr>
              </thead>
              <tbody>
                {(data?.collections || []).map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>{c.order_number}</td>
                    <td>{c.delivery_partner_name}</td>
                    <td>{formatCurrency(c.amount)}</td>
                    <td>{formatDateTime(c.collected_at)}</td>
                    <td>{formatDateTime(c.due_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

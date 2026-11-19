import React, { useEffect, useState } from 'react';
import { deliveryAPI } from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export default function DeliveryEarningsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    deliveryAPI
      .getEarnings()
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading earnings dashboard...</p>;

  const stats = [
    { label: 'Today Deliveries', value: data?.today_deliveries ?? 0 },
    { label: 'Today Earnings', value: formatCurrency(data?.today_earnings) },
    { label: 'Weekly Earnings', value: formatCurrency(data?.weekly_earnings) },
    { label: 'Monthly Earnings', value: formatCurrency(data?.monthly_earnings) },
    { label: 'Lifetime Earnings', value: formatCurrency(data?.total_lifetime_earnings) },
    { label: 'Pending Payout', value: formatCurrency(data?.pending_payout) },
    { label: 'Already Paid', value: formatCurrency(data?.already_paid_amount) },
    { label: 'Total Distance', value: `${Number(data?.total_distance_km || 0).toFixed(2)} km` },
  ];

  return (
    <div className="page-enter">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 18 }}>Earnings & Payout Ledger</h1>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card card-glass" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>Order-Wise Earnings History</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Restaurant</th>
                  <th>Date</th>
                  <th>Distance (km)</th>
                  <th>Base</th>
                  <th>Per KM</th>
                  <th>Incentives</th>
                  <th>Final</th>
                  <th>Payout Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.earnings_history || []).map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 700 }}>{e.order_number}</td>
                    <td>{e.restaurant_name}</td>
                    <td>{formatDateTime(e.delivered_at)}</td>
                    <td>{e.distance_status === 'CALCULATED' ? `${e.eligible_distance_km} km` : 'Unavailable'}</td>
                    <td>{formatCurrency(e.base_amount)}</td>
                    <td>{formatCurrency(e.per_km_rate)}</td>
                    <td>{formatCurrency(e.incentives)}</td>
                    <td style={{ fontWeight: 800 }}>{formatCurrency(e.final_earnings)}</td>
                    <td>
                      <span className={`badge ${e.payout_status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                        {e.payout_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card card-glass">
        <div className="card-body">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>Bank Payout History</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Transaction Ref</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Paid At</th>
                </tr>
              </thead>
              <tbody>
                {(data?.payout_history || []).map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.transaction_reference}</td>
                    <td>{p.payment_method}</td>
                    <td>{formatCurrency(p.amount)}</td>
                    <td><span className="badge badge-success">{p.status}</span></td>
                    <td>{formatDateTime(p.paid_at)}</td>
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

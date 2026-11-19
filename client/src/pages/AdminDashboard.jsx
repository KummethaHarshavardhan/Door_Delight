import React, { useEffect, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  DollarSign,
  Package,
  ShoppingBag,
  Store,
  Users,
  Utensils,
  XCircle,
} from 'lucide-react';
import { adminAPI } from '../services/api';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI
      .getDashboard()
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading admin dashboard...</p>;
  const c = data?.counts || {};

  const statItems = [
    { label: 'Total Revenue', value: formatCurrency(c.total_revenue), grad: 'grad-coral', icon: DollarSign },
    { label: 'Total Orders', value: c.total_orders ?? 0, grad: 'grad-violet', icon: Package },
    { label: 'Active Orders', value: c.active_orders ?? 0, grad: 'grad-gold', icon: ShoppingBag },
    { label: 'Completed Orders', value: c.completed_orders ?? 0, grad: 'grad-mint', icon: CheckCircle2 },
    { label: 'Cancelled Orders', value: c.cancelled_orders ?? 0, grad: 'grad-coral', icon: XCircle },
    { label: 'Customers', value: c.total_customers ?? 0, grad: 'grad-violet', icon: Users },
    { label: 'Restaurants', value: c.total_restaurants ?? 0, grad: 'grad-mint', icon: Store },
    { label: 'Food Items', value: c.total_food_items ?? 0, grad: 'grad-gold', icon: Utensils },
    { label: 'Delivery Partners', value: c.total_delivery_partners ?? 0, grad: 'grad-violet', icon: Bike },
  ];

  const maxRestRev = Math.max(...(data?.restaurant_performance || []).map((r) => r.revenue || 0), 1);

  return (
    <div className="page-enter">
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 18 }}>Platform Overview</h1>

      <div className="grid grid-4" style={{ marginBottom: 28 }}>
        {statItems.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="stat-card">
              <div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
              </div>
              <div className={`stat-icon-box ${s.grad}`}>
                <Icon size={22} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card card-glass">
          <div className="card-body">
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 14 }}>Restaurant Revenue Performance</h2>
            {(data?.restaurant_performance || []).length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No restaurant sales yet.</p>
            ) : (
              (data?.restaurant_performance || []).map((r) => {
                const pct = Math.round(((r.revenue || 0) / maxRestRev) * 100);
                return (
                  <div key={r.restaurant_id} className="chart-bar-row">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700 }}>
                      <span>{r.restaurant_name} ({r.orders_count} orders)</span>
                      <span>{formatCurrency(r.revenue)}</span>
                    </div>
                    <div className="chart-bar-track">
                      <div className="chart-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card card-glass">
          <div className="card-body">
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>Popular Food Items</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Dish</th>
                    <th>Ordered</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.popular_food_items || []).map((item) => (
                    <tr key={item.food_item_id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>{item.total_ordered}</td>
                      <td>{formatCurrency(item.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="card card-glass">
        <div className="card-body">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>Recent Orders</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Restaurant</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent_orders || []).map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 700 }}>{o.order_number}</td>
                    <td>{o.customer_name}</td>
                    <td>{o.restaurant_name}</td>
                    <td>{formatCurrency(o.total_amount)}</td>
                    <td><OrderStatusBadge status={o.status} /></td>
                    <td>{formatDateTime(o.created_at)}</td>
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

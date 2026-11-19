import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, DollarSign, Package } from 'lucide-react';
import { managerAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';

export default function ManagerDashboard() {
  const [restaurant, setRestaurant] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [restRes, anaRes] = await Promise.all([
          managerAPI.getRestaurant(),
          managerAPI.getAnalytics(),
        ]);
        setRestaurant(restRes.data.restaurant);
        setAnalytics(anaRes.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <p>Loading restaurant dashboard...</p>;

  if (!restaurant) {
    return (
      <div className="card card-glass card-body page-enter">
        <h2 style={{ fontWeight: 800, marginBottom: 8 }}>No Restaurant Assigned Yet</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          Create your restaurant profile in Settings or ask an Admin to assign one to your account.
        </p>
        <Link to="/manager/settings" className="btn btn-primary btn-sm">
          Create Restaurant Profile
        </Link>
      </div>
    );
  }

  const maxItemQty = Math.max(...(analytics?.top_items || []).map((i) => i.quantity || 0), 1);

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{restaurant.name}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {restaurant.address}, {restaurant.city}
          </p>
        </div>
        <span className={`badge ${restaurant.is_open ? 'badge-success' : 'badge-danger'}`}>
          {restaurant.is_open ? 'Accepting Orders' : 'Closed'}
        </span>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 26 }}>
        <div className="stat-card">
          <div>
            <div className="stat-label">Total Orders</div>
            <div className="stat-value">{analytics?.total_orders ?? 0}</div>
          </div>
          <div className="stat-icon-box grad-violet"><Package size={22} /></div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Active Orders</div>
            <div className="stat-value">{analytics?.active_orders ?? 0}</div>
          </div>
          <div className="stat-icon-box grad-gold"><Clock size={22} /></div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Completed</div>
            <div className="stat-value">{analytics?.completed_orders ?? 0}</div>
          </div>
          <div className="stat-icon-box grad-mint"><CheckCircle2 size={22} /></div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value">{formatCurrency(analytics?.total_revenue ?? 0)}</div>
          </div>
          <div className="stat-icon-box grad-coral"><DollarSign size={22} /></div>
        </div>
      </div>

      <div className="card card-glass">
        <div className="card-body">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 14 }}>Top Selling Dishes</h2>
          {analytics?.top_items?.length ? (
            analytics.top_items.map((item) => (
              <div key={item.name} className="chart-bar-row">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700 }}>
                  <span>{item.name} ({item.quantity} sold)</span>
                  <span>{formatCurrency(item.revenue)}</span>
                </div>
                <div className="chart-bar-track">
                  <div className="chart-bar-fill" style={{ width: `${Math.round((item.quantity / maxItemQty) * 100)}%` }} />
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No orders yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CreditCard,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShieldCheck,
  Store,
  Users,
  Utensils,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dash-shell">
      <header className="mobile-only-header">
        <div className="brand">
          <span className="brand-badge">
            <ShieldCheck size={18} />
          </span>
          <span>Admin Console</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeToggle />
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout} aria-label="Logout">
            <LogOut size={15} />
          </button>
        </div>
      </header>
      <aside className="dash-sidebar">
        <div className="brand">
          <span className="brand-badge">
            <ShieldCheck size={18} />
          </span>
          <span>Admin Console</span>
        </div>
        <NavLink to="/admin" end className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={17} /> Dashboard
        </NavLink>
        <NavLink to="/admin/users" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <Users size={17} /> Users
        </NavLink>
        <NavLink to="/admin/restaurants" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <Store size={17} /> Restaurants
        </NavLink>
        <NavLink to="/admin/foods" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <Utensils size={17} /> Food Items
        </NavLink>
        <NavLink to="/admin/orders" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <Package size={17} /> Orders
        </NavLink>
        <NavLink to="/admin/payments" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <CreditCard size={17} /> Payments
        </NavLink>
        <NavLink to="/admin/kyc" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <FileCheck2 size={17} /> Rider KYC
        </NavLink>
        <NavLink to="/admin/payouts" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <Wallet size={17} /> Payouts & Rates
        </NavLink>
        <NavLink to="/admin/cod-incidents" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <AlertTriangle size={17} /> COD Incidents
        </NavLink>
        <NavLink to="/admin/cod-settlements" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <CreditCard size={17} /> COD Settlements
        </NavLink>
        <NavLink to="/admin/analytics" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <BarChart3 size={17} /> Analytics & AI
        </NavLink>
        <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', paddingLeft: 10 }}>
            {user?.email}
          </div>
          <ThemeToggle />
          <button type="button" className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={handleLogout}>
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>
      <main className="dash-main">
        <Outlet />
      </main>
      <nav className="mobile-bottom-nav" aria-label="Admin mobile navigation">
        <NavLink to="/admin" end className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={19} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/admin/orders" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Package size={19} />
          <span>Orders</span>
        </NavLink>
        <NavLink to="/admin/kyc" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <FileCheck2 size={19} />
          <span>KYC</span>
        </NavLink>
        <NavLink to="/admin/cod-settlements" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <CreditCard size={19} />
          <span>COD</span>
        </NavLink>
        <button
          type="button"
          className={`mobile-bottom-nav-item ${moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen(true)}
        >
          <Menu size={19} />
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="mobile-more-sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="mobile-more-sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '1.05rem' }}>Admin Console Tools</strong>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMoreOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="mobile-more-grid">
              <NavLink to="/admin/users" className="mobile-more-tile" onClick={() => setMoreOpen(false)}>
                <Users size={17} /> Users
              </NavLink>
              <NavLink to="/admin/restaurants" className="mobile-more-tile" onClick={() => setMoreOpen(false)}>
                <Store size={17} /> Restaurants
              </NavLink>
              <NavLink to="/admin/foods" className="mobile-more-tile" onClick={() => setMoreOpen(false)}>
                <Utensils size={17} /> Food Items
              </NavLink>
              <NavLink to="/admin/payments" className="mobile-more-tile" onClick={() => setMoreOpen(false)}>
                <CreditCard size={17} /> Payments
              </NavLink>
              <NavLink to="/admin/payouts" className="mobile-more-tile" onClick={() => setMoreOpen(false)}>
                <Wallet size={17} /> Payouts & Rates
              </NavLink>
              <NavLink to="/admin/cod-incidents" className="mobile-more-tile" onClick={() => setMoreOpen(false)}>
                <AlertTriangle size={17} /> COD Incidents
              </NavLink>
              <NavLink to="/admin/analytics" className="mobile-more-tile" onClick={() => setMoreOpen(false)}>
                <BarChart3 size={17} /> Analytics & AI
              </NavLink>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CreditCard,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Package,
  ShieldCheck,
  Store,
  Users,
  Utensils,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dash-shell">
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
    </div>
  );
}

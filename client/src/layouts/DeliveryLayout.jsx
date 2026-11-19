import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Banknote, Bike, DollarSign, FileCheck2, History, LayoutDashboard, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function DeliveryLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dash-shell">
      <header className="mobile-only-header">
        <div className="brand">
          <span className="brand-badge">
            <Bike size={18} />
          </span>
          <span>Rider Portal</span>
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
            <Bike size={18} />
          </span>
          <span>Rider Portal</span>
        </div>
        <NavLink to="/delivery" end className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={17} /> Active & Pool
        </NavLink>
        <NavLink to="/delivery/earnings" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <DollarSign size={17} /> Earnings & Payouts
        </NavLink>
        <NavLink to="/delivery/cod-settlement" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <Banknote size={17} /> COD Settlement
        </NavLink>
        <NavLink to="/delivery/kyc" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <FileCheck2 size={17} /> KYC Verification
        </NavLink>
        <NavLink to="/delivery/history" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <History size={17} /> Delivery History
        </NavLink>
        <NavLink to="/delivery/profile" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <User size={17} /> Profile
        </NavLink>
        <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', paddingLeft: 10 }}>
            {user?.name}
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
      <nav className="mobile-bottom-nav" aria-label="Delivery partner mobile navigation">
        <NavLink to="/delivery" end className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={19} />
          <span>Active</span>
        </NavLink>
        <NavLink to="/delivery/earnings" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <DollarSign size={19} />
          <span>Earnings</span>
        </NavLink>
        <NavLink to="/delivery/cod-settlement" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Banknote size={19} />
          <span>COD</span>
        </NavLink>
        <NavLink to="/delivery/kyc" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <FileCheck2 size={19} />
          <span>KYC</span>
        </NavLink>
        <NavLink to="/delivery/profile" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <User size={19} />
          <span>Profile</span>
        </NavLink>
      </nav>
    </div>
  );
}

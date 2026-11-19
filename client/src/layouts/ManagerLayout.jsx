import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Banknote, ClipboardList, LayoutDashboard, LogOut, Settings, Utensils, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function ManagerLayout() {
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
            <UtensilsCrossed size={18} />
          </span>
          <span>Partner Hub</span>
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
            <UtensilsCrossed size={18} />
          </span>
          <span>Partner Hub</span>
        </div>
        <NavLink to="/manager" end className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={17} /> Dashboard
        </NavLink>
        <NavLink to="/manager/orders" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <ClipboardList size={17} /> Orders
        </NavLink>
        <NavLink to="/manager/menu" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <Utensils size={17} /> Menu Management
        </NavLink>
        <NavLink to="/manager/cod-settlements" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <Banknote size={17} /> COD Settlements
        </NavLink>
        <NavLink to="/manager/settings" className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}>
          <Settings size={17} /> Restaurant Info
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
      <nav className="mobile-bottom-nav" aria-label="Restaurant manager mobile navigation">
        <NavLink to="/manager" end className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={19} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/manager/orders" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <ClipboardList size={19} />
          <span>Orders</span>
        </NavLink>
        <NavLink to="/manager/menu" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Utensils size={19} />
          <span>Menu</span>
        </NavLink>
        <NavLink to="/manager/cod-settlements" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Banknote size={19} />
          <span>COD</span>
        </NavLink>
        <NavLink to="/manager/settings" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Settings size={19} />
          <span>Info</span>
        </NavLink>
      </nav>
    </div>
  );
}

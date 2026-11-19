import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, LogOut, Package, ShoppingCart, User, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import AIChatWidget from '../components/AIChatWidget';
import FlyToCartOverlay from '../components/FlyToCartOverlay';
import ThemeToggle from '../components/ThemeToggle';

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const { cart, cartBounce } = useCart();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="navbar">
        <div className="container navbar-inner">
          <NavLink to="/customer" className="brand">
            <span className="brand-badge">
              <UtensilsCrossed size={20} />
            </span>
            <span>DoorDelight</span>
          </NavLink>

          <nav className="nav-links">
            <NavLink to="/customer" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Home size={16} /> Explore
            </NavLink>
            <NavLink to="/customer/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Package size={16} /> Orders
            </NavLink>
            <NavLink
              to="/customer/cart"
              data-cart-target="true"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              style={{
                transform: cartBounce ? 'scale(1.22)' : 'scale(1)',
                transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <ShoppingCart size={16} /> Cart ({cart.item_count || 0})
            </NavLink>
            <NavLink to="/customer/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <User size={16} /> {user?.name?.split(' ')[0] || 'Profile'}
            </NavLink>
            <ThemeToggle />
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
              <LogOut size={15} /> Logout
            </button>
          </nav>
        </div>
      </header>

      <main className="container" style={{ flex: 1, paddingTop: 18, paddingBottom: 64 }}>
        <Outlet />
      </main>

      <FlyToCartOverlay />
      <AIChatWidget />
    </div>
  );
}

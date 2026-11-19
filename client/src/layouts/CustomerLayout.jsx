import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Heart, Home, LogOut, Package, Search, ShoppingCart, User, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import AIChatWidget from '../components/AIChatWidget';
import FlyToCartOverlay from '../components/FlyToCartOverlay';
import ThemeToggle from '../components/ThemeToggle';
import { formatCurrency } from '../utils/formatters';

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const { cart, cartBounce } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isSearchTab = location.pathname === '/customer' && searchParams.get('focus') === 'search';
  const isFavTab = location.pathname === '/customer' && searchParams.get('tab') === 'favorites';
  const isHomeTab = location.pathname === '/customer' && !isSearchTab && !isFavTab;
  const isCartOrCheckout =
    location.pathname.startsWith('/customer/cart') ||
    location.pathname.startsWith('/customer/checkout');
  const showFloatingCart = (cart.item_count || 0) > 0 && !isCartOrCheckout;

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

          {/* Mobile compact header actions */}
          <div className="mobile-only-actions">
            <NavLink to="/customer/cart" className="mobile-cart-pill" data-cart-target="true">
              <ShoppingCart size={15} />
              <span>{cart.item_count || 0}</span>
            </NavLink>
            <ThemeToggle />
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout} aria-label="Logout">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main
        className={`container ${showFloatingCart ? 'has-floating-cart' : ''}`}
        style={{ flex: 1, paddingTop: 18, paddingBottom: 64 }}
      >
        <Outlet />
      </main>

      {/* Swiggy/Zomato-style Sticky Floating View Cart Bar (Mobile only) */}
      {showFloatingCart && (
        <NavLink to="/customer/cart" className="mobile-floating-cart" aria-label="View Cart">
          <div>
            <div style={{ fontSize: '0.78rem', opacity: 0.92 }}>
              {cart.item_count} {cart.item_count === 1 ? 'item' : 'items'} in cart
            </div>
            <div style={{ fontSize: '0.98rem', fontWeight: 800 }}>
              {formatCurrency(cart.total_amount || cart.subtotal || 0)}
            </div>
          </div>
          <span className="mobile-floating-cart-cta">
            <ShoppingCart size={16} /> View Cart
          </span>
        </NavLink>
      )}

      {/* Swiggy/Zomato-style Fixed Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav" aria-label="Customer mobile navigation">
        <NavLink to="/customer" className={`mobile-bottom-nav-item ${isHomeTab ? 'active' : ''}`}>
          <Home size={19} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/customer?focus=search" className={`mobile-bottom-nav-item ${isSearchTab ? 'active' : ''}`}>
          <Search size={19} />
          <span>Search</span>
        </NavLink>
        <NavLink to="/customer/orders" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Package size={19} />
          <span>Orders</span>
        </NavLink>
        <NavLink to="/customer?tab=favorites" className={`mobile-bottom-nav-item ${isFavTab ? 'active' : ''}`}>
          <Heart size={19} />
          <span>Favorites</span>
        </NavLink>
        <NavLink to="/customer/profile" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <User size={19} />
          <span>Profile</span>
        </NavLink>
      </nav>

      <FlyToCartOverlay />
      <AIChatWidget />
    </div>
  );
}

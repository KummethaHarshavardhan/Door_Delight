import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import AnimeIntro from './components/AnimeIntro';
import ProtectedRoute from './components/ProtectedRoute';
import CustomerLayout from './layouts/CustomerLayout';
import ManagerLayout from './layouts/ManagerLayout';
import DeliveryLayout from './layouts/DeliveryLayout';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CustomerDashboard from './pages/CustomerDashboard';
import RestaurantDetailPage from './pages/RestaurantDetailPage';
import CartCheckoutPage from './pages/CartCheckoutPage';
import CheckoutLocationPage from './pages/CheckoutLocationPage';
import CheckoutPaymentPage from './pages/CheckoutPaymentPage';
import FindingPartnerPage from './pages/FindingPartnerPage';
import CustomerOrdersPage from './pages/CustomerOrdersPage';
import OrderTrackPage from './pages/OrderTrackPage';
import CustomerProfilePage from './pages/CustomerProfilePage';
import ManagerDashboard from './pages/ManagerDashboard';
import ManagerOrdersPage from './pages/ManagerOrdersPage';
import ManagerMenuPage from './pages/ManagerMenuPage';
import ManagerCODPage from './pages/ManagerCODPage';
import ManagerSettingsPage from './pages/ManagerSettingsPage';
import DeliveryDashboard from './pages/DeliveryDashboard';
import DeliveryEarningsPage from './pages/DeliveryEarningsPage';
import DeliveryCODSettlementPage from './pages/DeliveryCODSettlementPage';
import DeliveryHistoryPage from './pages/DeliveryHistoryPage';
import DeliveryKYCPage from './pages/DeliveryKYCPage';
import DeliveryProfilePage from './pages/DeliveryProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminRestaurantsPage from './pages/AdminRestaurantsPage';
import AdminFoodsPage from './pages/AdminFoodsPage';
import AdminOrdersPage from './pages/AdminOrdersPage';
import AdminPaymentsPage from './pages/AdminPaymentsPage';
import AdminKYCPage from './pages/AdminKYCPage';
import AdminPayoutsPage from './pages/AdminPayoutsPage';
import AdminCODPage from './pages/AdminCODPage';
import AdminCODSettlementsPage from './pages/AdminCODSettlementsPage';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import { getRoleHomePath } from './utils/formatters';

function RootRedirect() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={getRoleHomePath(user.role)} replace />;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  const [introDone, setIntroDone] = useState(
    () => sessionStorage.getItem('dd_intro_seen') === '1'
  );

  // Wait for JWT validation BEFORE deciding whether to show the intro
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Verifying session...</p>
      </div>
    );
  }

  // Show 15-second anime intro ONLY to unauthenticated first-time visitors
  if (!isAuthenticated && !introDone) {
    return (
      <AnimeIntro
        onComplete={() => {
          sessionStorage.setItem('dd_intro_seen', '1');
          setIntroDone(true);
        }}
      />
    );
  }

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Customer Routes */}
      <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
        <Route path="/customer" element={<CustomerLayout />}>
          <Route index element={<CustomerDashboard />} />
          <Route path="restaurants/:id" element={<RestaurantDetailPage />} />
          <Route path="cart" element={<CartCheckoutPage />} />
          <Route path="checkout/location" element={<CheckoutLocationPage />} />
          <Route path="checkout/payment" element={<CheckoutPaymentPage />} />
          <Route path="orders" element={<CustomerOrdersPage />} />
          <Route path="orders/:orderId/finding" element={<FindingPartnerPage />} />
          <Route path="orders/:orderId" element={<OrderTrackPage />} />
          <Route path="profile" element={<CustomerProfilePage />} />
        </Route>
      </Route>

      {/* Restaurant Manager Routes */}
      <Route element={<ProtectedRoute allowedRoles={['RESTAURANT_MANAGER']} />}>
        <Route path="/manager" element={<ManagerLayout />}>
          <Route index element={<ManagerDashboard />} />
          <Route path="orders" element={<ManagerOrdersPage />} />
          <Route path="menu" element={<ManagerMenuPage />} />
          <Route path="cod-settlements" element={<ManagerCODPage />} />
          <Route path="settings" element={<ManagerSettingsPage />} />
        </Route>
      </Route>

      {/* Delivery Partner Routes */}
      <Route element={<ProtectedRoute allowedRoles={['DELIVERY_PARTNER']} />}>
        <Route path="/delivery" element={<DeliveryLayout />}>
          <Route index element={<DeliveryDashboard />} />
          <Route path="earnings" element={<DeliveryEarningsPage />} />
          <Route path="cod-settlement" element={<DeliveryCODSettlementPage />} />
          <Route path="kyc" element={<DeliveryKYCPage />} />
          <Route path="history" element={<DeliveryHistoryPage />} />
          <Route path="profile" element={<DeliveryProfilePage />} />
        </Route>
      </Route>

      {/* Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="restaurants" element={<AdminRestaurantsPage />} />
          <Route path="foods" element={<AdminFoodsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="kyc" element={<AdminKYCPage />} />
          <Route path="payouts" element={<AdminPayoutsPage />} />
          <Route path="cod-incidents" element={<AdminCODPage />} />
          <Route path="cod-settlements" element={<AdminCODSettlementsPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <CartProvider>
                <AppRoutes />
              </CartProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </MotionConfig>
  );
}

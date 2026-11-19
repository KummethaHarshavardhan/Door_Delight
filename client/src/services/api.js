import axios from 'axios';

const resolveApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
  if (configured) {
    return configured.endsWith('/api') ? configured : `${configured}/api`;
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'door-delight-1.onrender.com') {
    return 'https://door-delight.onrender.com/api';
  }
  return 'http://localhost:8000/api';
};

export const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('dd_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('dd_token');
      localStorage.removeItem('dd_user');
      if (
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/register')
      ) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/password', data),
};

export const catalogAPI = {
  getCategories: () => api.get('/categories'),
  createCategory: (data) => api.post('/categories', data),
  getRestaurants: (params) => api.get('/restaurants', { params }),
  getRestaurant: (id) => api.get(`/restaurants/${id}`),
  createRestaurant: (data) => api.post('/restaurants', data),
  updateRestaurant: (id, data) => api.put(`/restaurants/${id}`, data),
  deleteRestaurant: (id) => api.delete(`/restaurants/${id}`),
  getFoods: (params) => api.get('/foods', { params }),
  getFood: (id) => api.get(`/foods/${id}`),
  createFood: (data) => api.post('/foods', data),
  updateFood: (id, data) => api.put(`/foods/${id}`, data),
  deleteFood: (id) => api.delete(`/foods/${id}`),
  submitReview: (data) => api.post('/reviews', data),
};

export const cartAPI = {
  getCart: () => api.get('/cart'),
  addItem: (data) => api.post('/cart/items', data),
  updateItem: (itemId, data) => api.put(`/cart/items/${itemId}`, data),
  removeItem: (itemId) => api.delete(`/cart/items/${itemId}`),
  clearCart: () => api.delete('/cart'),
};

export const addressAPI = {
  list: () => api.get('/addresses'),
  create: (data) => api.post('/addresses', data),
  update: (id, data) => api.put(`/addresses/${id}`, data),
  remove: (id) => api.delete(`/addresses/${id}`),
};

export const orderAPI = {
  place: (data) => api.post('/orders', data),
  list: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, data) => api.put(`/orders/${id}/status`, data),
};

export const paymentAPI = {
  createRazorpayOrder: (data) => api.post('/payments/razorpay/create', data),
  verifyRazorpay: (data) => api.post('/payments/razorpay/verify', data),
  failRazorpay: (data) => api.post('/payments/razorpay/fail', data),
};

export const managerAPI = {
  getRestaurant: () => api.get('/manager/restaurant'),
  getOrders: () => api.get('/manager/orders'),
  getAnalytics: () => api.get('/manager/analytics'),
  getCodSettlements: () => api.get('/manager/cod-settlements'),
  confirmCodReturned: (orderId) => api.put(`/manager/orders/${orderId}/cod-returned`),
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/manager/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const deliveryAPI = {
  setOnlineStatus: (isOnline) => api.put('/delivery/status', { is_online: isOnline }),
  getAssignments: () => api.get('/delivery/assignments'),
  acceptAssignment: (id) => api.post(`/delivery/assignments/${id}/accept`),
  updateOrderStatus: (orderId, data) => api.put(`/delivery/orders/${orderId}/status`, data),
  reportCodRefused: (orderId, data) => api.post(`/delivery/orders/${orderId}/cod-refused`, data),
  markCodReturnPending: (orderId) => api.put(`/delivery/orders/${orderId}/cod-return-pending`),
  sendLocation: (data) => api.post('/delivery/location', data),
  sendGpsStatus: (data) => api.post('/delivery/location/status', data),
  getEarnings: () => api.get('/delivery/earnings'),
  getCodSettlements: () => api.get('/delivery/cod-settlements'),
  payCodSettlement: (data) => api.post('/delivery/cod-settlements/pay', data),
  getHistory: () => api.get('/delivery/history'),
};

export const kycAPI = {
  getMyKyc: () => api.get('/kyc/me'),
  submitMyKyc: (formData) =>
    api.post('/kyc/submit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  adminListKyc: (params) => api.get('/admin/kyc', { params }),
  adminSubmitKyc: (partnerId, formData) =>
    api.post(`/admin/kyc/${partnerId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  adminReviewKyc: (partnerId, data) => api.post(`/admin/kyc/${partnerId}/review`, data),
  adminFetchDocBlob: (partnerId, docType) =>
    api.get(`/admin/kyc/${partnerId}/documents/${docType}`, { responseType: 'blob' }),
};

export const payoutAPI = {
  getRates: () => api.get('/admin/delivery-rates'),
  updateRates: (data) => api.put('/admin/delivery-rates', data),
  getSummary: () => api.get('/admin/payouts/summary'),
  processPayout: (data) => api.post('/admin/payouts', data),
  exportCsvBlob: () => api.get('/admin/payouts/export', { responseType: 'blob' }),
};

export const codAPI = {
  listIncidents: () => api.get('/admin/cod-incidents'),
  resolveIncident: (incidentId, data) => api.put(`/admin/cod-incidents/${incidentId}/resolve`, data),
  adminGetSettlements: () => api.get('/admin/cod-settlements'),
  adminVerifySettlement: (settlementId, data) => api.post(`/admin/cod-settlements/${settlementId}/verify`, data),
  adminRestorePartner: (partnerId, data) => api.post(`/admin/cod-partners/${partnerId}/restore`, data),
  adminRunReminders: () => api.post('/admin/cod-reminders/run'),
  adminExportSettlementsCsv: () => api.get('/admin/cod-settlements/export', { responseType: 'blob' }),
};

export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params) => api.get('/admin/users', { params }),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getRestaurants: () => api.get('/admin/restaurants'),
  getFoods: () => api.get('/admin/foods'),
  getOrders: (params) => api.get('/admin/orders', { params }),
  getPayments: () => api.get('/admin/payments'),
  getAnalytics: () => api.get('/admin/analytics'),
};

export const aiAPI = {
  chat: (message) => api.post('/ai/chat', { message }),
  recommendations: (data) => api.post('/ai/recommendations', data),
  adminAnalytics: (question) => api.post('/ai/admin-analytics', { question }),
};

export default api;

export const formatCurrency = (amount) => {
  const num = Number(amount || 0);
  return `₹${num.toFixed(2)}`;
};

export const formatDateTime = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
};

export const resolveImageUrl = (url) => {
  if (!url) {
    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&auto=format&fit=crop';
  }
  if (url.startsWith('/uploads/')) {
    const configured = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
    const apiBase =
      configured ||
      (typeof window !== 'undefined' && window.location.hostname === 'door-delight-1.onrender.com'
        ? 'https://door-delight.onrender.com/api'
        : 'http://localhost:8000/api');
    const hostBase = apiBase.replace(/\/api\/?$/, '');
    return `${hostBase}${url}`;
  }
  return url;
};

export const getRoleHomePath = (role) => {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'RESTAURANT_MANAGER':
      return '/manager';
    case 'DELIVERY_PARTNER':
      return '/delivery';
    case 'CUSTOMER':
    default:
      return '/customer';
  }
};

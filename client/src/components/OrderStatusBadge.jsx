import React from 'react';

const STATUS_STYLE_MAP = {
  PLACED: 'badge-info',
  CONFIRMED: 'badge-info',
  PREPARING: 'badge-warning',
  READY_FOR_PICKUP: 'badge-warning',
  PICKED_UP: 'badge-info',
  OUT_FOR_DELIVERY: 'badge-info',
  DELIVERED: 'badge-success',
  CANCELLED: 'badge-danger',
  REJECTED: 'badge-danger',
  PAID: 'badge-success',
  COD_COLLECTED: 'badge-success',
  COD_PENDING: 'badge-warning',
  PENDING: 'badge-warning',
  FAILED: 'badge-danger',
  REFUNDED: 'badge-neutral',
};

export default function OrderStatusBadge({ status }) {
  const cls = STATUS_STYLE_MAP[status] || 'badge-neutral';
  const label = (status || 'UNKNOWN').replace(/_/g, ' ');
  return <span className={`badge ${cls}`}>{label}</span>;
}

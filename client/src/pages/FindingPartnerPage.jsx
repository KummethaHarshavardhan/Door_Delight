import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { orderAPI } from '../services/api';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';
import DeliveryVehicleSVG from '../components/DeliveryVehicleSVG';
import OrderStatusBadge from '../components/OrderStatusBadge';

export default function FindingPartnerPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let active = true;
    const checkOrder = async () => {
      try {
        const res = await orderAPI.getById(orderId);
        if (!active) return;
        const fetched = res.data.order;
        setOrder(fetched);
        if (fetched?.delivery_partner_id) {
          navigate(`/customer/orders/${orderId}`, { replace: true });
        }
      } catch {
        // Ignore transient poll error
      }
    };

    checkOrder();
    const timer = setInterval(checkOrder, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [orderId, navigate]);

  useOrderWebSocket({
    orderId,
    enabled: Boolean(orderId),
    onMessage: (data) => {
      if (data?.order && data.order.id === orderId) {
        setOrder(data.order);
        if (data.order.delivery_partner_id) {
          navigate(`/customer/orders/${orderId}`, { replace: true });
        }
      }
    },
  });

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 110px)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
    >
      <div className="card card-glass" style={{ maxWidth: 680, width: '100%', overflow: 'hidden' }}>
        <div style={{ position: 'relative', height: 280 }}>
          <motion.img
            src="/anime/delivery-riding.jpg"
            alt="Finding DoorDelight Delivery Partner"
            animate={{ scale: [1.0, 1.06, 1.0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(8,12,29,0.92) 0%, rgba(8,12,29,0.28) 65%)',
            }}
          />
          <div style={{ position: 'absolute', bottom: 20, left: 24, right: 24, color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <DeliveryVehicleSVG />
              <span className="badge badge-warning">Searching Nearby Riders</span>
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Finding Your Delivery Partner...</h1>
          </div>
        </div>

        <div className="card-body" style={{ padding: 24 }}>
          {order ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <strong>Order {order.order_number}</strong>
                <OrderStatusBadge status={order.status} />
              </div>
              <div style={{ fontSize: '0.92rem', color: 'var(--text-muted)' }}>
                Restaurant: <strong>{order.restaurant_name}</strong>
              </div>
              <div style={{ fontSize: '0.92rem', color: 'var(--text-muted)' }}>
                Payment: <strong>{order.payment_method}</strong> ({order.payment_status})
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Confirming order details...</p>
          )}

          <div className="chart-bar-track" style={{ marginTop: 18, height: 10 }}>
            <motion.div
              className="chart-bar-fill"
              animate={{ width: ['18%', '86%', '18%'] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 14 }}>
            This screen will automatically transition to Live Tracking the moment a delivery partner accepts your order.
          </p>
        </div>
      </div>
    </div>
  );
}

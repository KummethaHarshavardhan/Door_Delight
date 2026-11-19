import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Navigation, Phone } from 'lucide-react';
import { orderAPI } from '../services/api';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';
import DeliveryVehicleSVG from '../components/DeliveryVehicleSVG';
import OrderStatusBadge from '../components/OrderStatusBadge';
import OrderTimeline from '../components/OrderTimeline';
import { formatCurrency, formatDateTime } from '../utils/formatters';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }
    const existing = document.getElementById('dd-google-maps-sdk');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google?.maps));
      return;
    }
    const script = document.createElement('script');
    script.id = 'dd-google-maps-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google?.maps);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

const PROGRESS_MAP = {
  PLACED: 12,
  CONFIRMED: 24,
  PREPARING: 40,
  READY_FOR_PICKUP: 54,
  REACHED_RESTAURANT: 64,
  PICKED_UP: 75,
  OUT_FOR_DELIVERY: 88,
  REACHED_CUSTOMER: 95,
  DELIVERED: 100,
};

function getDeliveryScene(order) {
  const s = order?.status;
  if (s === 'DELIVERED') {
    return {
      img: '/anime/delivery-arrived.jpg',
      title: 'Order Delivered with Delight!',
      subtitle: `${order.delivery_partner_name || 'Your rider'} has completed the delivery.`,
    };
  }
  if (s === 'PICKED_UP' || s === 'OUT_FOR_DELIVERY' || s === 'REACHED_CUSTOMER') {
    return {
      img: '/anime/delivery-riding.jpg',
      title: s === 'REACHED_CUSTOMER' ? 'Rider Has Arrived!' : 'On the Road to You',
      subtitle: `${order.delivery_partner_name || 'Your rider'} is ${s === 'REACHED_CUSTOMER' ? 'at your doorstep' : 'heading your way'}.`,
    };
  }
  if ((s === 'READY_FOR_PICKUP' || s === 'REACHED_RESTAURANT') && order?.delivery_partner_id) {
    return {
      img: '/anime/delivery-pickup.jpg',
      title: 'Partner Arrived at Restaurant',
      subtitle: `${order.delivery_partner_name} is picking up your sealed package from ${order.restaurant_name}.`,
    };
  }
  if (s === 'CANCELLED' || s === 'REJECTED') {
    return null;
  }
  return {
    img: '/anime/delivery-finding.jpg',
    title: s === 'READY_FOR_PICKUP' ? 'Finding Your Delivery Partner...' : 'Preparing Your Fresh Meal...',
    subtitle: `Order ${order.order_number} is being handled at ${order.restaurant_name}.`,
  };
}

export default function OrderTrackPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapsReady, setMapsReady] = useState(false);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const restMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const routeLineRef = useRef(null);

  const fetchOrder = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await orderAPI.getById(orderId);
      setOrder(res.data.order);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    const pollTimer = setInterval(() => {
      fetchOrder({ silent: true });
    }, 5000);
    return () => clearInterval(pollTimer);
  }, [fetchOrder]);

  useOrderWebSocket({
    orderId,
    enabled: Boolean(orderId),
    onMessage: (data) => {
      if (data?.order && data.order.id === orderId) {
        setOrder(data.order);
      }
    },
  });

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) return;
    loadGoogleMapsScript(GOOGLE_MAPS_KEY)
      .then((maps) => {
        if (maps) setMapsReady(true);
      })
      .catch(() => {});
  }, []);

  // Update interactive Google Map markers smoothly whenever real GPS or destination coords update
  useEffect(() => {
    if (!mapsReady || !mapContainerRef.current || !order) return;
    const maps = window.google?.maps;
    if (!maps) return;

    const riderLoc = order.partner_location;
    const destLoc = order.delivery_address;
    const restLoc = order.restaurant_location;

    const center =
      riderLoc && typeof riderLoc.lat === 'number' && typeof riderLoc.lng === 'number'
        ? { lat: riderLoc.lat, lng: riderLoc.lng }
        : destLoc && typeof destLoc.lat === 'number' && typeof destLoc.lng === 'number'
          ? { lat: destLoc.lat, lng: destLoc.lng }
          : null;

    if (!center) return;

    if (!mapRef.current) {
      mapRef.current = new maps.Map(mapContainerRef.current, {
        center,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
      });
    }

    const bounds = new maps.LatLngBounds();

    if (riderLoc && typeof riderLoc.lat === 'number' && typeof riderLoc.lng === 'number') {
      const pos = { lat: riderLoc.lat, lng: riderLoc.lng };
      bounds.extend(pos);
      if (!riderMarkerRef.current) {
        riderMarkerRef.current = new maps.Marker({
          position: pos,
          map: mapRef.current,
          title: order.delivery_partner_name || 'Delivery Rider',
          label: 'R',
        });
      } else {
        riderMarkerRef.current.setPosition(pos);
      }
    }

    if (restLoc && typeof restLoc.lat === 'number' && typeof restLoc.lng === 'number') {
      const pos = { lat: restLoc.lat, lng: restLoc.lng };
      bounds.extend(pos);
      if (!restMarkerRef.current) {
        restMarkerRef.current = new maps.Marker({
          position: pos,
          map: mapRef.current,
          title: order.restaurant_name || 'Restaurant',
          label: 'S',
        });
      }
    }

    if (destLoc && typeof destLoc.lat === 'number' && typeof destLoc.lng === 'number') {
      const pos = { lat: destLoc.lat, lng: destLoc.lng };
      bounds.extend(pos);
      if (!destMarkerRef.current) {
        destMarkerRef.current = new maps.Marker({
          position: pos,
          map: mapRef.current,
          title: 'Delivery Destination',
          label: 'D',
        });
      }
    }

    if (
      riderLoc &&
      typeof riderLoc.lat === 'number' &&
      destLoc &&
      typeof destLoc.lat === 'number'
    ) {
      const path = [
        { lat: riderLoc.lat, lng: riderLoc.lng },
        { lat: destLoc.lat, lng: destLoc.lng },
      ];
      if (!routeLineRef.current) {
        routeLineRef.current = new maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#f97316',
          strokeOpacity: 0.85,
          strokeWeight: 4,
          map: mapRef.current,
        });
      } else {
        routeLineRef.current.setPath(path);
      }
    }

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, 48);
    }
  }, [mapsReady, order]);

  if (loading) return <p>Loading order tracking...</p>;
  if (!order) return <div className="card card-body">Order not found.</div>;

  const progressPct = PROGRESS_MAP[order.status] || 0;
  const scene = getDeliveryScene(order);
  const loc = order.partner_location;

  return (
    <div className="page-enter">
      {/* Cinematic Anime Delivery Stage */}
      {scene && (
        <div className="card card-glass" style={{ marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ position: 'relative', height: 270 }}>
            <img
              src={scene.img}
              alt={scene.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(8,12,29,0.88) 0%, rgba(8,12,29,0.2) 60%)',
              }}
            />
            <div style={{ position: 'absolute', bottom: 20, left: 24, right: 24, color: '#fff' }}>
              <OrderStatusBadge status={order.status} />
              <h2 style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: 8 }}>{scene.title}</h2>
              <p style={{ color: '#e2e8f0', fontSize: '0.94rem' }}>{scene.subtitle}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
        <div className="card card-glass">
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{order.order_number}</h1>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Placed on {formatDateTime(order.created_at)}
                </div>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>

            {progressPct > 0 && (
              <div className="delivery-track-road">
                <div className="delivery-track-fill" style={{ width: `${progressPct}%` }} />
                <div className="delivery-scooter-anim">
                  <DeliveryVehicleSVG />
                  <span>
                    {order.status === 'DELIVERED'
                      ? 'Delivered! Enjoy your meal'
                      : `Live Progress: ${progressPct}% — ${order.status.replace(/_/g, ' ')}`}
                  </span>
                </div>
              </div>
            )}

            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Live Order Timeline</h3>
            <OrderTimeline status={order.status} history={order.status_history || []} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Real-Time Rider GPS Location Panel */}
          <div className="card card-glass">
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
                  <Navigation size={18} color="var(--primary)" /> Live Rider Location
                </div>
                {loc?.accuracy != null && (
                  <span className="badge badge-neutral">±{Math.round(loc.accuracy)}m</span>
                )}
              </div>
              {loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' ? (
                <div>
                  {mapsReady ? (
                    <div
                      ref={mapContainerRef}
                      style={{ width: '100%', height: 230, borderRadius: 12, marginBottom: 10 }}
                    />
                  ) : (
                    <iframe
                      title="Rider Live Map"
                      width="100%"
                      height="210"
                      style={{ border: 0, borderRadius: 12, marginBottom: 10 }}
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng - 0.01},${loc.lat - 0.01},${loc.lng + 0.01},${loc.lat + 0.01}&layer=mapnik&marker=${loc.lat},${loc.lng}`}
                    />
                  )}
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <span>
                      <MapPin size={13} /> {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                    </span>
                    <span>Updated: {formatDateTime(loc.updated_at)}</span>
                  </div>
                  {loc.updated_at && Date.now() - new Date(loc.updated_at).getTime() > 60000 && order.status !== 'DELIVERED' && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: 6 }}>
                      Last location update is stale (over 60 seconds ago).
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  {!order.delivery_partner_id
                    ? 'Live GPS will appear once a delivery partner accepts your order and shares location.'
                    : order.partner_gps_status === 'PERMISSION_DENIED'
                      ? 'Rider denied location permission on their device.'
                      : order.partner_gps_status === 'GPS_UNAVAILABLE'
                        ? 'GPS is currently unavailable on the rider device.'
                        : order.partner_gps_status === 'TIMEOUT'
                          ? 'Rider GPS signal timed out; waiting for satellite lock.'
                          : order.partner_gps_status === 'STOPPED'
                            ? 'Rider stopped live location sharing.'
                            : 'Waiting for rider location...'}
                </p>
              )}
            </div>
          </div>

          <div className="card card-glass">
            <div className="card-body">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>Order Summary</h3>
              <div style={{ fontSize: '0.9rem', marginBottom: 8 }}>
                <strong>Restaurant:</strong> {order.restaurant_name}
              </div>
              {order.delivery_partner_name && (
                <div style={{ fontSize: '0.9rem', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span><strong>Delivery Partner:</strong> {order.delivery_partner_name}</span>
                  {order.delivery_partner_phone && (
                    <a href={`tel:${order.delivery_partner_phone}`} className="btn btn-secondary btn-sm">
                      <Phone size={14} /> {order.delivery_partner_phone}
                    </a>
                  )}
                </div>
              )}
              <div style={{ fontSize: '0.9rem', marginBottom: 14 }}>
                <strong>Delivery Address:</strong> {order.delivery_address?.street}, {order.delivery_address?.city} -{' '}
                {order.delivery_address?.pincode}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {order.items.map((item) => (
                  <div key={item.food_item_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <span>{formatCurrency(item.line_total)}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12, fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Delivery Fee</span>
                  <span>{formatCurrency(order.delivery_fee)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tax</span>
                  <span>{formatCurrency(order.tax_amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.08rem', marginTop: 8 }}>
                  <span>Total</span>
                  <span>{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

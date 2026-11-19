import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Star } from 'lucide-react';
import TiltCard3D from './TiltCard3D';
import { formatCurrency, resolveImageUrl } from '../utils/formatters';

export default function RestaurantCard({ restaurant }) {
  return (
    <Link to={`/customer/restaurants/${restaurant.id}`} style={{ display: 'block', height: '100%' }}>
      <TiltCard3D>
        <div style={{ position: 'relative', height: 180, overflow: 'hidden' }}>
          <img
            src={resolveImageUrl(restaurant.image_url)}
            alt={restaurant.name}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <span
            className={`badge ${restaurant.is_open ? 'badge-success' : 'badge-danger'}`}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.16)',
            }}
          >
            {restaurant.is_open ? 'Open Now' : 'Closed'}
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: '1.08rem', fontWeight: 800, letterSpacing: '-0.01em' }}>{restaurant.name}</h3>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontWeight: 800,
                fontSize: '0.86rem',
                background: '#fffbeb',
                padding: '3px 8px',
                borderRadius: 8,
              }}
            >
              <Star size={14} fill="#f59e0b" color="#f59e0b" />
              {Number(restaurant.rating || 0).toFixed(1)}
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 5 }}>
            {(restaurant.cuisine || []).join(' • ') || 'Multi-cuisine'}
          </p>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid var(--border)',
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Clock size={14} color="var(--primary)" /> {restaurant.delivery_time_mins} mins
            </span>
            <span>Delivery {formatCurrency(restaurant.delivery_fee)}</span>
          </div>
        </div>
      </TiltCard3D>
    </Link>
  );
}

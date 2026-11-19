import React, { useRef, useState } from 'react';
import { Check, Eye, Plus, Star } from 'lucide-react';
import TiltCard3D from './TiltCard3D';
import { useCart } from '../context/CartContext';
import { formatCurrency, resolveImageUrl } from '../utils/formatters';

export default function FoodCard({ food, onAddToCart, onInspect }) {
  const { triggerFlyToCart } = useCart();
  const imgRef = useRef(null);
  const [adding, setAdding] = useState(false);
  const [addedPulse, setAddedPulse] = useState(false);

  const handleAdd = async (e) => {
    e.stopPropagation();
    if (!onAddToCart) return;
    setAdding(true);
    try {
      await onAddToCart(food);
      if (imgRef.current) {
        triggerFlyToCart(resolveImageUrl(food.image_url), imgRef.current.getBoundingClientRect());
      }
      setAddedPulse(true);
      setTimeout(() => setAddedPulse(false), 900);
    } finally {
      setAdding(false);
    }
  };

  return (
    <TiltCard3D style={{ display: 'flex', flexDirection: 'column', cursor: onInspect ? 'pointer' : 'default' }}>
      <div
        style={{ position: 'relative', height: 170, overflow: 'hidden' }}
        onClick={() => onInspect && onInspect(food)}
      >
        <img
          ref={imgRef}
          src={resolveImageUrl(food.image_url)}
          alt={food.name}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.35s ease',
          }}
        />
        <span
          className={`badge ${food.is_veg ? 'badge-success' : 'badge-danger'}`}
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          }}
        >
          {food.is_veg ? 'VEG' : 'NON-VEG'}
        </span>
        {food.is_popular && (
          <span
            className="badge badge-warning"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            }}
          >
            Trending
          </span>
        )}
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}
          onClick={() => onInspect && onInspect(food)}
        >
          <h4 style={{ fontSize: '1.02rem', fontWeight: 700, lineHeight: 1.3 }}>{food.name}</h4>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: '0.82rem',
              fontWeight: 700,
              background: 'var(--warning-soft)',
              color: 'var(--warning)',
              padding: '2px 7px',
              borderRadius: 8,
            }}
          >
            <Star size={13} fill="currentColor" />
            {Number(food.rating || 0).toFixed(1)}
          </span>
        </div>

        {food.restaurant_name && (
          <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, marginTop: 3 }}>
            {food.restaurant_name}
          </div>
        )}

        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 6, flex: 1 }}>
          {food.description || 'Freshly prepared to order with authentic ingredients.'}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            gap: 8,
          }}
        >
          <span style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {formatCurrency(food.price)}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {onInspect && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-label={`View details for ${food.name}`}
                onClick={() => onInspect(food)}
              >
                <Eye size={14} />
              </button>
            )}
            {onAddToCart && (
              <button
                type="button"
                className={`btn btn-sm ${addedPulse ? 'btn-success' : 'btn-primary'}`}
                disabled={!food.is_available || adding}
                onClick={handleAdd}
              >
                {addedPulse ? <Check size={15} /> : <Plus size={15} />}
                {!food.is_available ? 'Unavailable' : adding ? 'Adding...' : addedPulse ? 'Added' : 'Add'}
              </button>
            )}
          </div>
        </div>
      </div>
    </TiltCard3D>
  );
}

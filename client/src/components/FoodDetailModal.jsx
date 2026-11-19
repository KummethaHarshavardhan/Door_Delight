import React, { useState } from 'react';
import { Clock, Minus, Plus, Star, X } from 'lucide-react';
import { formatCurrency, resolveImageUrl } from '../utils/formatters';

export default function FoodDetailModal({ food, open, onClose, onAddToCart }) {
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  if (!open || !food) return null;

  const handleAdd = async () => {
    setAdding(true);
    try {
      await onAddToCart(food, qty);
      onClose();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 620, padding: 0, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ position: 'relative', height: 260 }}>
          <img
            src={resolveImageUrl(food.image_url)}
            alt={food.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <button
            type="button"
            aria-label="Close food details"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(15, 23, 42, 0.7)',
              color: '#fff',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <X size={18} />
          </button>
          <span
            className={`badge ${food.is_veg ? 'badge-success' : 'badge-danger'}`}
            style={{ position: 'absolute', bottom: 14, left: 16 }}
          >
            {food.is_veg ? 'PURE VEG' : 'NON-VEG'}
          </span>
        </div>

        <div className="card-body" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>{food.name}</h2>
              {food.restaurant_name && (
                <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                  {food.restaurant_name} {food.category_name ? `• ${food.category_name}` : ''}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 800 }}>
              <Star size={16} fill="#f59e0b" color="#f59e0b" />
              {Number(food.rating || 0).toFixed(1)}
            </div>
          </div>

          <p style={{ color: 'var(--text-muted)', marginTop: 12, fontSize: '0.94rem' }}>
            {food.description || 'Prepared fresh to order using curated spices and quality ingredients.'}
          </p>

          <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Clock size={14} color="var(--primary)" /> Prep time: {food.prep_time_mins || 20} mins
            </span>
            {food.tags?.length > 0 && <span>Tags: {food.tags.join(', ')}</span>}
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 14,
              marginTop: 22,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus size={14} />
              </button>
              <span style={{ fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{qty}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setQty((q) => Math.min(20, q + 1))}
              >
                <Plus size={14} />
              </button>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              disabled={!food.is_available || adding}
              onClick={handleAdd}
            >
              {!food.is_available
                ? 'Currently Unavailable'
                : adding
                  ? 'Adding...'
                  : `Add to Cart • ${formatCurrency(food.price * qty)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

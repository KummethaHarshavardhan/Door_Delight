import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatCurrency, resolveImageUrl } from '../utils/formatters';

export default function CartCheckoutPage() {
  const { cart, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();

  if (!cart.items || cart.items.length === 0) {
    return (
      <div className="card card-glass card-body page-enter" style={{ textAlign: 'center', padding: 56 }}>
        <div
          className="grad-coral"
          style={{
            width: 68,
            height: 68,
            borderRadius: 20,
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 14px 28px var(--primary-glow)',
          }}
        >
          <ShoppingBag size={30} />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>Your cart is empty</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
          Browse restaurants and add delicious dishes to get started.
        </p>
        <Link to="/customer" className="btn btn-primary">
          Explore Restaurants
        </Link>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="card card-glass">
        <div className="card-body" style={{ padding: 26 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Your Cart</h1>
          <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.94rem', marginBottom: 20 }}>
            From {cart.restaurant_name}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {cart.items.map((item) => (
              <div
                key={item.food_item_id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 14,
                  paddingBottom: 14,
                  borderBottom: '1px solid var(--border)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <img
                    src={resolveImageUrl(item.image_url)}
                    alt={item.name}
                    style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{item.name}</div>
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                      {formatCurrency(item.price)} each
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    aria-label={`Decrease ${item.name} quantity`}
                    onClick={() => updateQuantity(item.food_item_id, item.quantity - 1)}
                  >
                    <Minus size={14} />
                  </button>
                  <span style={{ fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{item.quantity}</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    aria-label={`Increase ${item.name} quantity`}
                    onClick={() => updateQuantity(item.food_item_id, item.quantity + 1)}
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => removeItem(item.food_item_id)}
                  >
                    <Trash2 size={14} color="var(--danger)" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.95rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal</span>
              <span>{formatCurrency(cart.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Delivery Fee</span>
              <span>{formatCurrency(cart.delivery_fee)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>GST (5%)</span>
              <span>{formatCurrency(cart.tax_amount)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 800,
                fontSize: '1.2rem',
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
              }}
            >
              <span>Total Payable</span>
              <span>{formatCurrency(cart.total_amount)}</span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 22 }}
            onClick={() => navigate('/customer/checkout/location')}
          >
            BUY NOW <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

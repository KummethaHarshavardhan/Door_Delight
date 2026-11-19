import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Star } from 'lucide-react';
import { catalogAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import FoodCard from '../components/FoodCard';
import FoodDetailModal from '../components/FoodDetailModal';
import SkeletonGrid from '../components/SkeletonGrid';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency, resolveImageUrl } from '../utils/formatters';

export default function RestaurantDetailPage() {
  const { id } = useParams();
  const { addItem } = useCart();
  const { showToast } = useToast();

  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replacePrompt, setReplacePrompt] = useState(null);
  const [inspectFood, setInspectFood] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await catalogAPI.getRestaurant(id);
        setRestaurant(res.data.restaurant);
        setMenu(res.data.menu || []);
      } catch {
        showToast('Failed to load restaurant details', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, showToast]);

  const handleAdd = async (food, qty = 1, replace = false) => {
    try {
      await addItem(food.id, qty, replace);
      showToast(`${food.name} added to cart`, 'success');
    } catch (err) {
      if (err.response?.status === 409) {
        setReplacePrompt({ food, qty });
      } else {
        showToast(err.response?.data?.detail || 'Could not add item', 'error');
      }
    }
  };

  if (loading) return <SkeletonGrid count={4} columns="grid-4" />;
  if (!restaurant) return <div className="card card-body">Restaurant not found.</div>;

  return (
    <div className="page-enter">
      <Link to="/customer" className="btn btn-secondary btn-sm" style={{ marginBottom: 14 }}>
        <ArrowLeft size={15} /> Back to Explore
      </Link>

      <div className="card card-glass" style={{ marginBottom: 28 }}>
        <div style={{ height: 260, overflow: 'hidden', position: 'relative' }}>
          <img
            src={resolveImageUrl(restaurant.image_url)}
            alt={restaurant.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(15,23,42,0.75), transparent 55%)',
            }}
          />
          <div style={{ position: 'absolute', bottom: 18, left: 22, right: 22, color: '#fff' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{restaurant.name}</h1>
            <p style={{ color: '#e2e8f0', fontSize: '0.94rem' }}>{restaurant.description}</p>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={15} color="var(--primary)" /> {restaurant.address}, {restaurant.city}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Clock size={15} color="var(--primary)" /> {restaurant.opening_hours?.open} - {restaurant.opening_hours?.close}
              </span>
              <span>Delivery: {formatCurrency(restaurant.delivery_fee)}</span>
              <span>Min Order: {formatCurrency(restaurant.min_order_amount)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`badge ${restaurant.is_open ? 'badge-success' : 'badge-danger'}`}>
                {restaurant.is_open ? 'Open Now' : 'Closed'}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800 }}>
                <Star size={16} fill="#f59e0b" color="#f59e0b" /> {Number(restaurant.rating || 0).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 16 }}>Menu ({menu.length} items)</h2>
      {menu.length === 0 ? (
        <div className="card card-body">No dishes listed for this restaurant yet.</div>
      ) : (
        <div className="grid grid-4">
          {menu.map((food) => (
            <FoodCard key={food.id} food={food} onInspect={setInspectFood} onAddToCart={(f) => handleAdd(f, 1)} />
          ))}
        </div>
      )}

      <FoodDetailModal
        food={inspectFood}
        open={Boolean(inspectFood)}
        onClose={() => setInspectFood(null)}
        onAddToCart={(f, qty) => handleAdd(f, qty)}
      />

      <ConfirmDialog
        open={Boolean(replacePrompt)}
        title="Replace Cart Items?"
        message="Your cart contains items from another restaurant. Replace your cart with this dish?"
        confirmLabel="Replace Cart"
        onCancel={() => setReplacePrompt(null)}
        onConfirm={async () => {
          const { food, qty } = replacePrompt;
          setReplacePrompt(null);
          await handleAdd(food, qty, true);
        }}
      />
    </div>
  );
}

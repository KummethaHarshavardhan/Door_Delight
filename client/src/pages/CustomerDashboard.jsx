import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Flame, MapPin, Search, Sparkles, UtensilsCrossed, Zap } from 'lucide-react';
import { aiAPI, catalogAPI, orderAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';
import HeroCanvasWrapper from '../components/HeroCanvasWrapper';
import { AnimatedPage, ScrollReveal } from '../components/ScrollReveal';
import SkeletonGrid from '../components/SkeletonGrid';
import RestaurantCard from '../components/RestaurantCard';
import FoodCard from '../components/FoodCard';
import FoodDetailModal from '../components/FoodDetailModal';
import OrderStatusBadge from '../components/OrderStatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency } from '../utils/formatters';

export default function CustomerDashboard() {
  const { addItem } = useCart();
  const { showToast } = useToast();

  const [categories, setCategories] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [foods, setFoods] = useState([]);
  const [orders, setOrders] = useState([]);
  const [aiRecs, setAiRecs] = useState([]);
  const [aiNote, setAiNote] = useState('');

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replacePrompt, setReplacePrompt] = useState(null);
  const [inspectFood, setInspectFood] = useState(null);
  const searchInputRef = useRef(null);
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const focusSearch = queryParams.get('focus') === 'search';
  const showFavoritesOnly = queryParams.get('tab') === 'favorites';

  useEffect(() => {
    if (focusSearch && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusSearch]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, restRes, foodRes, ordRes] = await Promise.all([
        catalogAPI.getCategories(),
        catalogAPI.getRestaurants({ search: search || undefined }),
        catalogAPI.getFoods({
          search: search || undefined,
          category_id: selectedCategory || undefined,
          max_price: maxPrice ? Number(maxPrice) : undefined,
          is_veg: vegOnly ? true : undefined,
        }),
        orderAPI.list(),
      ]);
      setCategories(catRes.data.categories || []);
      setRestaurants(restRes.data.restaurants || []);
      setFoods(foodRes.data.foods || []);
      setOrders(ordRes.data.orders || []);
    } catch {
      showToast('Failed to load marketplace data', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, maxPrice, vegOnly, showToast]);

  const loadRecommendations = useCallback(async () => {
    try {
      const res = await aiAPI.recommendations({
        max_price: maxPrice ? Number(maxPrice) : undefined,
        is_veg: vegOnly ? true : undefined,
      });
      setAiRecs(res.data.recommendations || []);
      setAiNote(res.data.explanation || '');
    } catch {
      // Optional AI section
    }
  }, [maxPrice, vegOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  useOrderWebSocket({
    onMessage: (data) => {
      if (data?.order) {
        setOrders((prev) => prev.map((o) => (o.id === data.order.id ? data.order : o)));
      }
    },
  });

  const handleAddToCart = async (food, qty = 1, replace = false) => {
    try {
      await addItem(food.id, qty, replace);
      showToast(`${food.name} added to cart`, 'success');
    } catch (err) {
      if (err.response?.status === 409) {
        setReplacePrompt({ food, qty });
      } else {
        showToast(err.response?.data?.detail || 'Could not add item to cart', 'error');
      }
    }
  };

  const activeOrder = orders.find(
    (o) => !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.status)
  );

  return (
    <AnimatedPage>
      {/* Interactive 3D Hero Section with Three.js Gourmet Centerpiece */}
      <section className="hero-banner-3d">
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <span className="badge badge-warning">
              <Sparkles size={13} /> Interactive 3D Food-Tech
            </span>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}>
              <MapPin size={12} /> Fast Local Delivery
            </span>
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.12, marginBottom: 12, letterSpacing: '-0.025em' }}>
            Craving something extraordinary? Delivered hot.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1rem', marginBottom: 22, maxWidth: 520 }}>
            Drag or hover the 3D centerpiece, explore curated local kitchens, get Gemini AI meal picks, and track every order live.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 420 }}>
              <Search
                size={18}
                color="#64748b"
                style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                ref={searchInputRef}
                className="input"
                style={{ paddingLeft: 42, borderRadius: 14, boxShadow: '0 12px 28px rgba(0,0,0,0.22)' }}
                placeholder="Search restaurants, biryanis, pizzas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <a href="#restaurants-section" className="btn btn-secondary">
              Explore Menu <ArrowRight size={16} />
            </a>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 2 }}>
          <HeroCanvasWrapper height={330} />
        </div>
      </section>

      {/* Colorful Promotional Banner Strip */}
      <ScrollReveal>
        <section className="promo-strip-3d">
          <div className="promo-pill-card grad-coral">
            <Flame size={28} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>Trending Kitchens</div>
              <div style={{ fontSize: '0.82rem', opacity: 0.92 }}>Top-rated chefs preparing fresh now</div>
            </div>
          </div>
          <div className="promo-pill-card grad-violet">
            <Sparkles size={28} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>Gemini AI Concierge</div>
              <div style={{ fontSize: '0.82rem', opacity: 0.92 }}>Smart dish picks tailored to your budget</div>
            </div>
          </div>
          <div className="promo-pill-card grad-mint">
            <Zap size={28} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>Live Order Pulse</div>
              <div style={{ fontSize: '0.82rem', opacity: 0.92 }}>Real-time kitchen & rider updates</div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {activeOrder && (
        <ScrollReveal>
          <section className="card card-glass" style={{ marginBottom: 28, borderColor: 'var(--primary)' }}>
            <div
              className="card-body"
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}
            >
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.06em' }}>
                  LIVE ACTIVE ORDER
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                  {activeOrder.order_number} • {activeOrder.restaurant_name}
                </div>
                <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                  Total {formatCurrency(activeOrder.total_amount)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <OrderStatusBadge status={activeOrder.status} />
                <Link to={`/customer/orders/${activeOrder.id}`} className="btn btn-primary btn-sm">
                  Track Live <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* Categories & Filters */}
      <ScrollReveal>
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <h2 style={{ fontSize: '1.38rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Food Categories</h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="select"
                style={{ width: 155 }}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              >
                <option value="">Any Price</option>
                <option value="200">Under ₹200</option>
                <option value="300">Under ₹300</option>
                <option value="500">Under ₹500</option>
              </select>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  background: 'var(--surface)',
                  padding: '9px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={vegOnly} onChange={(e) => setVegOnly(e.target.checked)} />
                Veg Only
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
            <button
              type="button"
              className={`btn btn-sm ${selectedCategory === '' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedCategory('')}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-violet' : 'btn-secondary'}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* AI Recommendations */}
      {aiRecs.length > 0 && (
        <ScrollReveal>
          <section style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Sparkles size={20} color="var(--secondary)" />
              <h2 style={{ fontSize: '1.38rem', fontWeight: 800, letterSpacing: '-0.02em' }}>AI Recommended For You</h2>
            </div>
            {aiNote && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: 16 }}>{aiNote}</p>
            )}
            <div className="grid grid-3">
              {aiRecs.slice(0, 3).map((food) => (
                <FoodCard
                  key={food.id}
                  food={food}
                  onInspect={setInspectFood}
                  onAddToCart={(f) => handleAddToCart(f, 1)}
                />
              ))}
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* Restaurants */}
      <ScrollReveal>
        <section id="restaurants-section" style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: '1.38rem', fontWeight: 800, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Featured Restaurants
          </h2>
          {loading ? (
            <SkeletonGrid count={3} columns="grid-3" />
          ) : restaurants.length === 0 ? (
            <div className="card card-body">No restaurants found matching your search.</div>
          ) : (
            <div className="grid grid-3">
              {restaurants.map((rest) => (
                <RestaurantCard key={rest.id} restaurant={rest} />
              ))}
            </div>
          )}
        </section>
      </ScrollReveal>

      {/* Dishes */}
      <ScrollReveal>
        <section style={{ marginBottom: 42 }}>
          <h2 style={{ fontSize: '1.38rem', fontWeight: 800, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Trending & Available Dishes
          </h2>
          {loading ? (
            <SkeletonGrid count={4} columns="grid-4" />
          ) : foods.length === 0 ? (
            <div className="card card-body">No dishes matched your filters.</div>
          ) : (
            <div className="grid grid-4">
              {foods.map((food) => (
                <FoodCard
                  key={food.id}
                  food={food}
                  onInspect={setInspectFood}
                  onAddToCart={(f) => handleAddToCart(f, 1)}
                />
              ))}
            </div>
          )}
        </section>
      </ScrollReveal>

      {/* Premium Footer */}
      <footer
        className="card card-glass"
        style={{ padding: '24px 28px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}
      >
        <div className="brand">
          <span className="brand-badge">
            <UtensilsCrossed size={18} />
          </span>
          <span>DoorDelight</span>
        </div>
        <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
          Fresh meals, real-time tracking, and Gemini AI discovery.
        </div>
      </footer>

      <FoodDetailModal
        food={inspectFood}
        open={Boolean(inspectFood)}
        onClose={() => setInspectFood(null)}
        onAddToCart={(f, qty) => handleAddToCart(f, qty)}
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
          await handleAddToCart(food, qty, true);
        }}
      />
    </AnimatedPage>
  );
}

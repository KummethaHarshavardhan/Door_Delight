import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Upload, Utensils } from 'lucide-react';
import { catalogAPI, managerAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, resolveImageUrl } from '../utils/formatters';

export default function ManagerMenuPage() {
  const { showToast } = useToast();
  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    discount_percent: 0,
    category_id: '',
    image_url: '',
    is_veg: true,
    is_available: true,
    prep_time_mins: 20,
  });

  const loadData = useCallback(async () => {
    const [restRes, catRes] = await Promise.all([
      managerAPI.getRestaurant(),
      catalogAPI.getCategories(),
    ]);
    setRestaurant(restRes.data.restaurant);
    setMenu(restRes.data.menu || []);
    const cats = catRes.data.categories || [];
    setCategories(cats);
    if (cats[0]) {
      setForm((prev) => ({ ...prev, category_id: prev.category_id || cats[0].id }));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await managerAPI.uploadImage(file);
      setForm((prev) => ({ ...prev, image_url: res.data.image_url }));
      showToast('Food image uploaded', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Upload failed', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        discount_percent: Number(form.discount_percent || 0),
        prep_time_mins: Number(form.prep_time_mins || 20),
      };
      if (editingId) {
        await catalogAPI.updateFood(editingId, payload);
        showToast('Food item updated', 'success');
      } else {
        await catalogAPI.createFood(payload);
        showToast('Food item added', 'success');
      }
      setShowForm(false);
      setEditingId(null);
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not save food item', 'error');
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const res = await catalogAPI.createCategory({ name: newCatName.trim() });
      showToast('Category added', 'success');
      setNewCatName('');
      setShowCatModal(false);
      await loadData();
      if (res.data.category?.id) {
        setForm((prev) => ({ ...prev, category_id: res.data.category.id }));
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not create category', 'error');
    }
  };

  const toggleAvailability = async (item) => {
    await catalogAPI.updateFood(item.id, { is_available: !item.is_available });
    showToast(`${item.name} marked ${!item.is_available ? 'available' : 'unavailable'}`, 'info');
    await loadData();
  };

  const handleDelete = async (id) => {
    await catalogAPI.deleteFood(id);
    showToast('Food item deleted', 'info');
    await loadData();
  };

  if (!restaurant) {
    return <div className="card card-glass card-body">Create your restaurant profile first in Restaurant Info.</div>;
  }

  const totalCount = menu.length;
  const availableCount = menu.filter((m) => m.is_available).length;
  const filteredMenu = menu.filter((item) => {
    const matchesSearch =
      !search.trim() ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesCat = !categoryFilter || item.category_id === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Food & Menu Management</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCatModal(true)}>
            <Plus size={15} /> Add Category
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingId(null);
              setForm({
                name: '',
                description: '',
                price: '',
                discount_percent: 0,
                category_id: categories[0]?.id || '',
                image_url: '',
                is_veg: true,
                is_available: true,
                prep_time_mins: 20,
              });
              setShowForm(true);
            }}
          >
            <Plus size={16} /> Add Food
          </button>
        </div>
      </div>

      {/* Menu Stats */}
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div>
            <div className="stat-label">Total Food Items</div>
            <div className="stat-value">{totalCount}</div>
          </div>
          <div className="stat-icon-box grad-violet"><Utensils size={20} /></div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Available Items</div>
            <div className="stat-value">{availableCount}</div>
          </div>
          <div className="stat-icon-box grad-mint"><Utensils size={20} /></div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Out of Stock</div>
            <div className="stat-value">{totalCount - availableCount}</div>
          </div>
          <div className="stat-icon-box grad-coral"><Utensils size={20} /></div>
        </div>
      </div>

      {/* Search & Category Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Search menu items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="select"
          style={{ maxWidth: 220 }}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-3">
        {filteredMenu.map((item) => (
          <div key={item.id} className="card card-glass">
            <div style={{ position: 'relative' }}>
              <img
                src={resolveImageUrl(item.image_url)}
                alt={item.name}
                style={{ width: '100%', height: 155, objectFit: 'cover' }}
              />
              <span
                className={`badge ${item.is_available ? 'badge-success' : 'badge-danger'}`}
                style={{ position: 'absolute', top: 10, right: 10 }}
              >
                {item.is_available ? 'Available' : 'Disabled'}
              </span>
              {Number(item.discount_percent || 0) > 0 && (
                <span className="badge badge-warning" style={{ position: 'absolute', top: 10, left: 10 }}>
                  {item.discount_percent}% OFF
                </span>
              )}
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{item.name}</span>
                <span>{formatCurrency(item.price)}</span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 4 }}>{item.description}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleAvailability(item)}>
                  {item.is_available ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditingId(item.id);
                    setForm({
                      name: item.name,
                      description: item.description,
                      price: item.price,
                      discount_percent: item.discount_percent || 0,
                      category_id: item.category_id,
                      image_url: item.image_url,
                      is_veg: item.is_veg,
                      is_available: item.is_available,
                      prep_time_mins: item.prep_time_mins || 20,
                    });
                    setShowForm(true);
                  }}
                >
                  Edit
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3 style={{ fontWeight: 800, marginBottom: 14 }}>{editingId ? 'Edit Food Item' : 'Add New Food Item'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Food Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="select" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Price (₹)</label>
                  <input type="number" step="0.01" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Discount (%)</label>
                  <input type="number" step="1" min="0" max="90" className="input" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Prep (mins)</label>
                  <input type="number" className="input" value={form.prep_time_mins} onChange={(e) => setForm({ ...form, prep_time_mins: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Image URL or Upload</label>
                <input className="input" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
                <label className="btn btn-secondary btn-sm" style={{ marginTop: 8, width: 'fit-content' }}>
                  <Upload size={14} /> Upload Image
                  <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 18, marginBottom: 14 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.is_veg} onChange={(e) => setForm({ ...form, is_veg: e.target.checked })} />
                  Vegetarian
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} />
                  Available
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Food</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCatModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 400 }}>
            <h3 style={{ fontWeight: 800, marginBottom: 12 }}>Add Food Category</h3>
            <form onSubmit={handleAddCategory}>
              <div className="form-group">
                <label className="form-label">Category Name</label>
                <input className="input" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="e.g., Street Food" required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCatModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Category</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

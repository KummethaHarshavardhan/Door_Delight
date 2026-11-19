import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { adminAPI, catalogAPI, managerAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/formatters';

export default function AdminFoodsPage() {
  const { showToast } = useToast();
  const [foods, setFoods] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [restFilter, setRestFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    restaurant_id: '',
    category_id: '',
    name: '',
    description: '',
    price: '',
    discount_percent: 0,
    image_url: '',
    is_veg: true,
    is_available: true,
    prep_time_mins: 20,
  });

  const loadData = useCallback(async () => {
    const [fRes, rRes, cRes] = await Promise.all([
      adminAPI.getFoods(),
      adminAPI.getRestaurants(),
      catalogAPI.getCategories(),
    ]);
    setFoods(fRes.data.foods || []);
    const rests = rRes.data.restaurants || [];
    const cats = cRes.data.categories || [];
    setRestaurants(rests);
    setCategories(cats);
    setForm((prev) => ({
      ...prev,
      restaurant_id: prev.restaurant_id || rests[0]?.id || '',
      category_id: prev.category_id || cats[0]?.id || '',
    }));
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

  const handleSave = async (e) => {
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
        showToast('Food item created', 'success');
      }
      setShowModal(false);
      setEditingId(null);
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to save food', 'error');
    }
  };

  const toggleAvail = async (f) => {
    await catalogAPI.updateFood(f.id, { is_available: !f.is_available });
    await loadData();
  };

  const handleDelete = async (id) => {
    await catalogAPI.deleteFood(id);
    showToast('Food item deleted', 'info');
    await loadData();
  };

  const filteredFoods = foods.filter((f) => {
    const matchSearch =
      !search.trim() ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.restaurant_name || '').toLowerCase().includes(search.toLowerCase());
    const matchRest = !restFilter || f.restaurant_id === restFilter;
    return matchSearch && matchRest;
  });

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Food Catalog Management</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditingId(null);
            setForm({
              restaurant_id: restaurants[0]?.id || '',
              category_id: categories[0]?.id || '',
              name: '',
              description: '',
              price: '',
              discount_percent: 0,
              image_url: '',
              is_veg: true,
              is_available: true,
              prep_time_mins: 20,
            });
            setShowModal(true);
          }}
        >
          <Plus size={16} /> Add Food Item
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Search dish or restaurant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="select"
          style={{ maxWidth: 240 }}
          value={restFilter}
          onChange={(e) => setRestFilter(e.target.value)}
        >
          <option value="">All Restaurants</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      <div className="card card-glass">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Dish</th>
                <th>Restaurant</th>
                <th>Category</th>
                <th>Price</th>
                <th>Discount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFoods.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 700 }}>{f.name}</td>
                  <td>{f.restaurant_name}</td>
                  <td>{f.category_name}</td>
                  <td>{formatCurrency(f.price)}</td>
                  <td>{f.discount_percent ? `${f.discount_percent}%` : '-'}</td>
                  <td>
                    <span className={`badge ${f.is_available ? 'badge-success' : 'badge-danger'}`}>
                      {f.is_available ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditingId(f.id);
                        setForm({
                          restaurant_id: f.restaurant_id,
                          category_id: f.category_id,
                          name: f.name,
                          description: f.description || '',
                          price: f.price,
                          discount_percent: f.discount_percent || 0,
                          image_url: f.image_url || '',
                          is_veg: f.is_veg,
                          is_available: f.is_available,
                          prep_time_mins: f.prep_time_mins || 20,
                        });
                        setShowModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleAvail(f)}>
                      Toggle
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(f.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3 style={{ fontWeight: 800, marginBottom: 14 }}>{editingId ? 'Edit Food Item' : 'Add Food Item'}</h3>
            <form onSubmit={handleSave}>
              {!editingId && (
                <div className="form-group">
                  <label className="form-label">Restaurant</label>
                  <select className="select" value={form.restaurant_id} onChange={(e) => setForm({ ...form, restaurant_id: e.target.value })} required>
                    {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="select" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dish Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Price (₹)</label>
                  <input type="number" step="0.01" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Discount (%)</label>
                  <input type="number" min="0" max="90" className="input" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Image URL or Upload</label>
                <input className="input" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
                <label className="btn btn-secondary btn-sm" style={{ marginTop: 8, width: 'fit-content' }}>
                  <Upload size={14} /> Upload Image
                  <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

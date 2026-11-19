import React, { useEffect, useState } from 'react';
import { catalogAPI, managerAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function ManagerSettingsPage() {
  const { showToast } = useToast();
  const [restaurantId, setRestaurantId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    city: 'Bengaluru',
    phone: '',
    upi_id: '',
    image_url: '',
    delivery_time_mins: 30,
    delivery_fee: 35,
    min_order_amount: 99,
    is_open: true,
    open_time: '09:00',
    close_time: '23:00',
  });

  useEffect(() => {
    managerAPI.getRestaurant().then((res) => {
      const r = res.data.restaurant;
      if (r) {
        setRestaurantId(r.id);
        setForm({
          name: r.name || '',
          description: r.description || '',
          address: r.address || '',
          city: r.city || 'Bengaluru',
          phone: r.phone || '',
          upi_id: r.upi_id || '',
          image_url: r.image_url || '',
          delivery_time_mins: r.delivery_time_mins || 30,
          delivery_fee: r.delivery_fee || 35,
          min_order_amount: r.min_order_amount || 99,
          is_open: r.is_open ?? true,
          open_time: r.opening_hours?.open || '09:00',
          close_time: r.opening_hours?.close || '23:00',
        });
      }
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description,
      address: form.address,
      city: form.city,
      phone: form.phone,
      upi_id: form.upi_id,
      image_url: form.image_url,
      delivery_time_mins: Number(form.delivery_time_mins),
      delivery_fee: Number(form.delivery_fee),
      min_order_amount: Number(form.min_order_amount),
      is_open: form.is_open,
      opening_hours: { open: form.open_time, close: form.close_time },
    };
    try {
      if (restaurantId) {
        await catalogAPI.updateRestaurant(restaurantId, payload);
        showToast('Restaurant updated', 'success');
      } else {
        const res = await catalogAPI.createRestaurant(payload);
        setRestaurantId(res.data.restaurant.id);
        showToast('Restaurant created', 'success');
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Save failed', 'error');
    }
  };

  return (
    <div className="card" style={{ maxWidth: 680 }}>
      <div className="card-body">
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 16 }}>
          {restaurantId ? 'Restaurant Information' : 'Register Your Restaurant'}
        </h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Restaurant Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Verified Restaurant UPI ID (for COD Settlements)</label>
              <input className="input" placeholder="restaurant@upi" value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Opens At</label>
              <input type="time" className="input" value={form.open_time} onChange={(e) => setForm({ ...form, open_time: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Closes At</label>
              <input type="time" className="input" value={form.close_time} onChange={(e) => setForm({ ...form, close_time: e.target.value })} />
            </div>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <input type="checkbox" checked={form.is_open} onChange={(e) => setForm({ ...form, is_open: e.target.checked })} />
            Restaurant is currently open for orders
          </label>
          <div>
            <button type="submit" className="btn btn-primary">Save Restaurant</button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { adminAPI, catalogAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function AdminRestaurantsPage() {
  const { showToast } = useToast();
  const [restaurants, setRestaurants] = useState([]);
  const [managers, setManagers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    city: 'Bengaluru',
    phone: '',
    image_url: '',
    manager_id: '',
    is_open: true,
    is_featured: true,
  });

  const loadData = useCallback(async () => {
    const [rRes, uRes] = await Promise.all([
      adminAPI.getRestaurants(),
      adminAPI.getUsers({ role: 'RESTAURANT_MANAGER' }),
    ]);
    setRestaurants(rRes.data.restaurants || []);
    setManagers(uRes.data.users || []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, manager_id: form.manager_id || null };
      if (editing) {
        await catalogAPI.updateRestaurant(editing, payload);
        showToast('Restaurant updated', 'success');
      } else {
        await catalogAPI.createRestaurant(payload);
        showToast('Restaurant added', 'success');
      }
      setShowModal(false);
      setEditing(null);
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Save failed', 'error');
    }
  };

  const handleDeactivate = async (id) => {
    await catalogAPI.deleteRestaurant(id);
    showToast('Restaurant deactivated', 'info');
    await loadData();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Restaurant Management</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setForm({
              name: '',
              description: '',
              address: '',
              city: 'Bengaluru',
              phone: '',
              image_url: '',
              manager_id: '',
              is_open: true,
              is_featured: true,
            });
            setShowModal(true);
          }}
        >
          <Plus size={16} /> Add Restaurant
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>City</th>
                <th>Status</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700 }}>{r.name}</td>
                  <td>{r.city}</td>
                  <td>
                    <span className={`badge ${r.is_open ? 'badge-success' : 'badge-warning'}`}>
                      {r.is_open ? 'Open' : 'Closed'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${r.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditing(r.id);
                        setForm({
                          name: r.name,
                          description: r.description,
                          address: r.address,
                          city: r.city,
                          phone: r.phone,
                          image_url: r.image_url,
                          manager_id: r.manager_id || '',
                          is_open: r.is_open,
                          is_featured: r.is_featured,
                        });
                        setShowModal(true);
                      }}
                    >
                      Edit
                    </button>
                    {r.is_active && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeactivate(r.id)}>
                        Deactivate
                      </button>
                    )}
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
            <h3 style={{ fontWeight: 800, marginBottom: 14 }}>{editing ? 'Edit Restaurant' : 'Add Restaurant'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Assign Manager</label>
                <select className="select" value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
                  <option value="">-- Unassigned --</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Image URL</label>
                <input className="input" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
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

import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { addressAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function CustomerProfilePage() {
  const { user, refreshMe } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [addresses, setAddresses] = useState([]);
  const [newAddr, setNewAddr] = useState({
    label: 'Home',
    street: '',
    city: 'Bengaluru',
    pincode: '',
    phone: '',
  });

  useEffect(() => {
    addressAPI.list().then((res) => setAddresses(res.data.addresses || [])).catch(() => {});
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await authAPI.updateProfile({ name, phone });
      await refreshMe();
      showToast('Profile updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Update failed', 'error');
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      const res = await addressAPI.create(newAddr);
      setAddresses((prev) => [res.data.address, ...prev]);
      setNewAddr({ label: 'Home', street: '', city: 'Bengaluru', pincode: '', phone: '' });
      showToast('Address added', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not add address', 'error');
    }
  };

  const handleDeleteAddr = async (id) => {
    await addressAPI.remove(id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    showToast('Address removed', 'info');
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
      <div className="card">
        <div className="card-body">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 14 }}>My Profile</h2>
          <form onSubmit={handleSaveProfile}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="input" value={user?.email || ''} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary">Save Profile</button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 14 }}>Saved Addresses</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {addresses.map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 10,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{a.label}</div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    {a.street}, {a.city} - {a.pincode}
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDeleteAddr(a.id)}>
                  <Trash2 size={14} color="var(--danger)" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddAddress}>
            <div className="form-group">
              <label className="form-label">Add New Address</label>
              <input
                className="input"
                placeholder="Label (Home / Office)"
                value={newAddr.label}
                onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <input
                className="input"
                placeholder="Street Address"
                value={newAddr.street}
                onChange={(e) => setNewAddr({ ...newAddr, street: e.target.value })}
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input
                className="input"
                placeholder="City"
                value={newAddr.city}
                onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder="Pincode"
                value={newAddr.pincode}
                onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
              Add Address
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

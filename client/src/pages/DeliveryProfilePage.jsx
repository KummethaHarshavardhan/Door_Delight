import React, { useState } from 'react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function DeliveryProfilePage() {
  const { user, refreshMe } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [vehicleNumber, setVehicleNumber] = useState(user?.vehicle_number || '');

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await authAPI.updateProfile({ name, phone, vehicle_number: vehicleNumber });
      await refreshMe();
      showToast('Profile updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Update failed', 'error');
    }
  };

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <div className="card-body">
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 16 }}>Delivery Partner Profile</h1>
        <form onSubmit={handleSave}>
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
          <div className="form-group">
            <label className="form-label">Vehicle Number</label>
            <input className="input" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary">Save Changes</button>
        </form>
      </div>
    </div>
  );
}

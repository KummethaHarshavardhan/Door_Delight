import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { adminAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function AdminUsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'CUSTOMER',
  });

  const loadUsers = useCallback(async () => {
    const res = await adminAPI.getUsers({
      search: search || undefined,
      role: roleFilter || undefined,
    });
    setUsers(res.data.users || []);
  }, [search, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await adminAPI.createUser(form);
      showToast('User created', 'success');
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', phone: '', role: 'CUSTOMER' });
      await loadUsers();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to create user', 'error');
    }
  };

  const toggleActive = async (u) => {
    try {
      await adminAPI.updateUser(u.id, { is_active: !u.is_active });
      await loadUsers();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Update failed', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await adminAPI.deleteUser(id);
      showToast('User deleted', 'info');
      await loadUsers();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Cannot delete user', 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>User Management</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Create User
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="select" style={{ maxWidth: 200 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          <option value="CUSTOMER">Customer</option>
          <option value="RESTAURANT_MANAGER">Restaurant Manager</option>
          <option value="DELIVERY_PARTNER">Delivery Partner</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className="badge badge-info">{u.role}</span></td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleActive(u)}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3 style={{ fontWeight: 800, marginBottom: 14 }}>Create New User</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="CUSTOMER">CUSTOMER</option>
                  <option value="RESTAURANT_MANAGER">RESTAURANT_MANAGER</option>
                  <option value="DELIVERY_PARTNER">DELIVERY_PARTNER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

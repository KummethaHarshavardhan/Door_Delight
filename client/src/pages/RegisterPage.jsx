import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Sparkles, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import FloatingFoodShowcase3D from '../components/FloatingFoodShowcase3D';
import ThemeToggle from '../components/ThemeToggle';
import { getRoleHomePath } from '../utils/formatters';

export default function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const user = await register(form);
      showToast('Account created successfully!', 'success');
      navigate(getRoleHomePath(user.role), { replace: true });
    } catch (err) {
      showToast(err.response?.data?.detail || 'Registration failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-split page-enter">
      <section className="auth-visual-pane">
        <div style={{ maxWidth: 480, marginBottom: 28 }}>
          <span className="badge badge-warning" style={{ marginBottom: 14 }}>
            <Sparkles size={13} /> Join DoorDelight
          </span>
          <h2 style={{ fontSize: '2.35rem', fontWeight: 800, lineHeight: 1.14, marginBottom: 12 }}>
            Order, Cook, or Deliver with DoorDelight.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.86)', fontSize: '1rem' }}>
            Create your account in seconds and experience real-time food ordering, restaurant management, and delivery tracking.
          </p>
        </div>
        <FloatingFoodShowcase3D />
      </section>

      <section className="auth-form-pane">
        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          <ThemeToggle />
        </div>
        <div className="card card-glass" style={{ width: '100%', maxWidth: 450 }}>
          <div className="card-body" style={{ padding: 30 }}>
            <div className="brand" style={{ justifyContent: 'center', marginBottom: 14 }}>
              <span className="brand-badge">
                <UtensilsCrossed size={20} />
              </span>
              <span>DoorDelight</span>
            </div>
            <h1 style={{ fontSize: '1.42rem', fontWeight: 800, textAlign: 'center', marginBottom: 20 }}>
              Create your account
            </h1>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  className="input"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="input"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  className="input"
                  placeholder="+91 9876543210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input"
                    style={{ paddingRight: 42 }}
                    placeholder="Minimum 6 characters"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPass((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={submitting}>
                {submitting ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 18, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

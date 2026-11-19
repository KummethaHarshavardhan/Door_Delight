import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Sparkles, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import FloatingFoodShowcase3D from '../components/FloatingFoodShowcase3D';
import ThemeToggle from '../components/ThemeToggle';
import { getRoleHomePath } from '../utils/formatters';

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      showToast('Please enter email and password', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      showToast(`Welcome back, ${user.name}!`, 'success');
      navigate(getRoleHomePath(user.role), { replace: true });
    } catch (err) {
      showToast(err.response?.data?.detail || 'Login failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-split page-enter">
      <section className="auth-visual-pane">
        <div style={{ maxWidth: 480, marginBottom: 28 }}>
          <span className="badge badge-warning" style={{ marginBottom: 14 }}>
            <Sparkles size={13} /> Colorful 3D Food-Tech
          </span>
          <h2 style={{ fontSize: '2.35rem', fontWeight: 800, lineHeight: 1.14, marginBottom: 12 }}>
            Crafted Cravings, Delivered in 3D Speed.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.86)', fontSize: '1rem' }}>
            Explore local kitchens, Gemini AI-curated recommendations, and live WebSocket order tracking from kitchen to doorstep.
          </p>
        </div>
        <FloatingFoodShowcase3D />
      </section>

      <section className="auth-form-pane">
        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          <ThemeToggle />
        </div>
        <div className="card card-glass" style={{ width: '100%', maxWidth: 430 }}>
          <div className="card-body" style={{ padding: 32 }}>
            <div className="brand" style={{ justifyContent: 'center', marginBottom: 18 }}>
              <span className="brand-badge">
                <UtensilsCrossed size={20} />
              </span>
              <span>DoorDelight</span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, textAlign: 'center', marginBottom: 6 }}>
              Welcome back
            </h1>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 24 }}>
              Sign in as Customer, Manager, Rider, or Admin
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input"
                    style={{ paddingRight: 42 }}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} disabled={submitting}>
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              New to DoorDelight?{' '}
              <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

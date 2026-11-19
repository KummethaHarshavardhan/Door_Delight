import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, Send } from 'lucide-react';
import { deliveryAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export default function DeliveryCODSettlementPage() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payTarget, setPayTarget] = useState(null);
  const [payForm, setPayForm] = useState({
    amount: '',
    upi_app: 'Google Pay',
    transaction_reference: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await deliveryAPI.getCodSettlements();
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!payTarget) return;
    setSubmitting(true);
    try {
      await deliveryAPI.payCodSettlement({
        restaurant_id: payTarget.restaurant_id,
        amount: Number(payForm.amount),
        upi_app: payForm.upi_app,
        transaction_reference: payForm.transaction_reference.trim(),
        idempotency_key: `cod_settle_${payTarget.restaurant_id}_${payForm.transaction_reference.trim()}`,
      });
      showToast('UPI settlement submitted for verification (PAYMENT_VERIFICATION_PENDING)', 'info');
      setPayTarget(null);
      setPayForm({ amount: '', upi_app: 'Google Pay', transaction_reference: '' });
      await loadLedger();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Settlement failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p>Loading COD settlement ledger...</p>;

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>COD Cash Settlement Ledger</h1>
        <span className={`badge ${data?.cod_restricted ? 'badge-danger' : 'badge-success'}`}>
          Account Status: {data?.account_status || 'ACTIVE'}
        </span>
      </div>

      {data?.cod_restricted && (
        <div className="card card-body" style={{ marginBottom: 18, borderColor: 'var(--danger)' }}>
          <strong style={{ color: 'var(--danger)' }}>Account Restricted: COD_SETTLEMENT_OVERDUE</strong>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Your outstanding COD balance is overdue. New delivery assignments are paused until your settlement is verified by Admin.
          </p>
        </div>
      )}

      <div className="stat-card" style={{ marginBottom: 24, maxWidth: 360 }}>
        <div>
          <div className="stat-label">Total Outstanding COD</div>
          <div className="stat-value">{formatCurrency(data?.total_outstanding_cod || 0)}</div>
        </div>
        <div className="stat-icon-box grad-coral"><Banknote size={22} /></div>
      </div>

      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>Restaurant-Wise COD Ledgers</h2>
      {(!data?.restaurant_ledgers || data.restaurant_ledgers.length === 0) ? (
        <div className="card card-glass card-body" style={{ marginBottom: 24 }}>
          No COD cash collected yet. Your COD balance is ₹0.00.
        </div>
      ) : (
        <div className="grid grid-2" style={{ marginBottom: 26 }}>
          {data.restaurant_ledgers.map((rl) => (
            <div key={rl.restaurant_id} className="card card-glass">
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong>{rl.restaurant_name}</strong>
                  <span className={`badge ${rl.settlement_status === 'SETTLED' ? 'badge-success' : rl.settlement_status === 'OVERDUE' ? 'badge-danger' : 'badge-warning'}`}>
                    {rl.settlement_status}
                  </span>
                </div>
                <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  COD Orders ({rl.cod_order_count}): {rl.order_numbers.join(', ')}
                </div>
                <div style={{ fontSize: '0.88rem', marginBottom: 4 }}>
                  Collected: <strong>{formatCurrency(rl.total_cod_collected)}</strong> • Remitted: <strong>{formatCurrency(rl.total_remitted)}</strong>
                </div>
                {rl.pending_verification_amount > 0 && (
                  <div style={{ fontSize: '0.84rem', color: 'var(--warning)', marginBottom: 4 }}>
                    Pending Verification: {formatCurrency(rl.pending_verification_amount)}
                  </div>
                )}
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)', marginBottom: 10 }}>
                  Outstanding Balance: {formatCurrency(rl.outstanding_balance)}
                </div>
                {rl.outstanding_balance > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setPayTarget(rl);
                      setPayForm({
                        amount: String(rl.outstanding_balance),
                        upi_app: 'Google Pay',
                        transaction_reference: '',
                      });
                    }}
                  >
                    <Send size={14} /> SEND COD AMOUNT
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card card-glass">
        <div className="card-body">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>Settlement History</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Amount</th>
                  <th>UPI App</th>
                  <th>Transaction Ref</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(data?.settlement_history || []).map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700 }}>{s.restaurant_name}</td>
                    <td>{formatCurrency(s.amount)}</td>
                    <td>{s.upi_app}</td>
                    <td>{s.transaction_reference}</td>
                    <td><OrderStatusBadge status={s.status} /></td>
                    <td>{formatDateTime(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {payTarget && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 460 }}>
            <h3 style={{ fontWeight: 800, marginBottom: 8 }}>Send COD Amount via UPI</h3>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              <div><strong>Restaurant:</strong> {payTarget.restaurant_name}</div>
              <div><strong>Verified Restaurant UPI ID:</strong> {payTarget.restaurant_upi_id || 'Contact Restaurant / Admin'}</div>
              <div><strong>Outstanding Balance:</strong> {formatCurrency(payTarget.outstanding_balance)}</div>
            </div>
            <form onSubmit={handlePaySubmit}>
              <div className="form-group">
                <label className="form-label">Amount to Send (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  max={payTarget.outstanding_balance}
                  className="input"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">UPI App</label>
                <select className="select" value={payForm.upi_app} onChange={(e) => setPayForm({ ...payForm, upi_app: e.target.value })}>
                  <option value="Google Pay">Google Pay</option>
                  <option value="PhonePe">PhonePe</option>
                  <option value="Paytm">Paytm</option>
                  <option value="Other UPI">Other UPI</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">UPI Transaction Reference / UTR</label>
                <input
                  className="input"
                  placeholder="Enter exact UTR / UPI reference ID"
                  value={payForm.transaction_reference}
                  onChange={(e) => setPayForm({ ...payForm, transaction_reference: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPayTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit UPI Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { payoutAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export default function AdminPayoutsPage() {
  const { showToast } = useToast();
  const [rates, setRates] = useState({ base_amount: 20, per_km_rate: 8, minimum_payout: 30, default_incentive: 0 });
  const [partners, setPartners] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [payoutTarget, setPayoutTarget] = useState(null);
  const [txForm, setTxForm] = useState({
    amount: '',
    transaction_reference: '',
    payment_method: 'BANK_TRANSFER',
    notes: '',
  });

  const loadAll = useCallback(async () => {
    const [rateRes, sumRes] = await Promise.all([
      payoutAPI.getRates(),
      payoutAPI.getSummary(),
    ]);
    if (rateRes.data.rates) setRates(rateRes.data.rates);
    setPartners(sumRes.data.partners || []);
    setPayouts(sumRes.data.payouts || []);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSaveRates = async (e) => {
    e.preventDefault();
    try {
      await payoutAPI.updateRates({
        base_amount: Number(rates.base_amount),
        per_km_rate: Number(rates.per_km_rate),
        minimum_payout: Number(rates.minimum_payout),
        default_incentive: Number(rates.default_incentive || 0),
      });
      showToast('Delivery rate configuration updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update rates', 'error');
    }
  };

  const handleProcessPayout = async (e) => {
    e.preventDefault();
    if (!payoutTarget) return;
    try {
      await payoutAPI.processPayout({
        partner_id: payoutTarget.partner_id,
        amount: Number(txForm.amount),
        transaction_reference: txForm.transaction_reference,
        payment_method: txForm.payment_method,
        notes: txForm.notes,
        idempotency_key: `payout_${payoutTarget.partner_id}_${txForm.transaction_reference}`,
      });
      showToast('Manual bank payout recorded successfully', 'success');
      setPayoutTarget(null);
      setTxForm({ amount: '', transaction_reference: '', payment_method: 'BANK_TRANSFER', notes: '' });
      await loadAll();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Payout failed', 'error');
    }
  };

  const handleDownloadCsv = async () => {
    try {
      const res = await payoutAPI.exportCsvBlob();
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'doordelight-payouts.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Failed to export payout report', 'error');
    }
  };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Payouts & Delivery Rate Configuration</h1>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadCsv}>
          <Download size={15} /> Download CSV Report
        </button>
      </div>

      {/* Rate Configuration */}
      <div className="card card-glass card-body" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>Kilometer-Based Delivery Rate Engine</h2>
        <form onSubmit={handleSaveRates} className="grid grid-4" style={{ alignItems: 'end' }}>
          <div className="form-group">
            <label className="form-label">Base Amount (₹)</label>
            <input type="number" step="0.01" className="input" value={rates.base_amount} onChange={(e) => setRates({ ...rates, base_amount: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Per KM Rate (₹)</label>
            <input type="number" step="0.01" className="input" value={rates.per_km_rate} onChange={(e) => setRates({ ...rates, per_km_rate: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Minimum Payout (₹)</label>
            <input type="number" step="0.01" className="input" value={rates.minimum_payout} onChange={(e) => setRates({ ...rates, minimum_payout: e.target.value })} required />
          </div>
          <div className="form-group">
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Save Rate Config</button>
          </div>
        </form>
      </div>

      {/* Partner Pending Earnings Table */}
      <div className="card card-glass" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>Delivery Partner Balances</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>KYC</th>
                  <th>Deliveries</th>
                  <th>Bank Account</th>
                  <th>Pending</th>
                  <th>Paid</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.partner_id}>
                    <td style={{ fontWeight: 700 }}>{p.name}</td>
                    <td><span className="badge badge-info">{p.kyc_status}</span></td>
                    <td>{p.completed_deliveries}</td>
                    <td>{p.bank_account_masked} ({p.ifsc_code})</td>
                    <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(p.pending_earnings)}</td>
                    <td>{formatCurrency(p.paid_earnings)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={p.pending_earnings <= 0}
                        onClick={() => {
                          setPayoutTarget(p);
                          setTxForm({
                            amount: String(p.pending_earnings),
                            transaction_reference: '',
                            payment_method: 'BANK_TRANSFER',
                            notes: '',
                          });
                        }}
                      >
                        Record Bank Payout
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payout Ledger */}
      <div className="card card-glass">
        <div className="card-body">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>Payout Ledger</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Transaction Ref</th>
                  <th>Paid At</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.partner_name}</td>
                    <td>{formatCurrency(p.amount)}</td>
                    <td>{p.payment_method}</td>
                    <td>{p.transaction_reference}</td>
                    <td>{formatDateTime(p.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {payoutTarget && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 460 }}>
            <h3 style={{ fontWeight: 800, marginBottom: 8 }}>Record Manual Bank Transfer</h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              Partner: <strong>{payoutTarget.name}</strong> • Eligible Pending: {formatCurrency(payoutTarget.pending_earnings)}
            </p>
            <form onSubmit={handleProcessPayout}>
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input type="number" step="0.01" className="input" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Bank Transaction Reference</label>
                <input className="input" placeholder="UTR / NEFT / IMPS Ref" value={txForm.transaction_reference} onChange={(e) => setTxForm({ ...txForm, transaction_reference: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="select" value={txForm.payment_method} onChange={(e) => setTxForm({ ...txForm, payment_method: e.target.value })}>
                  <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                  <option value="NEFT">NEFT</option>
                  <option value="IMPS">IMPS</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPayoutTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Paid</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

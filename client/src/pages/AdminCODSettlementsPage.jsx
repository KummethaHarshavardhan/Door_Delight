import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Download } from 'lucide-react';
import { codAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export default function AdminCODSettlementsPage() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await codAPI.adminGetSettlements();
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVerify = async (settlementId, approve) => {
    try {
      await codAPI.adminVerifySettlement(settlementId, {
        approve,
        note: approve ? 'Verified by Admin' : 'Rejected by Admin',
      });
      showToast(approve ? 'Settlement verified' : 'Settlement marked failed', 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Verification failed', 'error');
    }
  };

  const handleRestore = async (partnerId) => {
    try {
      await codAPI.adminRestorePartner(partnerId, { note: 'Restored by Admin after review' });
      showToast('Partner account restored', 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not restore partner', 'error');
    }
  };

  const handleRunReminders = async () => {
    try {
      const res = await codAPI.adminRunReminders();
      showToast(
        `Reminder check complete: Day 1 (${res.data.day1_reminders}), Day 2 (${res.data.day2_alerts}), Restricted (${res.data.restricted_partners})`,
        'info'
      );
      await loadData();
    } catch {
      showToast('Failed to run reminder check', 'error');
    }
  };

  const handleExportCsv = async () => {
    const res = await codAPI.adminExportSettlementsCsv();
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'doordelight-cod-settlements.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p>Loading COD settlements...</p>;
  const s = data?.summary || {};

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>COD Cash Settlement Monitoring</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleRunReminders}>
            <Bell size={15} /> Run COD Reminder Check
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleExportCsv}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div>
            <div className="stat-label">Total COD Collected</div>
            <div className="stat-value">{formatCurrency(s.total_cod_collected)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Total COD Remitted</div>
            <div className="stat-value">{formatCurrency(s.total_cod_remitted)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Outstanding COD</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{formatCurrency(s.total_outstanding_cod)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Restricted Partners</div>
            <div className="stat-value">{s.restricted_partners_count ?? 0}</div>
          </div>
        </div>
      </div>

      {(data?.restricted_partners || []).length > 0 && (
        <div className="card card-glass" style={{ marginBottom: 24, borderColor: 'var(--danger)' }}>
          <div className="card-body">
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>Restricted Delivery Partners</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Partner</th><th>Reason</th><th>Outstanding</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {data.restricted_partners.map((rp) => (
                    <tr key={rp.id}>
                      <td style={{ fontWeight: 700 }}>{rp.partner_name}</td>
                      <td><span className="badge badge-danger">{rp.reason}</span></td>
                      <td>{formatCurrency(rp.outstanding_amount)}</td>
                      <td>
                        <button type="button" className="btn btn-success btn-sm" onClick={() => handleRestore(rp.delivery_partner_id)}>
                          Restore Account
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card card-glass" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>UPI Settlement Verifications</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Restaurant</th>
                  <th>Amount</th>
                  <th>UPI App</th>
                  <th>Transaction Ref</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.settlements || []).map((st) => (
                  <tr key={st.id}>
                    <td style={{ fontWeight: 700 }}>{st.partner_name}</td>
                    <td>{st.restaurant_name}</td>
                    <td>{formatCurrency(st.amount)}</td>
                    <td>{st.upi_app}</td>
                    <td>{st.transaction_reference}</td>
                    <td><OrderStatusBadge status={st.status} /></td>
                    <td>{formatDateTime(st.created_at)}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      {st.status === 'PAYMENT_VERIFICATION_PENDING' && (
                        <>
                          <button type="button" className="btn btn-success btn-sm" onClick={() => handleVerify(st.id, true)}>
                            Verify
                          </button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleVerify(st.id, false)}>
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { kycAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function AdminKYCPage() {
  const { showToast } = useToast();
  const [records, setRecords] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [reason, setReason] = useState('');

  const loadRecords = useCallback(async () => {
    const res = await kycAPI.adminListKyc({ kyc_status: statusFilter || undefined });
    setRecords(res.data.records || []);
  }, [statusFilter]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleApprove = async (partnerId) => {
    try {
      await kycAPI.adminReviewKyc(partnerId, { kyc_status: 'APPROVED', rejection_reason: '' });
      showToast('Partner KYC approved', 'success');
      await loadRecords();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Approval failed', 'error');
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget || !reason.trim()) {
      showToast('Please enter a reason', 'error');
      return;
    }
    try {
      await kycAPI.adminReviewKyc(rejectTarget.partnerId, {
        kyc_status: rejectTarget.status,
        rejection_reason: reason.trim(),
      });
      showToast('KYC review recorded', 'info');
      setRejectTarget(null);
      setReason('');
      await loadRecords();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Review failed', 'error');
    }
  };

  const viewPrivateDoc = async (partnerId, docType) => {
    try {
      const res = await kycAPI.adminFetchDocBlob(partnerId, docType);
      const blobUrl = URL.createObjectURL(res.data);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } catch {
      showToast('Could not load private document', 'error');
    }
  };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Delivery Partner KYC Verification</h1>
        <select className="select" style={{ maxWidth: 230 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All KYC Statuses</option>
          <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="RESUBMISSION_REQUIRED">RESUBMISSION_REQUIRED</option>
        </select>
      </div>

      <div className="card card-glass">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Aadhaar / PAN (Masked)</th>
                <th>Bank (Masked)</th>
                <th>Documents</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{r.full_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.email} • {r.mobile_number}</div>
                  </td>
                  <td>
                    <div>{r.aadhaar_masked}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.pan_masked}</div>
                  </td>
                  <td>
                    <div>{r.bank_account_masked}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.ifsc_code}</div>
                  </td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {r.has_profile_photo && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => viewPrivateDoc(r.partner_id, 'profile_photo')}>
                        Photo
                      </button>
                    )}
                    {r.has_aadhaar_doc && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => viewPrivateDoc(r.partner_id, 'aadhaar_doc')}>
                        Aadhaar
                      </button>
                    )}
                    {r.has_pan_doc && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => viewPrivateDoc(r.partner_id, 'pan_doc')}>
                        PAN
                      </button>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${r.kyc_status === 'APPROVED' ? 'badge-success' : r.kyc_status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                      {r.kyc_status}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {r.kyc_status !== 'APPROVED' && (
                      <button type="button" className="btn btn-success btn-sm" onClick={() => handleApprove(r.partner_id)}>
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setRejectTarget({ partnerId: r.partner_id, status: 'REJECTED' })}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {rejectTarget && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 420 }}>
            <h3 style={{ fontWeight: 800, marginBottom: 10 }}>Reject / Request Resubmission</h3>
            <div className="form-group">
              <label className="form-label">Reason</label>
              <textarea className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain what needs correction..." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setRejectTarget(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleRejectSubmit}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

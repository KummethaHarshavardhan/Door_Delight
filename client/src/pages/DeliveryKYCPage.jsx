import React, { useEffect, useState } from 'react';
import { kycAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function DeliveryKYCPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [kyc, setKyc] = useState(null);
  const [kycStatus, setKycStatus] = useState('NOT_SUBMITTED');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: user?.name || '',
    mobile_number: user?.phone || '',
    email: user?.email || '',
    address: '',
    aadhaar_number: '',
    pan_number: '',
    bank_holder_name: user?.name || '',
    bank_account_number: '',
    ifsc_code: '',
    consent_accepted: false,
  });
  const [files, setFiles] = useState({
    profile_photo: null,
    aadhaar_doc: null,
    pan_doc: null,
  });

  const loadKyc = async () => {
    setLoading(true);
    try {
      const res = await kycAPI.getMyKyc();
      setKyc(res.data.kyc);
      setKycStatus(res.data.kyc_status || res.data.kyc?.kyc_status || 'NOT_SUBMITTED');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKyc();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.consent_accepted) {
      showToast('Please accept the data processing consent', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      if (files.profile_photo) fd.append('profile_photo', files.profile_photo);
      if (files.aadhaar_doc) fd.append('aadhaar_doc', files.aadhaar_doc);
      if (files.pan_doc) fd.append('pan_doc', files.pan_doc);

      const res = await kycAPI.submitMyKyc(fd);
      setKyc(res.data.kyc);
      setKycStatus(res.data.kyc.kyc_status);
      showToast('KYC submitted for Admin verification', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'KYC submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p>Loading KYC status...</p>;

  return (
    <div className="page-enter" style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Delivery Partner KYC</h1>
        <span
          className={`badge ${
            kycStatus === 'APPROVED'
              ? 'badge-success'
              : kycStatus === 'REJECTED'
                ? 'badge-danger'
                : 'badge-warning'
          }`}
        >
          {kycStatus}
        </span>
      </div>

      {kyc?.rejection_reason && (
        <div className="card card-body" style={{ marginBottom: 18, borderColor: 'var(--danger)' }}>
          <strong style={{ color: 'var(--danger)' }}>Admin Review Note:</strong> {kyc.rejection_reason}
        </div>
      )}

      {kyc && (
        <div className="card card-glass card-body" style={{ marginBottom: 22 }}>
          <h3 style={{ fontWeight: 800, marginBottom: 10 }}>Submitted Masked Identity & Banking Summary</h3>
          <div className="grid grid-2" style={{ gap: 10, fontSize: '0.9rem' }}>
            <div><strong>Name:</strong> {kyc.full_name}</div>
            <div><strong>Mobile:</strong> {kyc.mobile_number}</div>
            <div><strong>Aadhaar:</strong> {kyc.aadhaar_masked}</div>
            <div><strong>PAN:</strong> {kyc.pan_masked}</div>
            <div><strong>Bank Holder:</strong> {kyc.bank_holder_name}</div>
            <div><strong>Account:</strong> {kyc.bank_account_masked} ({kyc.ifsc_code})</div>
          </div>
        </div>
      )}

      {kycStatus !== 'APPROVED' && (
        <div className="card card-glass card-body">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 14 }}>
            {kyc ? 'Update / Resubmit KYC Documents' : 'Submit KYC Documents'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input className="input" value={form.mobile_number} onChange={(e) => setForm({ ...form, mobile_number: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Aadhaar Number</label>
                <input className="input" placeholder="12-digit Aadhaar" value={form.aadhaar_number} onChange={(e) => setForm({ ...form, aadhaar_number: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">PAN Number</label>
                <input className="input" placeholder="ABCDE1234F" value={form.pan_number} onChange={(e) => setForm({ ...form, pan_number: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Bank Account Holder Name</label>
                <input className="input" value={form.bank_holder_name} onChange={(e) => setForm({ ...form, bank_holder_name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Bank Account Number</label>
                <input className="input" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">IFSC Code</label>
                <input className="input" placeholder="HDFC0001234" value={form.ifsc_code} onChange={(e) => setForm({ ...form, ifsc_code: e.target.value })} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Residential Address</label>
              <textarea className="textarea" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            </div>

            <div className="grid grid-3" style={{ gap: 12, marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Profile Photo</label>
                <input type="file" accept="image/*" onChange={(e) => setFiles({ ...files, profile_photo: e.target.files?.[0] || null })} required={!kyc?.has_profile_photo} />
              </div>
              <div className="form-group">
                <label className="form-label">Aadhaar Document</label>
                <input type="file" accept="image/*,.pdf" onChange={(e) => setFiles({ ...files, aadhaar_doc: e.target.files?.[0] || null })} required={!kyc?.has_aadhaar_doc} />
              </div>
              <div className="form-group">
                <label className="form-label">PAN Card Document</label>
                <input type="file" accept="image/*,.pdf" onChange={(e) => setFiles({ ...files, pan_doc: e.target.files?.[0] || null })} required={!kyc?.has_pan_doc} />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={form.consent_accepted}
                onChange={(e) => setForm({ ...form, consent_accepted: e.target.checked })}
              />
              I consent to DoorDelight securely encrypting and processing my KYC and banking details for verification and payouts.
            </label>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting KYC...' : 'Submit KYC for Verification'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

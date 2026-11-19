import React, { useCallback, useEffect, useState } from 'react';
import { codAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export default function AdminCODPage() {
  const { showToast } = useToast();
  const [incidents, setIncidents] = useState([]);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [note, setNote] = useState('');

  const loadIncidents = useCallback(async () => {
    const res = await codAPI.listIncidents();
    setIncidents(res.data.incidents || []);
  }, []);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const handleResolve = async () => {
    if (!resolveTarget || !note.trim()) {
      showToast('Resolution note is required', 'error');
      return;
    }
    try {
      await codAPI.resolveIncident(resolveTarget.id, { resolution_note: note.trim() });
      showToast('COD incident resolved', 'success');
      setResolveTarget(null);
      setNote('');
      await loadIncidents();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Resolution failed', 'error');
    }
  };

  return (
    <div className="page-enter">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 18 }}>COD Payment Failure Incidents</h1>
      <div className="card card-glass">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Restaurant</th>
                <th>Rider</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Reported</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id}>
                  <td style={{ fontWeight: 700 }}>{inc.order_number}</td>
                  <td>{inc.restaurant_name}</td>
                  <td>{inc.delivery_partner_name}</td>
                  <td>{formatCurrency(inc.amount)}</td>
                  <td>{inc.reason}</td>
                  <td><OrderStatusBadge status={inc.status} /></td>
                  <td>{formatDateTime(inc.attempt_timestamp)}</td>
                  <td>
                    {inc.status !== 'COD_RESOLVED' && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setResolveTarget(inc)}>
                        Investigate & Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {resolveTarget && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 440 }}>
            <h3 style={{ fontWeight: 800, marginBottom: 8 }}>Resolve COD Incident ({resolveTarget.order_number})</h3>
            <div className="form-group">
              <label className="form-label">Investigation & Resolution Note</label>
              <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Record findings and final resolution..." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setResolveTarget(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleResolve}>Resolve Incident</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

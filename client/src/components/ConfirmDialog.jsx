import React from 'react';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: 420 }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>{title}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

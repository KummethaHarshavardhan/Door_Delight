import React from 'react';
import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { formatDateTime } from '../utils/formatters';

const LIFECYCLE_STEPS = [
  'PLACED',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export default function OrderTimeline({ status, history = [] }) {
  const isTerminalNegative = status === 'CANCELLED' || status === 'REJECTED';
  const currentIdx = LIFECYCLE_STEPS.indexOf(status);

  return (
    <div>
      {!isTerminalNegative ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {LIFECYCLE_STEPS.map((step, idx) => {
            const done = idx <= currentIdx;
            const entry = history.find((h) => h.status === step);
            return (
              <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                {done ? (
                  <CheckCircle2 size={20} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <Circle size={20} color="#cbd5e1" style={{ flexShrink: 0, marginTop: 2 }} />
                )}
                <div>
                  <div style={{ fontWeight: done ? 700 : 500, color: done ? 'var(--text)' : 'var(--text-muted)' }}>
                    {step.replace(/_/g, ' ')}
                  </div>
                  {entry && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {formatDateTime(entry.timestamp)} — {entry.note}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)', fontWeight: 700 }}>
          <XCircle size={22} />
          <span>Order {status}</span>
        </div>
      )}
    </div>
  );
}

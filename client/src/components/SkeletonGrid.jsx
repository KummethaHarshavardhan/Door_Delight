import React from 'react';

export default function SkeletonGrid({ count = 4, columns = 'grid-4' }) {
  return (
    <div className={`grid ${columns}`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="card">
          <div className="skeleton" style={{ height: 155, borderRadius: 0 }} />
          <div className="card-body">
            <div className="skeleton" style={{ height: 18, width: '70%', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 13, width: '90%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 13, width: '55%', marginBottom: 16 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="skeleton" style={{ height: 20, width: 65 }} />
              <div className="skeleton" style={{ height: 32, width: 80, borderRadius: 10 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

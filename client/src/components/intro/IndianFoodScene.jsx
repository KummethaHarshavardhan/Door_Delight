import React from 'react';

export default function IndianFoodScene({ elapsed }) {
  const p = Math.max(0, Math.min(1, (elapsed - 24.0) / 6.0));
  const scale = 1.05 + p * 0.22;
  const panY = 3 - p * 6;

  return (
    <div className="intro-scene-stage" style={{ background: '#1a0e04' }}>
      <img
        src="/anime/anime-indian-biryani.jpg"
        alt="Anime Saffron Dum Biryani, Dosa and Curry"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translateY(${panY}%)`,
          transition: 'transform 0.08s linear',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(6,9,25,0.74) 0%, transparent 48%)',
          pointerEvents: 'none',
        }}
      />
      <div className="intro-caption-bar">
        <div className="intro-caption-title">Royal Saffron Dum Biryani</div>
        <div className="intro-caption-sub">
          Aromatic basmati rice, crispy golden dosa, and rich spiced curries.
        </div>
      </div>
    </div>
  );
}

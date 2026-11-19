import React from 'react';

export default function FoodMarket({ elapsed }) {
  const p = Math.max(0, Math.min(1, (elapsed - 7.0) / 5.0));
  const scale = 1.0 + p * 0.25;
  const panY = -p * 3;

  return (
    <div className="intro-scene-stage" style={{ background: '#090d1f' }}>
      <img
        src="/anime/anime-food-market.jpg"
        alt="Anime Food Market Street"
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
          background: 'linear-gradient(to top, rgba(6,9,25,0.72) 0%, transparent 45%)',
          pointerEvents: 'none',
        }}
      />
      <div className="intro-caption-bar">
        <div className="intro-caption-title">Enter the Grand Food Market</div>
        <div className="intro-caption-sub">
          Glowing lanterns, open kitchens, and bustling twilight streets.
        </div>
      </div>
    </div>
  );
}

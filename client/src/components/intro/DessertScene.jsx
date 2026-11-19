import React from 'react';

export default function DessertScene({ elapsed }) {
  const p = Math.max(0, Math.min(1, (elapsed - 30.0) / 4.0));
  const panX = 6 - p * 12;
  const scale = 1.18;

  return (
    <div className="intro-scene-stage" style={{ background: '#12081f' }}>
      <img
        src="/anime/anime-desserts-drinks.jpg"
        alt="Anime Chocolate Strawberry Cake and Iced Cold Brew"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translateX(${panX}%)`,
          transition: 'transform 0.08s linear',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(6,9,25,0.72) 0%, transparent 46%)',
          pointerEvents: 'none',
        }}
      />
      <div className="intro-caption-bar">
        <div className="intro-caption-title">Artisan Desserts & Cold Brews</div>
        <div className="intro-caption-sub">
          Velvety chocolate cakes, fresh strawberries, and chilled swirling brews.
        </div>
      </div>
    </div>
  );
}

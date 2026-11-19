import React from 'react';

export default function PizzaBurgerScene({ elapsed }) {
  const p = Math.max(0, Math.min(1, (elapsed - 18.0) / 6.0));
  const panX = 8 - p * 16;
  const scale = 1.24 + Math.sin(p * Math.PI) * 0.08;

  return (
    <div className="intro-scene-stage" style={{ background: '#140a08' }}>
      <img
        src="/anime/anime-pizza-burger.jpg"
        alt="Anime Woodfire Pizza and Gourmet Burger"
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
          background: 'linear-gradient(to top, rgba(6,9,25,0.72) 0%, transparent 45%)',
          pointerEvents: 'none',
        }}
      />
      <div className="intro-caption-bar">
        <div className="intro-caption-title">
          {p < 0.5 ? 'Woodfire Artisan Pizza' : 'Flame-Grilled Gourmet Burgers'}
        </div>
        <div className="intro-caption-sub">
          {p < 0.5
            ? 'Bubbling mozzarella, fresh basil, and crisp blistered crust.'
            : 'Seared patties, melting cheddar, and fresh garden layers.'}
        </div>
      </div>
    </div>
  );
}

import React from 'react';

export default function ChineseChefScene({ elapsed }) {
  const p = Math.max(0, Math.min(1, (elapsed - 12.0) / 6.0));
  const scale = p < 0.4 ? 1.04 + p * 0.35 : 1.18 + (p - 0.4) * 0.32;
  const panX = p < 0.5 ? -p * 6 : -3 + (p - 0.5) * 8;

  return (
    <div className="intro-scene-stage" style={{ background: '#120805' }}>
      <img
        src="/anime/anime-chinese-chef.jpg"
        alt="Anime Chinese Wok Chef"
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
          background:
            'radial-gradient(circle at 55% 45%, rgba(255,90,31,0.16), rgba(6,9,25,0.62) 95%)',
          pointerEvents: 'none',
        }}
      />
      <div className="intro-caption-bar">
        <div className="intro-caption-title">Wok-Fired Artisan Noodles</div>
        <div className="intro-caption-sub">
          Blazing wok flames, flying greens, and hand-pulled golden noodles.
        </div>
      </div>
    </div>
  );
}

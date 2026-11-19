import React from 'react';
import { motion } from 'framer-motion';

export default function GirlCharacter({ elapsed }) {
  // 0-4s: Vertical tracking from feet (low angle) up to back of head
  const trackP = Math.max(0, Math.min(1, elapsed / 4.0));
  const backScale = 2.15 - trackP * 0.85;
  const backY = -26 + trackP * 40;

  // 4-5.0s: 180-degree camera orbit into front portrait (eyes closed)
  const orbitP = Math.max(0, Math.min(1, (elapsed - 4.0) / 1.0));
  const showFront = elapsed >= 4.5;
  const eyesOpen = elapsed >= 5.5;
  const magicBurst = elapsed >= 5.5 && elapsed <= 6.8;

  return (
    <div className="intro-scene-stage" style={{ background: '#090d1f' }}>
      {!showFront ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `scale(${backScale}) translateY(${backY}%) rotateY(${orbitP * 90}deg)`,
            transformOrigin: 'center center',
            transition: 'transform 0.08s linear',
          }}
        >
          <img
            src="/anime/girl-back-sunset.jpg"
            alt="Anime protagonist overlooking sunset food city"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `scale(${1.08 + Math.max(0, elapsed - 4.5) * 0.05}) rotateY(${(1 - orbitP) * -90}deg)`,
            transition: 'transform 0.08s linear',
          }}
        >
          <img
            src="/anime/girl-front-closed.jpg"
            alt="Anime protagonist close-up eyes closed"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: eyesOpen ? 0 : 1,
              transition: 'opacity 0.4s ease',
            }}
          />
          <img
            src="/anime/girl-front-open.jpg"
            alt="Anime protagonist eyes open"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: eyesOpen ? 1 : 0,
              transition: 'opacity 0.4s ease',
            }}
          />
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 42%, transparent 45%, rgba(9, 13, 31, 0.58) 100%)',
          pointerEvents: 'none',
        }}
      />

      {magicBurst && (
        <motion.div
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: 2.8, opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            margin: 'auto',
            width: 260,
            height: 260,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(253,224,71,0.85), rgba(255,90,31,0.35), transparent 70%)',
            pointerEvents: 'none',
            zIndex: 14,
          }}
        />
      )}

      <div className="intro-caption-bar">
        <div className="intro-caption-title">
          {elapsed < 4 ? 'Golden Hour in Flavor City' : eyesOpen ? 'Eyes Open to Wonder' : 'A Quiet Breath Before the Feast'}
        </div>
        <div className="intro-caption-sub">
          {elapsed < 4
            ? 'As the sun sets, the aroma of a hundred kitchens rises.'
            : 'Lanterns ignite across the culinary skyline.'}
        </div>
      </div>
    </div>
  );
}

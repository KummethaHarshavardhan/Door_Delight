import React from 'react';
import { motion } from 'framer-motion';
import { UtensilsCrossed } from 'lucide-react';

export default function CircularBrandReveal({ elapsed }) {
  const showTagline = elapsed >= 35.8;

  return (
    <div
      className="intro-scene-stage"
      style={{
        background: 'radial-gradient(circle at center, #3b0764 0%, #1e1b4b 48%, #050816 100%)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {/* Rotating Outer Golden / Orange / Crimson Rings */}
      <div
        className="circular-ring-cw"
        style={{
          position: 'absolute',
          width: 'min(78vw, 430px)',
          height: 'min(78vw, 430px)',
          borderRadius: '50%',
          border: '3px dashed rgba(253, 224, 71, 0.55)',
          boxShadow: '0 0 60px rgba(255, 90, 31, 0.25)',
        }}
      />
      <div
        className="circular-ring-ccw"
        style={{
          position: 'absolute',
          width: 'min(66vw, 355px)',
          height: 'min(66vw, 355px)',
          borderRadius: '50%',
          border: '4px solid transparent',
          borderTopColor: '#ff5a1f',
          borderRightColor: '#ec4899',
          borderBottomColor: '#fde047',
        }}
      />

      {/* Central Glowing Circular Brand Core */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          padding: 32,
          borderRadius: '50%',
          width: 'min(58vw, 310px)',
          height: 'min(58vw, 310px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle, rgba(255,90,31,0.22), rgba(15,23,42,0.88))',
          border: '2px solid rgba(255, 255, 255, 0.25)',
          boxShadow: '0 0 80px rgba(255, 90, 31, 0.55), inset 0 0 35px rgba(253, 224, 71, 0.25)',
        }}
      >
        <div
          className="brand-badge"
          style={{ width: 66, height: 66, borderRadius: 20, marginBottom: 14 }}
        >
          <UtensilsCrossed size={32} />
        </div>

        <h1
          style={{
            fontSize: 'clamp(1.65rem, 3.8vw, 2.55rem)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #fde047, #ff5a1f, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 8px 18px rgba(255, 90, 31, 0.45))',
            marginBottom: 8,
          }}
        >
          DOORDELIGHT
        </h1>

        {showTagline && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#f8fafc',
              maxWidth: 230,
            }}
          >
            YOUR CRAVINGS, DELIVERED WITH DELIGHT.
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

import React from 'react';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext';

export default function FlyToCartOverlay() {
  const { flyingItems } = useCart();
  if (!flyingItems || flyingItems.length === 0) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 90 }}>
      {flyingItems.map((item) => (
        <motion.img
          key={item.id}
          src={item.imageUrl}
          alt=""
          initial={{
            x: item.fromX,
            y: item.fromY,
            scale: 1.15,
            opacity: 1,
          }}
          animate={{
            x: [item.fromX, (item.fromX + item.toX) / 2, item.toX],
            y: [item.fromY, Math.min(item.fromY, item.toY) - 90, item.toY],
            scale: [1.15, 0.85, 0.28],
            opacity: [1, 0.95, 0.25],
          }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 58,
            height: 58,
            borderRadius: 16,
            objectFit: 'cover',
            boxShadow: '0 14px 30px rgba(255, 90, 31, 0.45)',
            border: '2px solid #fff',
          }}
        />
      ))}
    </div>
  );
}

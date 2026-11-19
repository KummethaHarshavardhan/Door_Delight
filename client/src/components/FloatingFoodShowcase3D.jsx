import React from 'react';
import { motion } from 'framer-motion';

const LAYERED_DISHES = [
  {
    title: 'Gourmet Burgers',
    img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=360&auto=format&fit=crop',
    grad: 'linear-gradient(135deg, rgba(255,90,31,0.35), rgba(236,72,153,0.35))',
  },
  {
    title: 'Woodfire Pizza',
    img: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=360&auto=format&fit=crop',
    grad: 'linear-gradient(135deg, rgba(245,158,11,0.35), rgba(239,68,68,0.35))',
  },
  {
    title: 'Dum Biryani',
    img: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=360&auto=format&fit=crop',
    grad: 'linear-gradient(135deg, rgba(124,58,237,0.35), rgba(37,99,235,0.35))',
  },
];

export default function FloatingFoodShowcase3D() {
  return (
    <div className="showcase-3d-stage" style={{ gap: 14 }}>
      <div className="showcase-orb-grid">
        {LAYERED_DISHES.map((dish, idx) => (
          <motion.div
            key={dish.title}
            className="food-orb-3d"
            style={{ background: dish.grad, padding: 10 }}
            animate={{ y: [0, idx % 2 === 0 ? -8 : 8, 0] }}
            transition={{ duration: 4 + idx * 0.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <img
              src={dish.img}
              alt={dish.title}
              style={{
                width: '100%',
                height: 78,
                objectFit: 'cover',
                borderRadius: 12,
                marginBottom: 6,
              }}
            />
            <span className="food-orb-label">{dish.title}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

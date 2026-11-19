import React from 'react';
import { motion } from 'framer-motion';

export default function DeliveryVehicleSVG() {
  return (
    <motion.svg
      width="56"
      height="34"
      viewBox="0 0 64 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ x: [0, 6, 0], y: [0, -2, 0] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <rect x="6" y="10" width="18" height="13" rx="3" fill="#ff5a1f" />
      <path d="M24 18H40L47 25H24V18Z" fill="#7c3aed" />
      <path d="M40 12H47L51 18H42L40 12Z" fill="#06b6d4" />
      <circle cx="16" cy="29" r="6" fill="#0f172a" stroke="#f8fafc" strokeWidth="2" />
      <circle cx="48" cy="29" r="6" fill="#0f172a" stroke="#f8fafc" strokeWidth="2" />
      <line x1="1" y1="15" x2="5" y2="15" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      <line x1="0" y1="20" x2="4" y2="20" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
    </motion.svg>
  );
}

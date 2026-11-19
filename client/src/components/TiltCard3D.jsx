import React, { useRef, useState } from 'react';

export default function TiltCard3D({ children, className = '', style = {} }) {
  const cardRef = useRef(null);
  const [transform, setTransform] = useState('rotateX(0deg) rotateY(0deg) scale3d(1,1,1)');
  const [glare, setGlare] = useState('radial-gradient(circle at 50% 50%, rgba(255,255,255,0.22), transparent 60%)');

  const handleMouseMove = (e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const midX = rect.width / 2;
    const midY = rect.height / 2;

    const rotateY = ((x - midX) / midX) * 6;
    const rotateX = -((y - midY) / midY) * 6;
    const pctX = Math.round((x / rect.width) * 100);
    const pctY = Math.round((y / rect.height) * 100);

    setTransform(`rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`);
    setGlare(`radial-gradient(circle at ${pctX}% ${pctY}%, rgba(255,255,255,0.28), transparent 62%)`);
  };

  const handleMouseLeave = () => {
    setTransform('rotateX(0deg) rotateY(0deg) scale3d(1,1,1)');
  };

  return (
    <div className="tilt-card-wrapper" style={{ height: '100%' }}>
      <div
        ref={cardRef}
        className={`card tilt-card ${className}`}
        style={{ transform, height: '100%', ...style }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="tilt-glare" style={{ background: glare }} />
        {children}
      </div>
    </div>
  );
}

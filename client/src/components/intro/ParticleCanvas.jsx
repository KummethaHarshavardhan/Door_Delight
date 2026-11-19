import React, { useEffect, useRef } from 'react';

export default function ParticleCanvas({ scene }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId = null;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 42 }, (_, idx) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.9,
      vy: -0.4 - Math.random() * 0.9,
      size: 2.5 + Math.random() * 4.5,
      alpha: 0.35 + Math.random() * 0.55,
      angle: Math.random() * Math.PI * 2,
      idx,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const s = sceneRef.current;

      for (const p of particles) {
        if (s <= 2) {
          // Sunset sakura petals drifting gently
          p.x += Math.sin(p.angle) * 0.8 + 0.5;
          p.y += 0.65;
          p.angle += 0.02;
          ctx.fillStyle = `rgba(251, 146, 60, ${p.alpha})`;
        } else if (s === 8) {
          // Orbiting golden/crimson brand particles around center
          p.angle += 0.015;
          const cx = canvas.width / 2;
          const cy = canvas.height / 2;
          const radius = 150 + (p.idx % 5) * 42;
          p.x = cx + Math.cos(p.angle + p.idx) * radius;
          p.y = cy + Math.sin(p.angle + p.idx) * radius;
          ctx.fillStyle = p.idx % 2 === 0 ? `rgba(253, 224, 71, ${p.alpha})` : `rgba(255, 90, 31, ${p.alpha})`;
        } else {
          // Rising warm kitchen embers & steam sparkles
          p.x += p.vx;
          p.y += p.vy;
          ctx.fillStyle = s >= 6 ? `rgba(253, 224, 71, ${p.alpha})` : `rgba(255, 138, 61, ${p.alpha})`;
        }

        if (p.y < -20) p.y = canvas.height + 20;
        if (p.y > canvas.height + 20) p.y = -20;
        if (p.x < -20) p.x = canvas.width + 20;
        if (p.x > canvas.width + 20) p.x = -20;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 12,
      }}
    />
  );
}

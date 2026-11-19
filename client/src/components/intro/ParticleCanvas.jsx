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
    let viewW = window.innerWidth;
    let viewH = window.innerHeight;

    const resize = () => {
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewW * dpr);
      canvas.height = Math.floor(viewH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 42 }, (_, idx) => ({
      x: Math.random() * viewW,
      y: Math.random() * viewH,
      vx: (Math.random() - 0.5) * 0.9,
      vy: -0.4 - Math.random() * 0.9,
      size: 2.5 + Math.random() * 4.5,
      alpha: 0.35 + Math.random() * 0.55,
      angle: Math.random() * Math.PI * 2,
      idx,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, viewW, viewH);
      const s = sceneRef.current;

      for (const p of particles) {
        if (s <= 2) {
          // Sunset sakura petals drifting gently
          p.x += Math.sin(p.angle) * 0.8 + 0.5;
          p.y += 0.65;
          p.angle += 0.02;
          ctx.fillStyle = `rgba(251, 146, 60, ${p.alpha})`;
        } else if (s === 8) {
          // Orbiting golden/crimson brand particles around center (responsive to mobile viewports)
          p.angle += 0.015;
          const cx = viewW / 2;
          const cy = viewH / 2;
          const maxOrbit = Math.min(viewW, viewH) * 0.42;
          const baseRadius = Math.min(150, maxOrbit * 0.52);
          const step = Math.min(42, (maxOrbit - baseRadius) / 4);
          const radius = baseRadius + (p.idx % 5) * step;
          p.x = cx + Math.cos(p.angle + p.idx) * radius;
          p.y = cy + Math.sin(p.angle + p.idx) * radius;
          ctx.fillStyle = p.idx % 2 === 0 ? `rgba(253, 224, 71, ${p.alpha})` : `rgba(255, 90, 31, ${p.alpha})`;
        } else {
          // Rising warm kitchen embers & steam sparkles
          p.x += p.vx;
          p.y += p.vy;
          ctx.fillStyle = s >= 6 ? `rgba(253, 224, 71, ${p.alpha})` : `rgba(255, 138, 61, ${p.alpha})`;
        }

        if (p.y < -20) p.y = viewH + 20;
        if (p.y > viewH + 20) p.y = -20;
        if (p.x < -20) p.x = viewW + 20;
        if (p.x > viewW + 20) p.x = -20;

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
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 12,
      }}
    />
  );
}

import React, { useEffect, useRef } from 'react';

function UltimaField({ intensity = 1, fixed = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf;
    let w = 0;
    let h = 0;

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.6 + 0.2,
      tw: Math.random() * Math.PI * 2,
      speed: 0.003 + Math.random() * 0.014,
      hue: Math.random() > 0.7 ? 'gold' : Math.random() > 0.5 ? 'pink' : 'white',
    }));

    const resize = () => {
      const box = fixed ? document.documentElement : canvas.parentElement;
      w = fixed ? window.innerWidth : box?.offsetWidth || 0;
      h = fixed ? window.innerHeight : box?.offsetHeight || 0;
      canvas.width = w * devicePixelRatio;
      canvas.height = h * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.tw += s.speed;
        const alpha = 0.2 + (Math.sin(s.tw) + 1) * 0.4 * intensity;
        const color = s.hue === 'gold'
          ? `rgba(245, 197, 66, ${alpha})`
          : s.hue === 'pink'
            ? `rgba(240, 86, 143, ${alpha * 0.9})`
            : `rgba(255, 255, 255, ${alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [intensity, fixed]);

  return (
    <div
      className={`ultima-field pointer-events-none overflow-hidden ${
        fixed ? 'fixed inset-0 z-0' : 'absolute inset-0'
      }`}
      aria-hidden
    >
      <div className="ultima-aurora ultima-aurora-a" />
      <div className="ultima-aurora ultima-aurora-b" />
      <div className="ultima-aurora ultima-aurora-c" />
      <div className="ultima-grain" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-90" />
      <div className="ultima-vignette absolute inset-0" />
    </div>
  );
}

export default UltimaField;

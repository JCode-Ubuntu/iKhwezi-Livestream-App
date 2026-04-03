import React, { useMemo } from 'react';

/**
 * Subtle animated cosmic field — pointer-events none, safe over video feeds.
 */
function CosmicBackground({ intensity = 1, className = '' }) {
  const dots = useMemo(() => {
    return Array.from({ length: 48 }, (_, i) => ({
      id: i,
      left: `${(i * 17 + 13) % 100}%`,
      top: `${(i * 23 + 7) % 100}%`,
      delay: `${(i % 12) * 0.15}s`,
      size: 1 + (i % 3),
    }));
  }, []);

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <div
        className="absolute inset-0 bg-cosmic-gradient opacity-90 animate-cosmic-drift"
        style={{ opacity: 0.35 * intensity }}
      />
      <div
        className="absolute inset-0 bg-fashion-halo opacity-60"
        style={{ opacity: 0.25 * intensity }}
      />
      {dots.map((d) => (
        <span
          key={d.id}
          className="absolute rounded-full bg-white/30 animate-neon-pulse"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            animationDelay: d.delay,
            boxShadow: '0 0 8px rgba(99, 102, 241, 0.35)',
          }}
        />
      ))}
    </div>
  );
}

export default React.memo(CosmicBackground);

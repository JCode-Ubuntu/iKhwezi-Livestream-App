import React, { useState, useCallback, useMemo } from 'react';

const DEFAULT_EMOJIS = [
  { id: 'fire', char: '🔥' },
  { id: 'heart', char: '❤️' },
  { id: 'clap', char: '👏' },
  { id: 'joy', char: '😂' },
  { id: 'gem', char: '💎' },
];

function EmojiBurst({ emoji, x, burstId }) {
  return (
    <span
      className="pointer-events-none absolute bottom-0 text-2xl"
      style={{
        left: x,
        animation: 'reaction-burst 0.9s ease-out forwards',
      }}
    >
      {emoji}
      <style>{`
        @keyframes reaction-burst {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-72px) scale(1.4); }
        }
      `}</style>
    </span>
  );
}

/**
 * Additive reaction UI — local counts + burst animation.
 * Optional onHeartLike keeps ❤️ tied to existing like API when provided.
 */
function ReactionsBar({
  engagement = 0,
  variant = 'full',
  onHeartLike,
  includeHeart = true,
  className = '',
  onReaction,
}) {
  const emojis = useMemo(() => {
    if (includeHeart) return DEFAULT_EMOJIS;
    return DEFAULT_EMOJIS.filter((e) => e.id !== 'heart');
  }, [includeHeart]);

  const [counts, setCounts] = useState(() =>
    Object.fromEntries(emojis.map((e) => [e.id, 0]))
  );
  const [bursts, setBursts] = useState([]);

  const glow = Math.min(1, engagement / 200);

  const trigger = useCallback(
    (id, char) => {
      if (id === 'heart' && onHeartLike) {
        onHeartLike();
      }
      setCounts((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
      const bid = `${id}-${Date.now()}`;
      setBursts((b) => [...b, { bid, char, x: `${20 + Math.random() * 60}%` }]);
      setTimeout(() => {
        setBursts((b) => b.filter((x) => x.bid !== bid));
      }, 900);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch {
          /* ignore */
        }
      }
      if (onReaction) {
        onReaction(char);
      }
    },
    [onHeartLike, onReaction]
  );

  const isCompact = variant === 'compact';

  return (
    <div
      className={`relative ${className}`}
      style={{
        boxShadow: `0 0 ${24 + glow * 40}px rgba(99, 102, 241, ${0.2 + glow * 0.25})`,
      }}
    >
      <div
        className={`flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-1.5 backdrop-blur-xl ${
          isCompact ? 'scale-95' : ''
        }`}
        role="toolbar"
        aria-label="Quick reactions"
      >
        {emojis.map((e) => (
          <button
            key={e.id}
            type="button"
            className="flex min-w-[2.5rem] flex-col items-center rounded-2xl px-1 py-0.5 transition-transform active:scale-95"
            onClick={() => trigger(e.id, e.char)}
          >
            <span className="text-lg leading-none">{e.char}</span>
            <span className="text-[10px] font-semibold text-white/70">
              {counts[e.id] > 0 ? counts[e.id] : '·'}
            </span>
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-full left-0 right-0 mb-1 h-20 overflow-visible">
        {bursts.map((b) => (
          <EmojiBurst key={b.bid} burstId={b.bid} emoji={b.char} x={b.x} />
        ))}
      </div>
    </div>
  );
}

export default React.memo(ReactionsBar);

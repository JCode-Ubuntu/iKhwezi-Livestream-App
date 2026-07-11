import React, { useId } from 'react';

/** N-point star path. */
function starPath(cx, cy, outerR, innerRatio = 0.36, points = 4) {
  const innerR = outerR * innerRatio;
  const step = Math.PI / points;
  const pts = [];
  for (let i = 0; i < points * 2; i += 1) {
    const angle = -Math.PI / 2 + i * step;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

/**
 * Three stars on a crescent arc — each with its own shape, tilt, and rhythm.
 * The constellation line loops through them like a connect-the-dots sky map.
 */
const STARS = [
  {
    id: 'dawn',
    cx: 28,
    cy: 17,
    r: 10.2,
    points: 8,
    inner: 0.3,
    rot: 0,
    stretch: 1.18,
    drift: '0,0;0,-1.2;0,0',
    driftDur: '4.2s',
    pulseDur: '3s',
    pulsePeak: 1.06,
    role: 'apex',
  },
  {
    id: 'west',
    cx: 12,
    cy: 36,
    r: 7.4,
    points: 5,
    inner: 0.38,
    rot: -32,
    stretch: 1,
    drift: '0,0;0,0.8;0,0',
    driftDur: '3.6s',
    pulseDur: '3.8s',
    pulsePeak: 1.08,
    role: 'wing',
  },
  {
    id: 'east',
    cx: 44,
    cy: 36,
    r: 7.4,
    points: 5,
    inner: 0.38,
    rot: 32,
    stretch: 1,
    drift: '0,0;0,-0.9;0,0',
    driftDur: '4s',
    pulseDur: '4.4s',
    pulsePeak: 1.08,
    role: 'wing',
  },
];

/** Constellation sketch — S-curve loop weaving through all three stars. */
const CONSTELLATION_LOOP =
  'M 12 36 Q 18 44 28 17 Q 38 44 44 36';

const CONSTELLATION_ARC = 'M 12 36 Q 28 46 44 36';

const DUST = [
  { x: 7, y: 22, r: 0.4, o: 0.45 },
  { x: 49, y: 21, r: 0.35, o: 0.38 },
  { x: 20, y: 9, r: 0.28, o: 0.5 },
  { x: 36, y: 9, r: 0.28, o: 0.48 },
  { x: 28, y: 50, r: 0.22, o: 0.25 },
  { x: 5, y: 40, r: 0.2, o: 0.3 },
  { x: 51, y: 40, r: 0.2, o: 0.28 },
];

function StarNode({ star, ids }) {
  const grad = star.role === 'apex' ? ids.apex : ids.wing;
  const glow = star.role === 'apex' ? ids.apexGlow : ids.wingGlow;
  const {
    cx, cy, r, points, inner, rot, stretch,
    drift, driftDur, pulseDur, pulsePeak, role,
  } = star;

  const localTransform =
    stretch !== 1
      ? `scale(1 ${stretch}) rotate(${rot})`
      : `rotate(${rot})`;

  return (
    <g transform={`translate(${cx} ${cy})`}>
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={drift}
          dur={driftDur}
          repeatCount="indefinite"
        />
        <g>
          <animateTransform
            attributeName="transform"
            type="scale"
            values={`1;${pulsePeak};1`}
            dur={pulseDur}
            repeatCount="indefinite"
          />
          <g transform={localTransform}>
          <circle
            cx={0}
            cy={0}
            r={r + 2}
            stroke="#FFF8DC"
            strokeWidth="0.35"
            fill="none"
            opacity="0.3"
          />
          {role === 'apex' && (
            <circle cx={0} cy={0} r="11" fill="#F5C542" opacity="0.12" filter={`url(#${ids.bloom})`} />
          )}
          <path
            d={starPath(0, 0, r, inner, points)}
            fill={`url(#${grad})`}
            filter={`url(#${glow})`}
          />
          <path
            d={starPath(0, 0, r * (role === 'apex' ? 0.38 : 0.34), 0.52, 4)}
            fill="#FFFFFF"
            opacity={role === 'apex' ? 0.5 : 0.42}
          />
          <circle cx={0} cy={0} r={role === 'apex' ? 2 : 1.1} fill="#FFFFFF" opacity="0.94" />
          <circle cx={0} cy={0} r="1.4" fill="#FFFEF8" opacity="0.45">
            <animate attributeName="opacity" values="0.25;0.65;0.25" dur={pulseDur} repeatCount="indefinite" />
          </circle>
          </g>
        </g>
      </g>
    </g>
  );
}

/** Playful three-star constellation for the dock create button. */
export default function IkCreateLogo({ className = 'h-[30px] w-[30px]' }) {
  const uid = useId().replace(/:/g, '');
  const ids = {
    nebula: `ik-neb-${uid}`,
    apex: `ik-apex-${uid}`,
    wing: `ik-wing-${uid}`,
    thread: `ik-thread-${uid}`,
    threadGlow: `ik-thread-glow-${uid}`,
    arc: `ik-arc-${uid}`,
    apexGlow: `ik-apex-glow-${uid}`,
    wingGlow: `ik-wing-glow-${uid}`,
    bloom: `ik-bloom-${uid}`,
  };

  return (
    <svg
      viewBox="0 0 56 56"
      className={className}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={ids.nebula} cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.26" />
          <stop offset="45%" stopColor="#F5C542" stopOpacity="0.12" />
          <stop offset="75%" stopColor="#E1306C" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#2A1F0F" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={ids.apex} x1="16" y1="4" x2="40" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="40%" stopColor="#F5C542" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>

        <linearGradient id={ids.wing} x1="8" y1="28" x2="48" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFEF8" />
          <stop offset="50%" stopColor="#E8B923" />
          <stop offset="100%" stopColor="#7A5A14" />
        </linearGradient>

        <linearGradient id={ids.thread} x1="10" y1="14" x2="46" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5C542" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#FFF8DC" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FF8FAB" stopOpacity="0.35" />
        </linearGradient>

        <linearGradient id={ids.threadGlow} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        <linearGradient id={ids.arc} x1="12" y1="40" x2="44" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5C542" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#FFF8DC" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#F5C542" stopOpacity="0.15" />
        </linearGradient>

        <filter id={ids.apexGlow} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="1.3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id={ids.wingGlow} x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="0.55" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id={ids.bloom} x="-90%" y="-90%" width="280%" height="280%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
          </feMerge>
        </filter>
      </defs>

      {/* Soft cosmos backdrop */}
      <ellipse cx="28" cy="28" rx="22" ry="20" fill={`url(#${ids.nebula})`}>
        <animate attributeName="opacity" values="0.8;1;0.8" dur="6s" repeatCount="indefinite" />
      </ellipse>

      {DUST.map(({ x, y, r, o }, i) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#FFFEF8" opacity={o}>
          <animate
            attributeName="opacity"
            values={`${o * 0.4};${o};${o * 0.4}`}
            dur={`${2.5 + i * 0.5}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}

      {/* Whole constellation gently sways */}
      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="-3 28 28;3 28 28;-3 28 28"
          dur="9s"
          repeatCount="indefinite"
        />

        {/* Ground arc — constellation sits on a cosmic smile */}
        <path
          d={CONSTELLATION_ARC}
          stroke={`url(#${ids.arc})`}
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.55"
        />

        {/* Main constellation loop — connect-the-dots sky map */}
        <path
          d={CONSTELLATION_LOOP}
          stroke={`url(#${ids.thread})`}
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray="52"
          strokeDashoffset="52"
          opacity="0.75"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="52;0;52"
            dur="8s"
            repeatCount="indefinite"
          />
        </path>

        {/* Traveling pulse along the constellation line */}
        <path
          d={CONSTELLATION_LOOP}
          stroke={`url(#${ids.threadGlow})`}
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="6 46"
          strokeDashoffset="0"
          opacity="0.55"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="0;-52;0"
            dur="4s"
            repeatCount="indefinite"
          />
        </path>

        {/* Direct chords — playful geometry between stars */}
        <g stroke="#FFF8DC" strokeWidth="0.45" strokeLinecap="round" opacity="0.22">
          <line x1="12" y1="36" x2="44" y2="36" />
          <line x1="12" y1="36" x2="28" y2="17" />
          <line x1="44" y1="36" x2="28" y2="17" />
        </g>

        {/* The three stars — each drifts and pulses on its own beat */}
        {STARS.map((star) => (
          <StarNode key={star.id} star={star} ids={ids} />
        ))}
      </g>

      {/* Crown sparkle above the lead star */}
      <g stroke="#FFFFFF" strokeWidth="0.6" strokeLinecap="round">
        <g>
          <line x1="28" y1="6" x2="28" y2="10" />
          <line x1="25.5" y1="8" x2="30.5" y2="8" />
          <animate attributeName="opacity" values="0.35;1;0.35" dur="2.4s" repeatCount="indefinite" />
        </g>
      </g>
    </svg>
  );
}

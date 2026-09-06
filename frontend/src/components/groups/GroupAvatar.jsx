import React, { useMemo } from 'react';
import { resolveMediaUrl } from '../../config/appConfig';

/**
 * GroupAvatar — auto-generated fallback when a group has no photo.
 *
 * 2 members  → split (two halves)
 * 3–4 members → 2x2 grid
 * 5+ members  → stacked mosaic (4 tiles + count badge)
 *
 * Uses the iKHWEZI pink/gold gradient as the empty-state fill so it stays
 * on-brand without needing any asset.
 */

const GRADIENT = 'linear-gradient(135deg,#E1306C,#F5C542)';

function Initial({ user, radius }) {
  if (user?.avatar) {
    return (
      <img
        src={resolveMediaUrl(user.avatar)}
        alt=""
        className="h-full w-full object-cover"
        style={{ display: 'block' }}
      />
    );
  }
  const initial = (user?.username || user?.displayName || '?').charAt(0).toUpperCase();
  return (
    <div
      className="flex h-full w-full items-center justify-center font-bold text-white"
      style={{ background: GRADIENT, fontSize: radius * 0.42 }}
    >
      {initial}
    </div>
  );
}

function GroupAvatar({ group, members = [], size = 48, className = '' }) {
  const radius = size;
  const tiles = useMemo(() => {
    const list = (members || [])
      .filter((m) => m?.user)
      .map((m) => m.user)
      .slice(0, 4);
    return list;
  }, [members]);

  const hasPhoto = !!group?.avatar;

  const wrapperStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative',
    background: '#0b0b14',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
    display: 'block',
    isolation: 'isolate',
    contentVisibility: 'auto',
    containIntrinsicSize: `${size}px`,
  };

  if (hasPhoto) {
    return (
      <span style={wrapperStyle} className={className}>
        <img src={resolveMediaUrl(group.avatar)} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }

  // No photo → build a mosaic from member avatars.
  const count = tiles.length;

  let content;
  if (count <= 1) {
    content = (
      <div className="flex h-full w-full items-center justify-center" style={{ background: GRADIENT }}>
        <span className="font-bold text-white" style={{ fontSize: radius * 0.42 }}>
          {(group?.name || 'G').charAt(0).toUpperCase()}
        </span>
      </div>
    );
  } else if (count === 2) {
    content = (
      <div className="flex h-full w-full">
        <div style={{ width: '50%', height: '100%' }}><Initial user={tiles[0]} radius={radius} /></div>
        <div style={{ width: '50%', height: '100%' }}><Initial user={tiles[1]} radius={radius} /></div>
      </div>
    );
  } else if (count <= 4) {
    content = (
      <div className="grid h-full w-full" style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
        {tiles.slice(0, 4).map((u, i) => (
          <div key={u.id || i} style={{ width: '100%', height: '100%' }}><Initial user={u} radius={radius} /></div>
        ))}
      </div>
    );
  } else {
    // 5+ → show 4 tiles + a soft "+N" overlay.
    content = (
      <div className="relative h-full w-full">
        <div className="grid h-full w-full" style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
          {tiles.slice(0, 4).map((u, i) => (
            <div key={u.id || i} style={{ width: '100%', height: '100%' }}><Initial user={u} radius={radius} /></div>
          ))}
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center font-bold text-white"
          style={{ background: 'rgba(3,0,20,0.45)', fontSize: radius * 0.34 }}
        >
          +{count - 4}
        </div>
      </div>
    );
  }

  return (
    <span style={wrapperStyle} className={className}>
      {content}
    </span>
  );
}

export default React.memo(GroupAvatar);

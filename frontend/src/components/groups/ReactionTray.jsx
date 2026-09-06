import React from 'react';

/**
 * ReactionTray — the small emoji strip shown on long-press of a message.
 * Default set: ❤️ 🔥 😂 😮 😢 👍
 * One reaction per user per message (toggled server-side).
 */
const DEFAULT_REACTIONS = ['❤️', '🔥', '😂', '😮', '😢', '👍'];

function ReactionTray({ onPick, onClose }) {
  return (
    <div
      className="ultima-glass flex items-center gap-1 rounded-full px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      style={{ background: 'rgba(20,12,30,0.92)', border: '1px solid rgba(255,255,255,0.14)' }}
    >
      {DEFAULT_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform active:scale-90 hover:bg-white/10"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export default ReactionTray;
export { DEFAULT_REACTIONS };

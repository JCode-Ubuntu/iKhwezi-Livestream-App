import React, { useState, useRef } from 'react';
import { resolveMediaUrl } from '../../config/appConfig';
import ReactionTray from './ReactionTray';

/**
 * GroupMessageItem — a single message bubble.
 *
 * - Long-press (touch) or right-click (mouse) opens the reaction tray.
 * - Text is rendered via React (auto-escaped). Links are enriched by
 *   splitting on a URL regex and rendering <a> tags — no dangerouslySetInnerHTML,
 *   so XSS from message content is impossible.
 * - Image/video messages reuse the shared /storage/uploads media.
 * - Reactions are shown as a compact pill under the bubble.
 */

const URL_RE = /(https?:\/\/[^\s]+)/g;
const URL_TEST_RE = /^https?:\/\/[^\s]+$/;

function LinkifiedText({ text }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (URL_TEST_RE.test(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/40 underline-offset-2 break-all"
            >
              {part}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

function ReactionsPill({ reactions, currentUserId, onReact }) {
  if (!reactions || reactions.length === 0) return null;
  // Group by emoji, count, mark "mine".
  const byEmoji = new Map();
  for (const r of reactions) {
    const entry = byEmoji.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
    entry.count += 1;
    if (r.userId === currentUserId) entry.mine = true;
    byEmoji.set(r.emoji, entry);
  }
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {[...byEmoji.values()].map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onReact(r.emoji)}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
            r.mine ? 'bg-pink-500/25 text-white' : 'bg-white/8 text-white/70'
          }`}
        >
          <span>{r.emoji}</span>
          <span className="font-semibold">{r.count}</span>
        </button>
      ))}
    </div>
  );
}

function GroupMessageItem({ message, currentUserId, onReact }) {
  const [showTray, setShowTray] = useState(false);
  const pressTimer = useRef(null);
  const mine = message.senderId === currentUserId;

  const startPress = () => {
    pressTimer.current = setTimeout(() => setShowTray(true), 450);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const senderName = message.sender?.displayName || message.sender?.username || 'Unknown';

  const renderContent = () => {
    if (message.messageType === 'image') {
      return (
        <img
          src={resolveMediaUrl(message.mediaUrl)}
          alt={message.content || ''}
          className="max-h-60 max-w-full rounded-xl object-cover"
          loading="lazy"
        />
      );
    }
    if (message.messageType === 'video') {
      return (
        <video
          src={resolveMediaUrl(message.mediaUrl)}
          controls
          playsInline
          className="max-h-60 max-w-full rounded-xl"
        />
      );
    }
    if (message.messageType === 'system') {
      return <p className="text-center text-xs italic text-white/40">{message.content}</p>;
    }
    return <p className="whitespace-pre-wrap break-words"><LinkifiedText text={message.content || ''} /></p>;
  };

  if (message.messageType === 'system') {
    return <div className="my-2">{renderContent()}</div>;
  }

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="relative max-w-[78%]">
        <div
          onTouchStart={startPress}
          onTouchEnd={cancelPress}
          onTouchMove={cancelPress}
          onContextMenu={(e) => { e.preventDefault(); setShowTray((v) => !v); }}
          className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
            mine
              ? 'rounded-br-sm bg-gradient-to-br from-pink-500 to-[#C13584] text-white'
              : 'rounded-bl-sm bg-white/8 text-white/90 border border-white/8'
          }`}
        >
          {!mine && (
            <p className="mb-0.5 text-[11px] font-bold text-gold-300/80">{senderName}</p>
          )}
          {renderContent()}
          {message.content && message.messageType !== 'text' && (
            <p className="mt-1 whitespace-pre-wrap break-words text-xs text-white/80"><LinkifiedText text={message.content} /></p>
          )}
          <p className={`mt-1 text-[10px] ${mine ? 'text-white/60' : 'text-white/35'} text-right`}>
            {formatTime(message.createdAt)}
          </p>
        </div>

        <ReactionsPill reactions={message.reactions} currentUserId={currentUserId} onReact={(emoji) => onReact(message.id, emoji)} />

        {showTray && (
          <div className={`absolute z-20 ${mine ? 'right-0' : 'left-0'} -top-12`}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTray(false)}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/60"
              >×</button>
              <ReactionTray
                onPick={(emoji) => { onReact(message.id, emoji); setShowTray(false); }}
                onClose={() => setShowTray(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(GroupMessageItem);

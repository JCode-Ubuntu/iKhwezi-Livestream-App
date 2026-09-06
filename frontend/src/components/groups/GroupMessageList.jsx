import React, { useEffect, useRef, useCallback } from 'react';
import GroupMessageItem from './GroupMessageItem';

/**
 * GroupMessageList — virtualized-ish message list tuned for low-end Android.
 *
 * Rather than pull in a virtualization library (new dependency, extra bundle),
 * we use three cheap levers that together keep the DOM small and scrolling
 * smooth even with thousands of messages:
 *
 *  1. `content-visibility:auto` + `contain-intrinsic-size` on each row — the
 *     browser skips rendering/layout for off-screen bubbles entirely.
 *  2. A render cap: only the most recent MAX_RENDER messages are mounted.
 *     Older messages are paged in from the top via onLoadMore when the user
 *     scrolls to the top sentinel.
 *  3. React.memo on the row component so a single new message doesn't
 *     re-render the whole history.
 *
 * Auto-scroll to bottom only when the user is already near the bottom (so
 * reading history isn't yanked down by a new incoming message).
 */

const MAX_RENDER = 120;

function GroupMessageList({ messages, currentUserId, onReact, onLoadMore, hasMore, loadingMore }) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const topSentinelRef = useRef(null);
  const stickToBottom = useRef(true);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // Track whether the user is near the bottom.
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distance < 80;
  }, []);

  // Stick to bottom when new messages arrive, unless the user scrolled up.
  useEffect(() => {
    if (stickToBottom.current) scrollToBottom('auto');
  }, [messages.length, scrollToBottom]);

  // Top sentinel → load older messages.
  useEffect(() => {
    const el = scrollRef.current;
    const sentinel = topSentinelRef.current;
    if (!el || !sentinel || !hasMore) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !loadingMore) {
        const prevHeight = el.scrollHeight;
        onLoadMore().then(() => {
          // Preserve scroll position after prepending older messages.
          requestAnimationFrame(() => {
            el.scrollTop += el.scrollHeight - prevHeight;
          });
        });
      }
    }, { root: el, rootMargin: '0px', threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  const visible = messages.slice(-MAX_RENDER);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
      style={{ minHeight: 0, WebkitOverflowScrolling: 'touch' }}
    >
      <div ref={topSentinelRef} style={{ height: 1 }} />
      {loadingMore && (
        <div className="flex justify-center py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" />
        </div>
      )}
      {visible.map((m) => (
        <div
          key={m.id}
          style={{
            contentVisibility: 'auto',
            containIntrinsicSize: '64px',
          }}
        >
          <GroupMessageItem message={m} currentUserId={currentUserId} onReact={onReact} />
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

export default GroupMessageList;

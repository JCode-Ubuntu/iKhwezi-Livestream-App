import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Pause, Eye, Trash2, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Comments from './Comments';

/* ─────────────────────────────────────────────────────────────────
   StoryTray  — horizontal row of user-story bubbles
───────────────────────────────────────────────────────────────── */
export function StoryTray({ onAddStory }) {
  const { fetchWithAuth, user, isAuthenticated, isGuest } = useAuth();
  const [groups, setGroups] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/stories');
      if (res.ok) setGroups(await res.json());
    } catch {}
  }, [fetchWithAuth]);

  useEffect(() => { load(); }, [load]);

  const handleViewerClose = () => {
    setViewerIndex(null);
    load();
  };

  const myGroupIndex = groups.findIndex(g => g.user?.id === user?.id);

  return (
    <>
      <div
        className="flex gap-3 overflow-x-auto px-4 py-3"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Add-story / own story bubble */}
        {isAuthenticated && !isGuest && (
          <button
            type="button"
            onClick={myGroupIndex >= 0 ? () => setViewerIndex(myGroupIndex) : onAddStory}
            className="flex flex-shrink-0 flex-col items-center gap-1.5"
          >
            <div className="relative">
              {myGroupIndex >= 0 ? (
                <div
                  className="h-[62px] w-[62px] rounded-full p-[2.5px]"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7,#f59e0b)' }}
                >
                  <div className="h-full w-full rounded-full bg-[#050816] p-[2px]">
                    <StoryAvatar user={groups[myGroupIndex]?.user} size={52} />
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="flex h-[62px] w-[62px] items-center justify-center rounded-full border-2 border-dashed border-white/20"
                    style={{ background: 'rgba(99,102,241,0.1)' }}
                  >
                    <StoryAvatar user={user} size={52} />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-neon-indigo text-xs font-black text-white shadow-lg">
                    +
                  </div>
                </>
              )}
            </div>
            <span className="max-w-[64px] truncate text-[10px] font-semibold text-white/60">
              {myGroupIndex >= 0 ? 'Your story' : 'Add story'}
            </span>
          </button>
        )}

        {/* Other users */}
        {groups
          .filter(g => g.user?.id !== user?.id)
          .map((group) => {
            const realIndex = groups.indexOf(group);
            const allViewed = !group.hasUnviewed;
            return (
              <button
                key={group.user?.id}
                type="button"
                onClick={() => setViewerIndex(realIndex)}
                className="flex flex-shrink-0 flex-col items-center gap-1.5"
              >
                <div
                  className="h-[62px] w-[62px] rounded-full p-[2.5px]"
                  style={{
                    background: allViewed
                      ? 'rgba(255,255,255,0.2)'
                      : 'linear-gradient(135deg,#6366f1,#a855f7,#f59e0b)',
                  }}
                >
                  <div className="h-full w-full rounded-full bg-[#050816] p-[2px]">
                    <StoryAvatar user={group.user} size={52} />
                  </div>
                </div>
                <span className="max-w-[64px] truncate text-[10px] font-semibold text-white/60">
                  {group.user?.username}
                </span>
              </button>
            );
          })}
      </div>

      {viewerIndex !== null && groups[viewerIndex] && createPortal(
        <StoryViewer
          groups={groups}
          startGroupIndex={viewerIndex}
          currentUserId={user?.id}
          onClose={handleViewerClose}
          fetchWithAuth={fetchWithAuth}
          onDelete={load}
        />,
        document.body
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   StoryAvatar helper
───────────────────────────────────────────────────────────────── */
function StoryAvatar({ user, size = 44 }) {
  if (!user) return null;
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: user.avatar ? undefined : 'linear-gradient(135deg,#6F4FFF,#FFB800)',
      }}
    >
      {user.avatar
        ? <img src={user.avatar} alt="" className="h-full w-full object-cover" />
        : (user.username || '?').charAt(0).toUpperCase()}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   StoryViewer  — immersive full-screen viewer
───────────────────────────────────────────────────────────────── */
function StoryViewer({ groups, startGroupIndex, currentUserId, onClose, fetchWithAuth, onDelete }) {
  const [groupIdx, setGroupIdx] = useState(startGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const intervalRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartTime = useRef(0);
  const longPressRef = useRef(null);

  const currentGroup = groups[groupIdx];
  const currentStory = currentGroup?.stories?.[storyIdx];
  const stories = currentGroup?.stories || [];
  const isOwn = currentGroup?.user?.id === currentUserId;
  const DURATION = 5000; // 5s per image story

  // Record view
  useEffect(() => {
    if (!currentStory) return;
    fetchWithAuth(`/stories/${currentStory.id}/view`, { method: 'POST' }).catch(() => {});
  }, [currentStory?.id, fetchWithAuth]);

  const advance = useCallback((dir) => {
    clearInterval(intervalRef.current);
    setProgress(0);
    setStoryIdx(si => {
      const nextS = si + dir;
      const storyList = groups[groupIdx]?.stories || [];
      if (nextS >= 0 && nextS < storyList.length) return nextS;
      // Move to adjacent group
      const nextG = groupIdx + dir;
      if (nextG >= 0 && nextG < groups.length) {
        setTimeout(() => {
          setGroupIdx(nextG);
          setStoryIdx(dir > 0 ? 0 : (groups[nextG]?.stories?.length || 1) - 1);
        }, 0);
        return si; // will be overwritten
      }
      // No more groups
      setTimeout(onClose, 0);
      return si;
    });
  }, [groupIdx, groups, onClose]);

  // Progress auto-advance (images only)
  useEffect(() => {
    if (paused || showComments || !currentStory || currentStory.type === 'video') {
      clearInterval(intervalRef.current);
      return;
    }
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { advance(1); return 0; }
        return p + (100 / (DURATION / 100));
      });
    }, 100);
    return () => clearInterval(intervalRef.current);
  }, [paused, showComments, storyIdx, groupIdx, currentStory?.type, advance]);

  // Reset progress on story change
  useEffect(() => {
    setProgress(0);
    setShowComments(false);
  }, [storyIdx, groupIdx]);

  // Touch: long-press = pause, tap = navigate
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartTime.current = Date.now();
    longPressRef.current = setTimeout(() => setPaused(true), 180);
  };
  const onTouchEnd = (e) => {
    clearTimeout(longPressRef.current);
    const wasPaused = paused;
    setPaused(false);
    if (wasPaused) return;
    const dt = Date.now() - touchStartTime.current;
    const dx = Math.abs(e.changedTouches[0].clientX - touchStartX.current);
    if (dx < 10 && dt < 400) {
      // Short tap — navigate
      advance(e.changedTouches[0].clientX < window.innerWidth / 2 ? -1 : 1);
    }
  };

  const handleDelete = async () => {
    if (!currentStory) return;
    try {
      await fetchWithAuth(`/stories/${currentStory.id}`, { method: 'DELETE' });
      onDelete?.();
      if (stories.length <= 1) { onClose(); return; }
      advance(1);
    } catch {}
  };

  if (!currentGroup || !currentStory) return null;

  return (
    <div
      className="fixed inset-0 flex flex-col bg-black select-none"
      style={{ zIndex: 9999 }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Progress bars ── */}
      <div
        className="absolute left-0 right-0 z-20 flex gap-[3px] px-2"
        style={{ top: 'max(8px, env(safe-area-inset-top))' }}
      >
        {stories.map((_, i) => (
          <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full rounded-full bg-white"
              style={{
                width:
                  i < storyIdx ? '100%' :
                  i === storyIdx ? `${currentStory.type === 'video' ? 0 : progress}%` :
                  '0%',
                transition: i === storyIdx && !paused ? 'none' : undefined,
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Top bar: user + actions ── */}
      <div
        className="absolute left-0 right-0 z-10 flex items-center gap-3 px-4"
        style={{ top: 'max(36px, calc(env(safe-area-inset-top) + 26px))' }}
      >
        <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full border border-white/30">
          <StoryAvatar user={currentGroup.user} size={32} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white drop-shadow">@{currentGroup.user?.username}</p>
          <p className="text-[10px] text-white/55">{timeAgo(currentStory.createdAt)}</p>
        </div>
        {isOwn && (
          <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-sm">
            <Eye size={11} />
            {currentStory.viewCount || 0}
          </div>
        )}
        {isOwn && (
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-full bg-red-500/20 p-2 text-red-400 backdrop-blur-sm"
          >
            <Trash2 size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm"
        >
          <X size={17} />
        </button>
      </div>

      {/* ── Media ── */}
      <div className="flex h-full w-full items-center justify-center overflow-hidden">
        {currentStory.type === 'video' ? (
          <video
            key={currentStory.id}
            src={currentStory.url}
            className="h-full w-full object-cover"
            autoPlay
            playsInline
            onEnded={() => advance(1)}
          />
        ) : (
          <img
            key={currentStory.id}
            src={currentStory.url}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        )}
      </div>

      {/* ── Caption ── */}
      {currentStory.caption ? (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/75 to-transparent px-5 pt-10 pb-safe">
          <p className="mb-4 text-sm font-medium text-white drop-shadow">{currentStory.caption}</p>
          <button
            type="button"
            onClick={() => setShowComments(true)}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm"
          >
            <MessageCircle size={15} />
            {currentStory.commentCount || 0} Comments
          </button>
        </div>
      ) : (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/75 to-transparent px-5 pt-10 pb-safe">
          <button
            type="button"
            onClick={() => setShowComments(true)}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm"
          >
            <MessageCircle size={15} />
            {currentStory.commentCount || 0} Comments
          </button>
        </div>
      )}

      {/* ── Hold-to-pause indicator ── */}
      {paused && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="rounded-full bg-black/50 p-5 backdrop-blur-sm">
            <Pause size={30} className="text-white" fill="white" />
          </div>
        </div>
      )}

      {/* ── Group nav arrows (desktop-friendly) ── */}
      {groupIdx > 0 && (
        <button
          type="button"
          onClick={() => { setGroupIdx(g => g - 1); setStoryIdx(0); }}
          className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      {groupIdx < groups.length - 1 && (
        <button
          type="button"
          onClick={() => { setGroupIdx(g => g + 1); setStoryIdx(0); }}
          className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm"
        >
          <ChevronRight size={20} />
        </button>
      )}

      {showComments && currentStory && (
        <Comments
          resourcePath={`/stories/${currentStory.id}/comments`}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  );
}

/* ── time helper ── */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h >= 1) return `${h}h ago`;
  if (m >= 1) return `${m}m ago`;
  return 'just now';
}

export default StoryTray;
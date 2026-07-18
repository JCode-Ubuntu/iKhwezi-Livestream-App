import React, { useState } from 'react';
import { MoreHorizontal, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveMediaUrl } from '../config/appConfig';

function ReelTopOverlay({ video, visible = true, onUpdate, onShowLogin, hasActiveStory = false }) {
  const { isAuthenticated, isGuest, fetchWithAuth, showToast } = useAuth();
  const [followBusy, setFollowBusy] = useState(false);

  if (!video) return null;

  const creator = video.creator || {};
  const username = creator.username || 'unknown';
  const avatarSrc = creator.avatar ? resolveMediaUrl(creator.avatar) : null;

  const handleFollow = async (e) => {
    e.stopPropagation();
    if (!isAuthenticated || isGuest) {
      onShowLogin?.();
      return;
    }
    if (followBusy || video.isFollowing) return;
    setFollowBusy(true);
    try {
      const res = await fetchWithAuth(`/users/${creator.id}/follow`, { method: 'POST' });
      const data = await res.json();
      onUpdate?.({ ...video, isFollowing: data.following });
      showToast(data.following ? 'Following!' : 'Unfollowed', 'success');
    } catch {
      showToast('Failed to follow', 'error');
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <div
      className={`reel-overlay-chrome pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-4 ${
        visible ? '' : 'reel-overlay-chrome--hidden'
      }`}
      style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
    >
      <div className="pointer-events-auto flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="shrink-0 rounded-full p-[2px]"
            style={{
              background: hasActiveStory
                ? 'linear-gradient(135deg,#E1306C,#F5C542,#F0568F)'
                : 'transparent',
            }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#0A0A0A] text-sm font-bold text-white"
              style={{
                background: avatarSrc ? undefined : 'linear-gradient(135deg,#E1306C,#F5C542)',
              }}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                username.charAt(0).toUpperCase()
              )}
            </div>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">@{username}</p>
            <p className="truncate text-[11px] text-white/55">Suggested for you</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!video.isFollowing && (
            <button
              type="button"
              onClick={handleFollow}
              disabled={followBusy}
              className="rounded-lg border border-white/25 bg-black/35 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition active:scale-95"
            >
              <span className="flex items-center gap-1">
                <UserPlus size={12} />
                Follow
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm"
            aria-label="More options"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ReelTopOverlay);

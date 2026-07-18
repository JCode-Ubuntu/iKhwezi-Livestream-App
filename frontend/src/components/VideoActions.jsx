import React, { useState, useEffect, useRef } from 'react';
import {
  Heart, MessageCircle, Share2, Repeat2, Bookmark,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/** Spec order: Like → Comment → Share → Repost → Save */
function VideoActions({ video, onUpdate, onShowComments, onShowLogin, visible = true }) {
  const { isAuthenticated, isGuest, fetchWithAuth, showToast } = useAuth();
  const [isAnimating, setIsAnimating] = useState(null);
  const animTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(animTimerRef.current), []);

  const pulse = (id) => {
    setIsAnimating(id);
    clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => setIsAnimating(null), 300);
  };

  const requireAccount = () => {
    if (!isAuthenticated || isGuest) {
      onShowLogin?.();
      return true;
    }
    return false;
  };

  const handleLike = async () => {
    if (requireAccount()) return;
    pulse('like');
    try {
      const res = await fetchWithAuth(`/videos/${video.id}/like`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdate?.({ ...video, isLiked: data.liked, likeCount: data.likeCount });
    } catch {
      showToast('Failed to like', 'error');
    }
  };

  const handleShare = async () => {
    pulse('share');
    try {
      if (navigator.share) {
        await navigator.share({
          title: video.title || 'Check out this video on iKHWEZI',
          text: video.description || 'Amazing content on iKHWEZI',
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Link copied!', 'success');
      }
    } catch (err) {
      if (err.name !== 'AbortError') showToast('Failed to share', 'error');
    }
  };

  const handleRepost = async () => {
    if (requireAccount()) return;
    pulse('repost');
    try {
      const res = await fetchWithAuth(`/videos/${video.id}/repost`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdate?.({ ...video, isReposted: data.reposted, repostCount: data.repostCount });
      showToast(data.reposted ? 'Reposted' : 'Repost removed', 'success');
    } catch {
      showToast('Failed to repost', 'error');
    }
  };

  const handleSave = async () => {
    if (requireAccount()) return;
    pulse('save');
    try {
      const res = await fetchWithAuth(`/videos/${video.id}/save`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdate?.({ ...video, isSaved: data.saved });
      showToast(data.saved ? 'Saved' : 'Removed from saved', 'success');
    } catch {
      showToast('Failed to save', 'error');
    }
  };

  const formatCount = (count) => {
    if (!count) return '0';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const actions = [
    {
      id: 'like',
      icon: Heart,
      count: video.likeCount,
      active: video.isLiked,
      onClick: handleLike,
      activeColor: '#E1306C',
      fill: video.isLiked,
    },
    {
      id: 'comment',
      icon: MessageCircle,
      count: video.commentCount,
      onClick: () => onShowComments?.(),
    },
    {
      id: 'share',
      icon: Share2,
      onClick: handleShare,
    },
    {
      id: 'repost',
      icon: Repeat2,
      count: video.repostCount,
      active: video.isReposted,
      onClick: handleRepost,
      activeColor: '#10B981',
    },
    {
      id: 'save',
      icon: Bookmark,
      active: video.isSaved,
      onClick: handleSave,
      activeColor: '#F5C542',
      fill: video.isSaved,
    },
  ];

  return (
    <div
      className={`reel-overlay-chrome absolute right-3 z-10 flex flex-col items-center gap-4 ${
        visible ? '' : 'reel-overlay-chrome--hidden'
      }`}
      style={{ bottom: 'calc(8.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
            className="flex flex-col items-center gap-1 border-none bg-transparent p-0 transition-transform duration-200"
            style={{ transform: isAnimating === action.id ? 'scale(1.2)' : 'scale(1)' }}
            aria-label={action.id}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                boxShadow: action.active ? `0 0 20px ${action.activeColor}40` : 'none',
              }}
            >
              <Icon
                size={22}
                color={action.active ? action.activeColor : '#E0E0E0'}
                fill={action.fill ? action.activeColor : 'none'}
                strokeWidth={2}
              />
            </div>
            {action.count !== undefined && (
              <span
                className="text-xs font-semibold"
                style={{
                  color: action.active ? action.activeColor : '#E0E0E0',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
                }}
              >
                {formatCount(action.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default React.memo(VideoActions);

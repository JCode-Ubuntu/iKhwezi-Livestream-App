import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, Star, UserPlus, UserCheck, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function VideoActions({ video, onUpdate, onShowComments, onShowLogin }) {
  const { isAuthenticated, fetchWithAuth, showToast } = useAuth();
  const [isAnimating, setIsAnimating] = useState(null);

  const handleLike = async () => {
    if (!isAuthenticated) {
      onShowLogin?.();
      return;
    }

    setIsAnimating('like');
    setTimeout(() => setIsAnimating(null), 300);

    try {
      const res = await fetchWithAuth(`/videos/${video.id}/like`, { method: 'POST' });
      const data = await res.json();
      onUpdate?.({ ...video, isLiked: data.liked, likeCount: data.likeCount });
    } catch (err) {
      showToast('Failed to like', 'error');
    }
  };

  const handleStar = async () => {
    if (!isAuthenticated) {
      onShowLogin?.();
      return;
    }

    if (video.hasStarred) {
      showToast('Already starred this video', 'error');
      return;
    }

    setIsAnimating('star');
    setTimeout(() => setIsAnimating(null), 500);

    try {
      const res = await fetchWithAuth(`/videos/${video.id}/star`, {
        method: 'POST',
        body: JSON.stringify({ amount: 1 }),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdate?.({ ...video, hasStarred: true, starCount: data.starCount });
        showToast(`⭐ +10 points to creator!`, 'success');
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Failed to star', 'error');
    }
  };

  const handleFollow = async () => {
    if (!isAuthenticated) {
      onShowLogin?.();
      return;
    }

    setIsAnimating('follow');
    setTimeout(() => setIsAnimating(null), 300);

    try {
      const res = await fetchWithAuth(`/users/${video.creator?.id}/follow`, { method: 'POST' });
      const data = await res.json();
      onUpdate?.({ ...video, isFollowing: data.following });
      showToast(data.following ? 'Following!' : 'Unfollowed', 'success');
    } catch (err) {
      showToast('Failed to follow', 'error');
    }
  };

  const handleShare = async () => {
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
      if (err.name !== 'AbortError') {
        showToast('Failed to share', 'error');
      }
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
      id: 'star',
      icon: Star,
      count: video.starCount,
      active: video.hasStarred,
      onClick: handleStar,
      activeColor: '#FFB800',
      fill: video.hasStarred,
    },
    {
      id: 'like',
      icon: Heart,
      count: video.likeCount,
      active: video.isLiked,
      onClick: handleLike,
      activeColor: '#EF4444',
      fill: video.isLiked,
    },
    {
      id: 'comment',
      icon: MessageCircle,
      count: video.commentCount,
      onClick: () => {
        if (!isAuthenticated) {
          onShowLogin?.();
          return;
        }
        onShowComments?.();
      },
    },
    {
      id: 'share',
      icon: Share2,
      onClick: handleShare,
    },
  ];

  return (
    <div style={{
      position: 'absolute',
      right: 12,
      bottom: 140,
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      alignItems: 'center',
      zIndex: 10,
    }}>
      <div 
        onClick={handleFollow}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6F4FFF, #FFB800)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 700,
          color: 'white',
          boxShadow: '0 4px 20px rgba(111, 79, 255, 0.4)',
          overflow: 'hidden',
          position: 'relative',
          transform: isAnimating === 'follow' ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.2s ease',
        }}>
          {video.creator?.avatar ? (
            <img src={video.creator.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            video.creator?.username?.charAt(0).toUpperCase() || '?'
          )}
        </div>
        <div style={{
          position: 'absolute',
          top: 36,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: video.isFollowing ? '#10B981' : '#6F4FFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid #0D0F1A',
        }}>
          {video.isFollowing ? (
            <UserCheck size={10} color="white" />
          ) : (
            <UserPlus size={10} color="white" />
          )}
        </div>
      </div>

      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={action.onClick}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transform: isAnimating === action.id ? 'scale(1.2)' : 'scale(1)',
              transition: 'transform 0.2s ease',
            }}
          >
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: action.active ? `0 0 20px ${action.activeColor}40` : 'none',
            }}>
              <Icon 
                size={22} 
                color={action.active ? action.activeColor : '#E0E0E0'}
                fill={action.fill ? action.activeColor : 'none'}
                strokeWidth={2}
              />
            </div>
            {action.count !== undefined && (
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: action.active ? action.activeColor : '#E0E0E0',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
              }}>
                {formatCount(action.count)}
              </span>
            )}
          </button>
        );
      })}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        color: '#A0A0A0',
        fontSize: 12,
        marginTop: 8,
      }}>
        <Eye size={14} />
        <span>{formatCount(video.views)}</span>
      </div>
    </div>
  );
}

export default React.memo(VideoActions);

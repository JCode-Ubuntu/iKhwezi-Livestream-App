import React, { useState } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveMediaUrl } from '../../config/appConfig';

function TextPostCard({ post, onOpenAuthor, tall, onGuestBlock, compact = false }) {
  const { fetchWithAuth, isAuthenticated, isGuest, trackGuestInteraction } = useAuth();
  const [liked, setLiked] = useState(!!post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [busy, setBusy] = useState(false);

  const fontClass = post.fontStyle === 'bold' ? 'font-black' : post.fontStyle === 'italic' ? 'italic' : 'font-medium';

  const toggleLike = async (e) => {
    e.stopPropagation();
    if (!isAuthenticated || isGuest) {
      trackGuestInteraction?.();
      onGuestBlock?.();
      return;
    }
    if (busy) return;
    setBusy(true);
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => c + (nextLiked ? 1 : -1));
    try {
      const res = await fetchWithAuth(`/posts/${post.id}/like`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikeCount(data.likeCount);
      } else {
        setLiked(!nextLiked);
        setLikeCount((c) => c + (nextLiked ? -1 : 1));
      }
    } catch {
      setLiked(!nextLiked);
      setLikeCount((c) => c + (nextLiked ? -1 : 1));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`ultima-bento-card ultima-glass-supreme group relative flex w-full flex-col justify-between overflow-hidden text-left ${
        compact
          ? `home-masonry-tile rounded-[16px] p-2.5 ${tall ? 'home-masonry-tile--tall' : 'home-masonry-tile--short'}`
          : 'rounded-[26px] p-4'
      }`}
      style={
        compact
          ? { background: `linear-gradient(155deg, ${post.backgroundColor || '#1a1a2e'} 0%, rgba(10,10,10,0.92) 100%)` }
          : {
              height: tall ? 280 : 220,
              background: `linear-gradient(155deg, ${post.backgroundColor || '#1a1a2e'} 0%, rgba(10,10,10,0.92) 100%)`,
            }
      }
    >
      {!compact && (
        <button
          type="button"
          onClick={() => onOpenAuthor?.(post.author?.id)}
          className="flex items-center gap-2 text-left"
        >
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold text-white"
            style={{ background: post.author?.avatar ? undefined : 'linear-gradient(135deg,#E1306C,#F5C542)' }}
          >
            {post.author?.avatar ? (
              <img src={resolveMediaUrl(post.author.avatar)} alt="" className="h-full w-full object-cover" />
            ) : (
              (post.author?.username || '?').charAt(0).toUpperCase()
            )}
          </div>
          <p className="truncate text-[11px] font-semibold text-white/85">@{post.author?.username || 'unknown'}</p>
        </button>
      )}

      <p
        className={`line-clamp-5 flex-1 leading-snug ${fontClass} ${
          compact ? 'py-1 text-[11px]' : 'py-2 text-[15px]'
        }`}
        style={{ color: post.textColor || '#ffffff' }}
      >
        {post.content}
      </p>

      {!compact && (
        <div className="flex items-center gap-3 text-[11px] text-white/60">
          <button type="button" onClick={toggleLike} className="ik-btn-bouncy flex items-center gap-1">
            <Heart size={13} className={liked ? 'fill-pink-500 text-pink-500' : ''} />
            {likeCount}
          </button>
          <span className="flex items-center gap-1">
            <MessageCircle size={13} />
            {post.commentCount || 0}
          </span>
        </div>
      )}
    </div>
  );
}

export default TextPostCard;

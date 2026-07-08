import React, { useState } from 'react'
import { Heart, MessageCircle, Share2, MoreVertical } from 'lucide-react'
import { colors, spacing, transitions } from '@/design-system'

/**
 * Premium Post Card Component
 * 
 * Instagram-style post with:
 * - Smooth like animation with heart explosion
 * - Hover effects and interactions
 * - Creator info with avatar
 * - Like/comment/share actions
 * - Description with read more
 */

const PremiumPostCard = ({ 
  post, 
  creator,
  image,
  description,
  onLike, 
  likeCount: initialLikeCount = 0,
  isLiked: initialIsLiked = false
}) => {
  // Support both post object and individual props
  const postData = post || {
    id: Math.random(),
    creator: creator || { displayName: 'Creator', username: 'creator', avatar: null, verified: false },
    image,
    description,
    likeCount: initialLikeCount,
    isLiked: initialIsLiked
  }

  const [isLiked, setIsLiked] = useState(initialIsLiked || false)
  const [likeCount, setLikeCount] = useState(postData.likeCount || initialLikeCount || 0)
  const [showHeartExplosion, setShowHeartExplosion] = useState(false)
  const [commentCount] = useState(Math.floor(Math.random() * 100))
  const [shareCount] = useState(Math.floor(Math.random() * 50))

  const handleLike = () => {
    if (!isLiked) {
      setIsLiked(true)
      setLikeCount(likeCount + 1)
      setShowHeartExplosion(true)
      onLike?.(postData.id)
      setTimeout(() => setShowHeartExplosion(false), 600)
    } else {
      setIsLiked(false)
      setLikeCount(likeCount - 1)
    }
  }

  const formatDate = (date) => {
    if (!date) return '...'
    const now = new Date()
    const posted = new Date(date)
    const diff = Math.floor((now - posted) / 1000)

    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div
      style={{
        background: colors.dark.surface.secondary,
        border: `1px solid ${colors.neutral[800]}`,
        borderRadius: '1rem',
        overflow: 'hidden',
        marginBottom: spacing.lg,
        boxShadow: `0 4px 12px rgba(0, 0, 0, 0.2)`,
        transition: `all ${transitions.duration.normal} ${transitions.easing.out}`,
        ':hover': {
          boxShadow: `0 8px 24px rgba(0, 0, 0, 0.3)`,
        },
      }}
    >
      {/* Header - Creator Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing.lg,
          borderBottom: `1px solid ${colors.neutral[800]}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          {/* Avatar */}
          <img
            src={postData.creator?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${postData.creator?.username}`}
            alt={postData.creator?.displayName || 'Creator'}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: `2px solid ${colors.primary[500]}`,
            }}
          />

          {/* Creator Details */}
          <div>
            <p
              style={{
                ...{ fontSize: '0.95rem', fontWeight: 600, color: colors.dark.text.primary, margin: 0 },
              }}
            >
              {postData.creator?.displayName || postData.creator?.username || 'Creator'}
            </p>
            <p
              style={{
                fontSize: '0.8rem',
                color: colors.dark.text.tertiary,
                margin: '2px 0 0 0',
              }}
            >
              {formatDate(postData.createdAt)}
            </p>
          </div>
        </div>

        {/* Menu */}
        <button
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.dark.text.secondary,
            cursor: 'pointer',
            padding: spacing.sm,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: `color ${transitions.duration.fast} ${transitions.easing.out}`,
          }}
          onMouseEnter={(e) => (e.target.style.color = colors.primary[500])}
          onMouseLeave={(e) => (e.target.style.color = colors.dark.text.secondary)}
        >
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Image */}
      {postData.filename && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            paddingBottom: '100%',
            background: postData.filename === 'placeholder.jpg' 
              ? `linear-gradient(135deg, ${colors.primary[900]} 0%, ${colors.neutral[900]} 50%, ${colors.accent[950]} 100%)`
              : colors.dark.surface.tertiary,
            overflow: 'hidden',
          }}
        >
          {postData.filename !== 'placeholder.jpg' && (
            <img
              src={postData.filename}
              alt={postData.title || 'Post'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          )}
          {postData.filename === 'placeholder.jpg' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: colors.neutral[600],
              fontSize: '14px',
            }}>
              <span style={{ fontSize: '32px', opacity: 0.4 }}>📷</span>
              <span style={{ opacity: 0.5 }}>{postData.title || 'Post'}</span>
            </div>
          )}

          {/* Heart Explosion Animation */}
          {showHeartExplosion && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {[...Array(5)].map((_, i) => (
                <Heart
                  key={i}
                  size={32}
                  fill={colors.error[500]}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    color: colors.error[500],
                    transform: `translate(-50%, -50%)`,
                    animation: `heartExplode ${transitions.duration.slowest}ms ease-out forwards`,
                    animationDelay: `${i * 20}ms`,
                  }}
                />
              ))}

              <style>{`
                @keyframes heartExplode {
                  0% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                  }
                  100% {
                    opacity: 0;
                    transform: translate(calc(-50% + ${(Math.random() - 0.5) * 200}px), calc(-50% - 200px)) scale(0.2);
                  }
                }
              `}</style>
            </div>
          )}
        </div>
      )}

      {/* Actions - Like/Comment/Share */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.lg,
          padding: spacing.lg,
          borderBottom: `1px solid ${colors.neutral[800]}`,
        }}
      >
        <button
          onClick={handleLike}
          style={{
            background: 'transparent',
            border: 'none',
            color: isLiked ? colors.error[500] : colors.dark.text.secondary,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xs,
            fontSize: '0.9rem',
            fontWeight: 600,
            transition: `all ${transitions.duration.fast} ${transitions.easing.out}`,
            transform: isLiked ? 'scale(1.2)' : 'scale(1)',
          }}
          onMouseEnter={(e) => {
            if (!isLiked) e.currentTarget.style.color = colors.primary[500]
          }}
          onMouseLeave={(e) => {
            if (!isLiked) e.currentTarget.style.color = colors.dark.text.secondary
          }}
        >
          <Heart
            size={20}
            fill={isLiked ? colors.error[500] : 'none'}
            style={{ transition: `all ${transitions.duration.fast} ${transitions.easing.out}` }}
          />
          {likeCount}
        </button>

        <button
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.dark.text.secondary,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xs,
            fontSize: '0.9rem',
            fontWeight: 600,
            transition: `color ${transitions.duration.fast} ${transitions.easing.out}`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = colors.primary[500])}
          onMouseLeave={(e) => (e.currentTarget.style.color = colors.dark.text.secondary)}
        >
          <MessageCircle size={20} />
          {commentCount}
        </button>

        <button
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.dark.text.secondary,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xs,
            fontSize: '0.9rem',
            fontWeight: 600,
            transition: `color ${transitions.duration.fast} ${transitions.easing.out}`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = colors.primary[500])}
          onMouseLeave={(e) => (e.currentTarget.style.color = colors.dark.text.secondary)}
        >
          <Share2 size={20} />
          {shareCount}
        </button>
      </div>

      {/* Like Count Display */}
      <div
        style={{
          padding: `0 ${spacing.lg} ${spacing.md} ${spacing.lg}`,
          fontSize: '0.9rem',
          fontWeight: 600,
          color: colors.dark.text.secondary,
        }}
      >
        {likeCount.toLocaleString()} likes
      </div>

      {/* Caption */}
      {postData.description && (
        <div
          style={{
            padding: `0 ${spacing.lg} ${spacing.lg} ${spacing.lg}`,
            fontSize: '0.95rem',
            lineHeight: '1.5',
            color: colors.dark.text.primary,
          }}
        >
          <span style={{ fontWeight: 600, marginRight: spacing.xs }}>
            {postData.creator?.displayName || postData.creator?.username}
          </span>
          {postData.description}
        </div>
      )}
    </div>
  )
}

export default PremiumPostCard

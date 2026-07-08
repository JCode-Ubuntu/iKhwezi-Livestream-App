import React from 'react'
import { colors, spacing, typography, transitions } from '@/design-system'

/**
 * Premium Avatar Component
 * 
 * Displays user profile pictures with:
 * - Online indicator
 * - Verified badge
 * - Initials fallback
 * - Multiple sizes
 * - Status indicators
 */

const Avatar = React.forwardRef(({
  src,
  alt = 'User Avatar',
  initials,
  size = 'md',
  online = false,
  verified = false,
  status = null, // 'online', 'offline', 'away', 'dnd'
  badge = null, // Custom badge element
  onClick,
  className = '',
  ...props
}, ref) => {
  const sizeMap = {
    xs: 32,
    sm: 40,
    md: 48,
    lg: 64,
    xl: 80,
    '2xl': 96,
  }

  const size_px = sizeMap[size]
  const statusSize = size_px / 3.5
  const verifiedSize = size_px / 3

  const statusColors = {
    online: colors.success[500],
    offline: colors.neutral[500],
    away: colors.warning[500],
    dnd: colors.error[500],
  }

  const baseStyles = {
    position: 'relative',
    width: size_px,
    height: size_px,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: onClick ? 'pointer' : 'default',
    transition: `all ${transitions.duration.fast} ${transitions.easing.out}`,
    flexShrink: 0,
  }

  const imageStyles = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  }

  const fallbackStyles = {
    width: '100%',
    height: '100%',
    background: colors.gradients.premium,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...typography.styles.titleM,
    color: colors.dark.text.primary,
    fontWeight: 700,
  }

  const [isLoaded, setIsLoaded] = React.useState(!!src)
  const [imgError, setImgError] = React.useState(false)

  return (
    <div
      ref={ref}
      style={baseStyles}
      onClick={onClick}
      className={`ikhwezi-avatar ikhwezi-avatar--${size} ${className}`}
      {...props}
    >
      {/* Avatar Image or Initials Fallback */}
      {src && !imgError ? (
        <img
          src={src}
          alt={alt}
          style={imageStyles}
          onLoad={() => setIsLoaded(true)}
          onError={() => setImgError(true)}
        />
      ) : (
        <div style={fallbackStyles}>
          {initials || alt.charAt(0)}
        </div>
      )}

      {/* Border Ring */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `2px solid ${colors.neutral[800]}`,
          pointerEvents: 'none',
        }}
      />

      {/* Online Indicator */}
      {online && (
        <div
          style={{
            position: 'absolute',
            bottom: '-2px',
            right: '-2px',
            width: statusSize,
            height: statusSize,
            borderRadius: '50%',
            background: colors.success[500],
            border: `3px solid ${colors.dark.surface.primary}`,
            boxShadow: `0 0 0 2px ${colors.neutral[800]}`,
            animation: `pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
          }}
        />
      )}

      {/* Status Indicator */}
      {status && !online && (
        <div
          style={{
            position: 'absolute',
            bottom: '0',
            right: '0',
            width: statusSize,
            height: statusSize,
            borderRadius: '50%',
            background: statusColors[status] || colors.neutral[500],
            border: `3px solid ${colors.dark.surface.primary}`,
            boxShadow: status === 'dnd' ? `0 0 8px ${colors.error[600]}` : 'none',
          }}
        />
      )}

      {/* Verified Badge */}
      {verified && (
        <div
          style={{
            position: 'absolute',
            bottom: '-4px',
            left: '-4px',
            width: verifiedSize,
            height: verifiedSize,
            borderRadius: '50%',
            background: colors.info[500],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${colors.dark.surface.primary}`,
            fontSize: verifiedSize * 0.6,
            color: colors.dark.text.primary,
            fontWeight: 700,
          }}
        >
          ✓
        </div>
      )}

      {/* Custom Badge */}
      {badge && (
        <div
          style={{
            position: 'absolute',
            bottom: '-4px',
            right: '-4px',
          }}
        >
          {badge}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  )
})

Avatar.displayName = 'Avatar'

/**
 * AvatarGroup - Display multiple avatars in a compact group
 */
export const AvatarGroup = ({ avatars, maxDisplay = 3, size = 'md', className = '', ...props }) => {
  const displayAvatars = avatars.slice(0, maxDisplay)
  const remaining = Math.max(0, avatars.length - maxDisplay)

  const sizeMap = {
    xs: 32,
    sm: 40,
    md: 48,
    lg: 64,
    xl: 80,
    '2xl': 96,
  }

  const size_px = sizeMap[size]
  const overlap = size_px * 0.35

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: -overlap,
      }}
      className={`ikhwezi-avatar-group ${className}`}
      {...props}
    >
      {displayAvatars.map((avatar, idx) => (
        <div
          key={idx}
          style={{
            zIndex: displayAvatars.length - idx,
            filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2))',
          }}
        >
          <Avatar
            size={size}
            src={avatar.src}
            initials={avatar.initials}
            alt={avatar.alt}
            verified={avatar.verified}
            online={avatar.online}
          />
        </div>
      ))}

      {remaining > 0 && (
        <div
          style={{
            width: size_px,
            height: size_px,
            borderRadius: '50%',
            background: colors.gradients.premium,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...typography.styles.labelM,
            color: colors.dark.text.primary,
            fontWeight: 700,
            border: `2px solid ${colors.neutral[800]}`,
          }}
        >
          +{remaining}
        </div>
      )}
    </div>
  )
}

export default Avatar

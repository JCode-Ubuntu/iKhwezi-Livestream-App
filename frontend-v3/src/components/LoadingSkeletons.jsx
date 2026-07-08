import React from 'react'
import { colors, spacing, transitions } from '@/design-system'

/**
 * Premium Loading Skeleton Components
 * 
 * Used for placeholder loading states with shimmer animation
 * Supports: text, avatar, card, image, etc.
 */

const SkeletonBase = ({ className = '', ...props }) => (
  <div
    style={{
      background: `linear-gradient(
        90deg,
        ${colors.neutral[800]} 0%,
        ${colors.neutral[700]} 50%,
        ${colors.neutral[800]} 100%
      )`,
      backgroundSize: '200% 100%',
      animation: `shimmer 2s infinite`,
      borderRadius: '0.5rem',
    }}
    className={`ikhwezi-skeleton ${className}`}
    {...props}
  >
    <style>{`
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  </div>
)

/**
 * SkeletonText - Single line of text
 */
export const SkeletonText = ({ width = '100%', height = '1rem', className = '' }) => (
  <SkeletonBase
    style={{ width, height }}
    className={className}
  />
)

/**
 * SkeletonParagraph - Multiple lines of text
 */
export const SkeletonParagraph = ({ lines = 3, className = '' }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.sm,
    }}
    className={className}
  >
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonText
        key={i}
        width={i === lines - 1 ? '85%' : '100%'}
        height={i === 0 ? '1.5rem' : '1rem'}
      />
    ))}
  </div>
)

/**
 * SkeletonAvatar - Circular avatar placeholder
 */
export const SkeletonAvatar = ({ size = 'md', className = '' }) => {
  const sizeMap = {
    xs: 32,
    sm: 40,
    md: 48,
    lg: 64,
    xl: 80,
    '2xl': 96,
  }

  const size_px = sizeMap[size]

  return (
    <SkeletonBase
      style={{
        width: size_px,
        height: size_px,
        borderRadius: '50%',
      }}
      className={className}
    />
  )
}

/**
 * SkeletonCard - Skeleton for a card component
 */
export const SkeletonCard = ({ className = '' }) => (
  <div
    style={{
      padding: spacing.lg,
      borderRadius: '1rem',
      background: colors.dark.surface.secondary,
      border: `1px solid ${colors.neutral[800]}`,
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.md,
    }}
    className={className}
  >
    {/* Header */}
    <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
      <SkeletonAvatar size="md" />
      <div style={{ flex: 1 }}>
        <SkeletonText height="1rem" width="60%" />
        <SkeletonText height="0.75rem" width="40%" style={{ marginTop: spacing.xs }} />
      </div>
    </div>

    {/* Content */}
    <div style={{ gap: spacing.sm, display: 'flex', flexDirection: 'column' }}>
      <SkeletonText height="1.5rem" />
      <SkeletonText height="1rem" width="90%" />
      <SkeletonText height="1rem" width="75%" />
    </div>

    {/* Footer */}
    <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing.md }}>
      <SkeletonText height="2.5rem" width="40%" style={{ borderRadius: '0.75rem' }} />
      <SkeletonText height="2.5rem" width="40%" style={{ borderRadius: '0.75rem' }} />
    </div>
  </div>
)

/**
 * SkeletonImage - Placeholder for images
 */
export const SkeletonImage = ({ width = '100%', height = '200px', className = '' }) => (
  <SkeletonBase
    style={{
      width,
      height,
      borderRadius: '0.75rem',
    }}
    className={className}
  />
)

/**
 * SkeletonPostCard - Skeleton for feed post card
 */
export const SkeletonPostCard = ({ className = '' }) => (
  <div
    style={{
      padding: spacing.lg,
      borderRadius: '1rem',
      background: colors.dark.surface.secondary,
      border: `1px solid ${colors.neutral[800]}`,
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.md,
    }}
    className={className}
  >
    {/* Header - Author */}
    <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
      <SkeletonAvatar size="md" />
      <div style={{ flex: 1 }}>
        <SkeletonText height="1rem" width="50%" />
        <SkeletonText height="0.75rem" width="35%" style={{ marginTop: spacing.xs }} />
      </div>
    </div>

    {/* Image */}
    <SkeletonImage height="250px" />

    {/* Stats */}
    <div style={{ display: 'flex', gap: spacing.xl }}>
      <SkeletonText height="0.875rem" width="15%" />
      <SkeletonText height="0.875rem" width="15%" />
      <SkeletonText height="0.875rem" width="15%" />
    </div>

    {/* Caption */}
    <div>
      <SkeletonText height="1rem" width="100%" />
      <SkeletonText height="1rem" width="90%" style={{ marginTop: spacing.xs }} />
    </div>
  </div>
)

/**
 * SkeletonFeed - Multiple post skeletons for feed loading
 */
export const SkeletonFeed = ({ count = 3, className = '' }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.lg,
    }}
    className={className}
  >
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonPostCard key={i} />
    ))}
  </div>
)

export default SkeletonBase

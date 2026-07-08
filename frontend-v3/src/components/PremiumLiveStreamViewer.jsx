import React, { useState, useEffect } from 'react'
import { Play, Square, Eye, Users, Clock } from 'lucide-react'
import { colors, spacing, typography, transitions } from '@/design-system'
import Badge from './Badge'

/**
 * Premium Live Stream Viewer Component
 * 
 * Displays:
 * - Live video stream area (placeholder or HLS player)
 * - Real-time viewer count with animation
 * - Live duration timer
 * - Viewer list with avatars
 * - Comments/reactions (upcoming)
 */

const PremiumLiveStreamViewer = ({ isLive = true, streamKey, viewerCount = 1247, liveStartTime = null }) => {
  const [viewers, setViewers] = useState(viewerCount)
  const [liveTime, setLiveTime] = useState('00:00:00')
  const [isAnimatingViewerChange, setIsAnimatingViewerChange] = useState(false)

  useEffect(() => {
    setViewers(viewerCount)
  }, [viewerCount])

  useEffect(() => {
    if (!liveStartTime) return

    const interval = setInterval(() => {
      const now = new Date()
      const elapsed = Math.floor((now - new Date(liveStartTime)) / 1000)

      const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0')
      const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
      const seconds = String(elapsed % 60).padStart(2, '0')

      setLiveTime(`${hours}:${minutes}:${seconds}`)
    }, 1000)

    return () => clearInterval(interval)
  }, [liveStartTime])

  const simulateViewerChange = () => {
    setIsAnimatingViewerChange(true)
    const newCount = viewers + Math.floor(Math.random() * 20) - 5
    setViewers(Math.max(1, newCount))
    setTimeout(() => setIsAnimatingViewerChange(false), 300)
  }

  return (
    <div
      style={{
        background: colors.dark.surface.primary,
        borderRadius: '1rem',
        overflow: 'hidden',
        boxShadow: `0 20px 40px rgba(0, 0, 0, 0.4)`,
      }}
    >
      {/* Video Stream Area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '56.25%', // 16:9 aspect ratio
          background: colors.dark.surface.tertiary,
          overflow: 'hidden',
        }}
      >
        {/* HLS Player Placeholder */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${colors.dark.surface.tertiary} 0%, ${colors.neutral[900]} 100%)`,
            flexDirection: 'column',
            gap: spacing.md,
            color: colors.dark.text.secondary,
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: colors.primary[600],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: `pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
            }}
          >
            <Play fill={colors.dark.text.primary} color={colors.dark.text.primary} size={40} />
          </div>
          <p style={{ ...typography.styles.titleM, margin: 0 }}>Live Stream</p>
          <p style={{ ...typography.styles.bodyS, margin: 0 }}>HLS Stream Loading...</p>
        </div>

        {/* Live Badge - Top Left */}
        {isLive && (
          <div
            style={{
              position: 'absolute',
              top: spacing.lg,
              left: spacing.lg,
              display: 'flex',
              gap: spacing.md,
              alignItems: 'center',
              zIndex: 10,
            }}
          >
            <Badge variant="live" animated>
              LIVE
            </Badge>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                background: 'rgba(0, 0, 0, 0.6)',
                padding: `${spacing.xs} ${spacing.md}`,
                borderRadius: '0.5rem',
                ...typography.styles.labelM,
                color: colors.dark.text.primary,
              }}
            >
              <Clock size={16} />
              {liveTime}
            </div>
          </div>
        )}

        {/* Viewer Count - Top Right */}
        <div
          style={{
            position: 'absolute',
            top: spacing.lg,
            right: spacing.lg,
            display: 'flex',
            alignItems: 'center',
            gap: spacing.md,
            background: 'rgba(0, 0, 0, 0.6)',
            padding: `${spacing.sm} ${spacing.lg}`,
            borderRadius: '2rem',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${colors.neutral[700]}`,
            zIndex: 10,
            cursor: 'pointer',
            transition: `all ${transitions.duration.fast} ${transitions.easing.out}`,
          }}
          onClick={simulateViewerChange}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)'
            e.currentTarget.style.transform = 'scale(1.05)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          <Eye size={18} style={{ color: colors.primary[500] }} />
          <span
            style={{
              ...typography.styles.labelL,
              color: colors.dark.text.primary,
              fontWeight: 700,
              transform: isAnimatingViewerChange ? 'scale(1.1)' : 'scale(1)',
              transition: `transform ${transitions.duration.fast} ${transitions.easing.out}`,
            }}
          >
            {viewers.toLocaleString()}
          </span>
        </div>

        {/* Gradient Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 60%, rgba(0,0,0,0.2) 100%)',
            pointerEvents: 'none',
          }}
        />

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}</style>
      </div>

      {/* Stream Info */}
      <div
        style={{
          padding: spacing.lg,
          borderTop: `1px solid ${colors.neutral[800]}`,
        }}
      >
        {/* Title */}
        <h2
          style={{
            ...typography.styles.headlineM,
            margin: `0 0 ${spacing.md} 0`,
            color: colors.dark.text.primary,
          }}
        >
          IKHWEZI Live Broadcast
        </h2>

        {/* Description */}
        <p
          style={{
            ...typography.styles.bodyM,
            color: colors.dark.text.secondary,
            margin: `0 0 ${spacing.lg} 0`,
          }}
        >
          Join us for an exciting live session featuring creator stories, tips, and community engagement.
        </p>

        {/* Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: spacing.lg,
          }}
        >
          {/* Stat Card */}
          {[
            { icon: Eye, label: 'Viewers', value: viewers.toLocaleString() },
            { icon: Users, label: 'Following', value: '2.3K' },
            { icon: Play, label: 'Duration', value: liveTime },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                textAlign: 'center',
                padding: spacing.md,
                background: colors.dark.surface.secondary,
                borderRadius: '0.75rem',
                border: `1px solid ${colors.neutral[800]}`,
                transition: `all ${transitions.duration.fast} ${transitions.easing.out}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.primary[500]
                e.currentTarget.style.background = colors.dark.surface.tertiary
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.neutral[800]
                e.currentTarget.style.background = colors.dark.surface.secondary
              }}
            >
              <stat.icon
                size={24}
                style={{
                  color: colors.primary[500],
                  marginBottom: spacing.xs,
                }}
              />
              <p
                style={{
                  ...typography.styles.labelS,
                  color: colors.dark.text.tertiary,
                  margin: `0 0 ${spacing.xs} 0`,
                }}
              >
                {stat.label}
              </p>
              <p
                style={{
                  ...typography.styles.titleM,
                  color: colors.dark.text.primary,
                  margin: 0,
                }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PremiumLiveStreamViewer

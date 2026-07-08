import React from 'react'
import { colors, spacing, typography, transitions } from '@/design-system'

/**
 * Premium Badge Component
 * 
 * Variants: primary, success, warning, error, info, verified, live
 * Sizes: sm, md, lg
 * Shapes: pill, square, dot
 */

const Badge = React.forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  shape = 'pill',
  icon: Icon,
  animated = false,
  className = '',
  ...props
}, ref) => {
  const variantConfig = {
    primary: {
      bg: colors.primary[600],
      text: colors.dark.text.primary,
      border: colors.primary[500],
    },
    success: {
      bg: colors.success[600],
      text: colors.dark.text.primary,
      border: colors.success[500],
    },
    warning: {
      bg: colors.warning[600],
      text: colors.dark.text.primary,
      border: colors.warning[500],
    },
    error: {
      bg: colors.error[600],
      text: colors.dark.text.primary,
      border: colors.error[500],
    },
    info: {
      bg: colors.info[600],
      text: colors.dark.text.primary,
      border: colors.info[500],
    },
    verified: {
      bg: colors.info[500],
      text: colors.dark.text.primary,
      border: colors.info[400],
    },
    live: {
      bg: colors.error[600],
      text: '#ffffff',
      border: colors.error[500],
      animated: true,
    },
  }

  const sizeConfig = {
    sm: {
      padding: `${spacing.xs} ${spacing.sm}`,
      ...typography.styles.labelS,
      height: '24px',
      icon: 14,
    },
    md: {
      padding: `${spacing.xs} ${spacing.md}`,
      ...typography.styles.labelM,
      height: '32px',
      icon: 16,
    },
    lg: {
      padding: `${spacing.sm} ${spacing.lg}`,
      ...typography.styles.labelL,
      height: '40px',
      icon: 18,
    },
  }

  const shapeRadius = {
    pill: '9999px',
    square: '0.375rem',
    dot: '50%',
  }

  const config = variantConfig[variant]
  const sizeStyles = sizeConfig[size]

  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: sizeStyles.padding,
    borderRadius: shapeRadius[shape],
    border: `1px solid ${config.border}`,
    background: config.bg,
    color: config.text,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    transition: `all ${transitions.duration.fast} ${transitions.easing.out}`,
    cursor: 'default',
    fontSize: sizeStyles.fontSize,
    lineHeight: sizeStyles.lineHeight,
    height: shapeRadius[shape] === '50%' ? sizeStyles.height : 'auto',
    width: shapeRadius[shape] === '50%' ? sizeStyles.height : 'auto',
    flexShrink: 0,
  }

  const isAnimated = animated || config.animated

  return (
    <span
      ref={ref}
      style={baseStyles}
      className={`ikhwezi-badge ikhwezi-badge--${variant} ikhwezi-badge--${size} ikhwezi-badge--${shape} ${className}`}
      {...props}
    >
      {Icon && <Icon size={sizeStyles.icon} />}
      {children && shape !== 'dot' && <span>{children}</span>}

      {isAnimated && variant === 'live' && (
        <style>{`
          .ikhwezi-badge--live {
            animation: livePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            box-shadow: 0 0 0 0 ${colors.error[600]};
          }

          @keyframes livePulse {
            0% {
              box-shadow: 0 0 0 0 ${colors.error[600]};
            }
            70% {
              box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
            }
          }
        `}</style>
      )}
    </span>
  )
})

Badge.displayName = 'Badge'

export default Badge

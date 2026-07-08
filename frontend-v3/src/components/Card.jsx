import React from 'react'
import { colors, spacing, shadows, transitions } from '@/design-system'

/**
 * Premium Card Component
 * 
 * Variants: elevated, outlined, filled, glass
 * Elevation levels: xs, sm, md, lg, xl
 */

const Card = React.forwardRef(({
  children,
  variant = 'elevated',
  elevation = 'md',
  interactive = false,
  hoverable = true,
  gradient = null,
  className = '',
  onClick,
  ...props
}, ref) => {
  const elevationStyles = {
    xs: shadows.xs,
    sm: shadows.sm,
    md: shadows.md,
    lg: shadows.lg,
    xl: shadows.xl,
  }

  const baseStyles = {
    borderRadius: '1rem',
    overflow: 'hidden',
    transition: `all ${transitions.duration.normal} ${transitions.easing.out}`,
    cursor: interactive ? 'pointer' : 'default',
    position: 'relative',
  }

  const variantStyles = {
    elevated: {
      backgroundColor: colors.dark.surface.secondary,
      boxShadow: elevationStyles[elevation],
      border: `1px solid ${colors.neutral[800]}`,
      ':hover': hoverable ? {
        boxShadow: shadows[['xs', 'sm', 'md', 'lg', 'xl'].indexOf(elevation) < 3 ? ['sm', 'md', 'lg'][['xs', 'sm', 'md'].indexOf(elevation)] : 'xl'],
        transform: 'translateY(-4px)',
      } : {},
    },
    outlined: {
      backgroundColor: 'transparent',
      border: `2px solid ${colors.neutral[700]}`,
      boxShadow: 'none',
      ':hover': hoverable ? {
        borderColor: colors.primary[500],
        boxShadow: `0 0 20px rgba(147, 102, 240, 0.1)`,
      } : {},
    },
    filled: {
      backgroundColor: colors.dark.surface.tertiary,
      border: 'none',
      boxShadow: 'none',
      ':hover': hoverable ? {
        backgroundColor: colors.neutral[800],
      } : {},
    },
    glass: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${colors.neutral[700]}`,
      boxShadow: `0 8px 32px rgba(0, 0, 0, 0.1)`,
      ':hover': hoverable ? {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        boxShadow: `0 12px 40px rgba(0, 0, 0, 0.15)`,
      } : {},
    },
  }

  const gradientStyle = gradient ? {
    background: gradient,
  } : {}

  const styles = {
    ...baseStyles,
    ...variantStyles[variant],
    ...gradientStyle,
  }

  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <div
      ref={ref}
      style={isHovered && hoverable ? { ...styles, ...variantStyles[variant][':hover'] } : styles}
      onMouseEnter={hoverable ? () => setIsHovered(true) : undefined}
      onMouseLeave={hoverable ? () => setIsHovered(false) : undefined}
      onClick={interactive ? onClick : undefined}
      className={`ikhwezi-card ikhwezi-card--${variant} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
})

Card.displayName = 'Card'

/**
 * Card.Header - Premium card header with optional icon or action
 */
Card.Header = ({ children, icon: Icon, action, className = '', ...props }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderBottom: `1px solid ${colors.neutral[700]}`,
      gap: spacing.md,
    }}
    className={`ikhwezi-card__header ${className}`}
    {...props}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
      {Icon && <Icon size={24} style={{ color: colors.primary[500] }} />}
      <div>{children}</div>
    </div>
    {action}
  </div>
)

Card.Header.displayName = 'Card.Header'

/**
 * Card.Body - Main card content area with automatic padding
 */
Card.Body = ({ children, noPadding = false, className = '', ...props }) => (
  <div
    style={{
      padding: noPadding ? 0 : spacing.lg,
    }}
    className={`ikhwezi-card__body ${className}`}
    {...props}
  >
    {children}
  </div>
)

Card.Body.displayName = 'Card.Body'

/**
 * Card.Footer - Premium card footer with action buttons
 */
Card.Footer = ({ children, divider = true, className = '', ...props }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing.md,
      padding: spacing.lg,
      borderTop: divider ? `1px solid ${colors.neutral[700]}` : 'none',
    }}
    className={`ikhwezi-card__footer ${className}`}
    {...props}
  >
    {children}
  </div>
)

Card.Footer.displayName = 'Card.Footer'

export default Card

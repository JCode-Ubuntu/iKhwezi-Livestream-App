import React from 'react'
import { colors, spacing, typography, transitions } from '@/design-system'

/**
 * Premium Button Component
 * 
 * Variants: primary, secondary, outline, ghost, danger
 * Sizes: sm (40px), md (48px), lg (56px)
 * States: default, hover, active, disabled, loading
 */

const Button = React.forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  onClick,
  ...props
}, ref) => {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.spacer.iconSpacing,
    borderRadius: '0.75rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: `all ${transitions.duration.base} ${transitions.easing.out}`,
    border: 'none',
    position: 'relative',
    overflow: 'hidden',
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? 0.5 : 1,
  }

  const sizeStyles = {
    sm: {
      padding: `${spacing.xs} ${spacing.md}`,
      ...typography.styles.labelM,
      height: '40px',
    },
    md: {
      padding: `${spacing.sm} ${spacing.lg}`,
      ...typography.styles.labelL,
      height: '48px',
    },
    lg: {
      padding: `${spacing.md} ${spacing.xl}`,
      ...typography.styles.titleS,
      height: '56px',
    },
  }

  const variantStyles = {
    primary: {
      background: colors.gradients.premium,
      color: colors.dark.text.primary,
      boxShadow: `0 4px 16px rgba(147, 102, 240, 0.3)`,
      ':hover': {
        boxShadow: `0 8px 24px rgba(147, 102, 240, 0.4)`,
        transform: 'translateY(-2px)',
      },
      ':active': {
        transform: 'translateY(0)',
        boxShadow: `0 2px 8px rgba(147, 102, 240, 0.2)`,
      },
    },
    secondary: {
      background: colors.primary[600],
      color: colors.dark.text.primary,
      boxShadow: `0 2px 8px rgba(147, 102, 240, 0.2)`,
      ':hover': {
        background: colors.primary[700],
        boxShadow: `0 4px 12px rgba(147, 102, 240, 0.3)`,
        transform: 'translateY(-1px)',
      },
      ':active': {
        transform: 'translateY(0)',
      },
    },
    outline: {
      background: 'transparent',
      color: colors.primary[500],
      border: `2px solid ${colors.primary[500]}`,
      ':hover': {
        background: colors.primary[950],
        borderColor: colors.primary[400],
      },
      ':active': {
        background: colors.primary[900],
      },
    },
    ghost: {
      background: 'transparent',
      color: colors.neutral[50],
      ':hover': {
        background: colors.neutral[900],
      },
      ':active': {
        background: colors.neutral[800],
      },
    },
    danger: {
      background: colors.error[600],
      color: colors.dark.text.primary,
      boxShadow: `0 2px 8px rgba(239, 68, 68, 0.2)`,
      ':hover': {
        background: colors.error[700],
        boxShadow: `0 4px 12px rgba(239, 68, 68, 0.3)`,
        transform: 'translateY(-1px)',
      },
      ':active': {
        transform: 'translateY(0)',
      },
    },
  }

  const styles = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant],
  }

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      onClick={onClick}
      style={styles}
      className={`ikhwezi-button ikhwezi-button--${variant} ikhwezi-button--${size} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading ? (
        <span style={{
          animation: `spin 1s linear infinite`,
          display: 'inline-block',
        }}>
          ⟳
        </span>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon size={20} />}
          {children}
          {Icon && iconPosition === 'right' && <Icon size={20} />}
        </>
      )}
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .ikhwezi-button::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        
        .ikhwezi-button:active::before {
          animation: ripple 0.6s ease-out;
        }
        
        @keyframes ripple {
          0% {
            width: 0;
            height: 0;
            opacity: 1;
          }
          100% {
            width: 300px;
            height: 300px;
            opacity: 0;
          }
        }
      `}</style>
    </button>
  )
})

Button.displayName = 'Button'

export default Button

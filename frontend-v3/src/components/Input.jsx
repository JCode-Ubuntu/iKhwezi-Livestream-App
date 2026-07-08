import React from 'react'
import { colors, spacing, typography, transitions } from '@/design-system'

/**
 * Premium Input Component
 * 
 * Features:
 * - Icon support (left/right)
 * - Error state with message
 * - Helper text
 * - Character counter
 * - Disabled state
 * - Focus animations
 */

const Input = React.forwardRef(({
  type = 'text',
  placeholder = '',
  value = '',
  onChange,
  onFocus,
  onBlur,
  disabled = false,
  error = false,
  errorMessage = '',
  helperText = '',
  label = '',
  icon: Icon,
  iconPosition = 'left',
  maxLength = null,
  showCounter = false,
  size = 'md',
  variant = 'outlined',
  className = '',
  ...props
}, ref) => {
  const [focused, setFocused] = React.useState(false)
  const [charCount, setCharCount] = React.useState(value.length)

  const sizeConfig = {
    sm: {
      padding: `${spacing.xs} ${spacing.md}`,
      fontSize: '0.875rem',
      height: '36px',
    },
    md: {
      padding: `${spacing.sm} ${spacing.lg}`,
      fontSize: '1rem',
      height: '44px',
    },
    lg: {
      padding: `${spacing.md} ${spacing.xl}`,
      fontSize: '1.125rem',
      height: '52px',
    },
  }

  const sizeStyles = sizeConfig[size]

  const baseStyles = {
    width: '100%',
    border: 'none',
    borderRadius: '0.75rem',
    ...typography.styles.bodyM,
    transition: `all ${transitions.duration.fast} ${transitions.easing.out}`,
    outline: 'none',
    backgroundColor: colors.dark.surface.secondary,
    color: colors.dark.text.primary,
    ...sizeStyles,
  }

  const variantStyles = {
    outlined: {
      border: `2px solid ${error ? colors.error[500] : focused ? colors.primary[500] : colors.neutral[700]}`,
      backgroundColor: colors.dark.surface.primary,
      ':hover': !disabled && {
        borderColor: error ? colors.error[600] : colors.neutral[600],
      },
      ':focus': {
        borderColor: colors.primary[500],
        boxShadow: `0 0 0 3px rgba(147, 102, 240, 0.1)`,
      },
    },
    filled: {
      border: 'none',
      backgroundColor: error ? colors.error[950] : colors.dark.surface.secondary,
      borderBottom: `2px solid ${error ? colors.error[500] : focused ? colors.primary[500] : colors.neutral[700]}`,
      ':focus': {
        backgroundColor: colors.dark.surface.tertiary,
        borderBottomColor: colors.primary[500],
      },
    },
    flush: {
      border: 'none',
      backgroundColor: 'transparent',
      borderBottom: `2px solid ${error ? colors.error[500] : focused ? colors.primary[500] : colors.neutral[700]}`,
      ':focus': {
        borderBottomColor: colors.primary[500],
      },
    },
  }

  const styles = {
    ...baseStyles,
    ...variantStyles[variant],
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
    paddingLeft: Icon && iconPosition === 'left' ? `${parseFloat(sizeStyles.padding.split(' ')[1]) * 2 + 20}px` : sizeStyles.padding,
    paddingRight: Icon && iconPosition === 'right' ? `${parseFloat(sizeStyles.padding.split(' ')[1]) * 2 + 20}px` : sizeStyles.padding,
  }

  const handleChange = (e) => {
    const newValue = e.target.value
    if (maxLength === null || newValue.length <= maxLength) {
      setCharCount(newValue.length)
      onChange?.(e)
    }
  }

  const handleFocus = (e) => {
    setFocused(true)
    onFocus?.(e)
  }

  const handleBlur = (e) => {
    setFocused(false)
    onBlur?.(e)
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Label */}
      {label && (
        <label
          style={{
            display: 'block',
            marginBottom: spacing.xs,
            ...typography.styles.labelM,
            color: error ? colors.error[500] : colors.dark.text.secondary,
            fontWeight: 600,
          }}
        >
          {label}
        </label>
      )}

      {/* Input Container */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Left Icon */}
        {Icon && iconPosition === 'left' && (
          <div
            style={{
              position: 'absolute',
              left: spacing.md,
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
              color: focused ? colors.primary[500] : colors.neutral[500],
              transition: `color ${transitions.duration.fast} ${transitions.easing.out}`,
            }}
          >
            <Icon size={20} />
          </div>
        )}

        {/* Input */}
        <input
          ref={ref}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          maxLength={maxLength}
          style={styles}
          className={`ikhwezi-input ikhwezi-input--${variant} ikhwezi-input--${size} ${className}`}
          {...props}
        />

        {/* Right Icon */}
        {Icon && iconPosition === 'right' && (
          <div
            style={{
              position: 'absolute',
              right: spacing.md,
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
              color: focused ? colors.primary[500] : colors.neutral[500],
              transition: `color ${transitions.duration.fast} ${transitions.easing.out}`,
            }}
          >
            <Icon size={20} />
          </div>
        )}
      </div>

      {/* Helper Text or Error Message */}
      {(errorMessage || helperText) && (
        <p
          style={{
            marginTop: spacing.xs,
            ...typography.styles.captionS,
            color: error ? colors.error[500] : colors.dark.text.tertiary,
            margin: 0,
          }}
        >
          {error ? errorMessage : helperText}
        </p>
      )}

      {/* Character Counter */}
      {showCounter && maxLength && (
        <div
          style={{
            marginTop: spacing.xs,
            display: 'flex',
            justifyContent: 'flex-end',
            ...typography.styles.captionS,
            color: charCount > maxLength * 0.8 ? colors.warning[500] : colors.dark.text.tertiary,
          }}
        >
          {charCount} / {maxLength}
        </div>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input

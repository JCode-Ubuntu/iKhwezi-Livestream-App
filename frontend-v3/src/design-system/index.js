/**
 * IKHWEZI DESIGN SYSTEM
 * 
 * Complete design system with colors, typography, spacing, and motion
 * Inspired by Apple, Instagram, Spotify, Material Design 3
 * 
 * Usage:
 * import { colors, typography, spacing, animations } from '@/design-system'
 */

export { colors as colors, default as defaultColors } from './colors'
export { typography } from './typography'
export { spacing, sizing, borders, shadows } from './spacing'
export { transitions, animations, keyframes } from './motion'

// Design Tokens Export
export const designTokens = {
  colors: require('./colors').default,
  typography: require('./typography').default,
  spacing: require('./spacing').default,
  motion: require('./motion').default,
}

export default designTokens

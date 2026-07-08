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

// Design Tokens Export with ES6 imports
import * as colorsModule from './colors'
import { typography as typographyModule } from './typography'
import { spacing as spacingModule, sizing as sizingModule, borders as bordersModule, shadows as shadowsModule } from './spacing'
import { transitions as transitionsModule, animations as animationsModule, keyframes as keyframesModule } from './motion'

export const designTokens = {
  colors: colorsModule.default,
  typography: typographyModule,
  spacing: spacingModule,
  motion: {
    transitions: transitionsModule,
    animations: animationsModule,
    keyframes: keyframesModule
  }
}

export default designTokens

/**
 * IKHWEZI DESIGN SYSTEM - SPACING & SIZING
 * 
 * Consistent 8px baseline grid system
 * Inspired by Material Design 3 & Apple HIG
 */

export const spacing = {
  // Base 8px Grid
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  '2xl': '2.5rem', // 40px
  '3xl': '3rem', // 48px
  '4xl': '4rem', // 64px
  '5xl': '5rem', // 80px
  '6xl': '6rem', // 96px
  '7xl': '7rem', // 112px
  '8xl': '8rem', // 128px,

  // Semantic Spacing
  spacer: {
    pageGutter: '1.5rem', // 24px
    sectionGap: '2rem', // 32px
    cardGap: '1rem', // 16px
    componentGap: '0.5rem', // 8px
    iconSpacing: '0.375rem', // 6px
  },
};

export const sizing = {
  // Touch Targets
  touch: {
    small: '2.5rem', // 40px minimum
    medium: '3rem', // 48px standard
    large: '3.5rem', // 56px comfortable
  },

  // Icon Sizes
  icon: {
    xs: '1rem', // 16px
    sm: '1.25rem', // 20px
    md: '1.5rem', // 24px
    lg: '2rem', // 32px
    xl: '2.5rem', // 40px
    '2xl': '3rem', // 48px
  },

  // Avatar Sizes
  avatar: {
    xs: '2rem', // 32px
    sm: '2.5rem', // 40px
    md: '3rem', // 48px
    lg: '4rem', // 64px
    xl: '5rem', // 80px
    '2xl': '6rem', // 96px
  },

  // Container Sizes
  container: {
    xs: '20rem', // 320px
    sm: '24rem', // 384px
    md: '28rem', // 448px
    lg: '32rem', // 512px
    xl: '36rem', // 576px
    '2xl': '42rem', // 672px
    '3xl': '48rem', // 768px
    '4xl': '56rem', // 896px
    '5xl': '64rem', // 1024px
    '6xl': '72rem', // 1152px
    '7xl': '80rem', // 1280px
    full: '100%',
  },

  // Breakpoints
  breakpoints: {
    xs: '0px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
};

export const borders = {
  // Radius Values
  radius: {
    none: '0',
    xs: '0.125rem', // 2px
    sm: '0.25rem', // 4px
    md: '0.375rem', // 6px
    lg: '0.5rem', // 8px
    xl: '0.75rem', // 12px
    '2xl': '1rem', // 16px
    '3xl': '1.5rem', // 24px
    full: '9999px',
  },

  // Border Widths
  width: {
    none: '0',
    hairline: '0.5px',
    thin: '1px',
    base: '2px',
    thick: '3px',
  },
};

export const shadows = {
  // Elevation Shadows
  none: 'none',
  
  // Surface shadows (4 levels of elevation)
  xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px rgba(0, 0, 0, 0.25)',
  '3xl': '0 25px 50px rgba(0, 0, 0, 0.3)',

  // Glow Effects
  glow: {
    sm: '0 0 8px rgba(147, 102, 240, 0.3)',
    md: '0 0 16px rgba(147, 102, 240, 0.4)',
    lg: '0 0 24px rgba(147, 102, 240, 0.5)',
  },

  // Inset Shadows
  inset: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
};

export default {
  spacing,
  sizing,
  borders,
  shadows,
};

/**
 * IKHWEZI DESIGN SYSTEM - COLOR PALETTE
 * 
 * Premium color system based on modern design principles
 * Inspired by Apple, Instagram, and Spotify
 */

export const colors = {
  // Primary Gradient (Luxury Purple-to-Pink)
  primary: {
    50: '#faf7ff',
    100: '#f0e6ff',
    200: '#e0cdff',
    300: '#c9b0f9',
    400: '#b08ef5',
    500: '#9366f0', // Primary
    600: '#7d4dd9',
    700: '#6b3ac1',
    800: '#5c2fa8',
    900: '#4d2690',
    950: '#2d1250',
  },

  // Secondary Accent (Vibrant Pink)
  accent: {
    50: '#fff5f8',
    100: '#ffebf1',
    200: '#ffd4e5',
    300: '#ffb3d1',
    400: '#ff85af',
    500: '#ff6b9d', // Accent
    600: '#f5477f',
    700: '#e02e62',
    800: '#c9164f',
    900: '#9d1242',
    950: '#6d0935',
  },

  // Success
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#145231',
    950: '#052e16',
  },

  // Warning
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },

  // Error
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },

  // Information
  info: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#051e3e',
  },

  // Neutral Palette
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },

  // Dark Mode Backgrounds
  dark: {
    bg: {
      primary: '#0a0a0a',
      secondary: '#1a1a1a',
      tertiary: '#2a2a2a',
      surface: '#161616',
      overlay: 'rgba(0, 0, 0, 0.7)',
    },
    text: {
      primary: '#ffffff',
      secondary: '#e5e5e5',
      tertiary: '#a3a3a3',
    },
  },

  // Light Mode Backgrounds
  light: {
    bg: {
      primary: '#ffffff',
      secondary: '#f5f5f5',
      tertiary: '#e5e5e5',
      surface: '#fafafa',
      overlay: 'rgba(255, 255, 255, 0.7)',
    },
    text: {
      primary: '#0a0a0a',
      secondary: '#404040',
      tertiary: '#737373',
    },
  },

  // Semantic Colors
  semantic: {
    live: '#ef4444', // Live indicator red
    verified: '#0ea5e9', // Verified blue
    trending: '#f59e0b', // Trending orange
    featured: '#9366f0', // Featured purple
    disabled: '#a3a3a3', // Disabled gray
  },

  // Gradients
  gradients: {
    premium: 'linear-gradient(135deg, #9366f0 0%, #ff6b9d 100%)',
    sunset: 'linear-gradient(180deg, #ff6b9d 0%, #f59e0b 100%)',
    ocean: 'linear-gradient(180deg, #0284c7 0%, #0ea5e9 100%)',
    forest: 'linear-gradient(180deg, #16a34a 0%, #22c55e 100%)',
    dark: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
  },
};

export default colors;

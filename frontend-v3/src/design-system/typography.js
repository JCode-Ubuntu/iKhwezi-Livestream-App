/**
 * IKHWEZI DESIGN SYSTEM - TYPOGRAPHY
 * 
 * Professional typography scale based on Apple's SF Pro Display
 * Maintains perfect readability and hierarchy
 */

export const typography = {
  // Font Families
  fonts: {
    display: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif',
    mono: '"SF Mono", Monaco, "Cascadia Code", Roboto Mono, Consolas, "Courier New", monospace',
  },

  // Font Weights
  weights: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },

  // Typography Styles
  styles: {
    // Display Sizes
    displayLarge: {
      fontSize: '3.5rem', // 56px
      lineHeight: '1.1',
      letterSpacing: '-0.02em',
      fontWeight: 700,
    },
    displayMedium: {
      fontSize: '2.875rem', // 46px
      lineHeight: '1.15',
      letterSpacing: '-0.015em',
      fontWeight: 700,
    },
    displaySmall: {
      fontSize: '2.25rem', // 36px
      lineHeight: '1.2',
      letterSpacing: '-0.01em',
      fontWeight: 700,
    },

    // Heading Sizes
    headlineXL: {
      fontSize: '2rem', // 32px
      lineHeight: '1.25',
      fontWeight: 700,
    },
    headlineL: {
      fontSize: '1.75rem', // 28px
      lineHeight: '1.3',
      fontWeight: 700,
    },
    headlineM: {
      fontSize: '1.5rem', // 24px
      lineHeight: '1.35',
      fontWeight: 700,
    },
    headlineS: {
      fontSize: '1.375rem', // 22px
      lineHeight: '1.4',
      fontWeight: 700,
    },

    // Title Sizes
    titleXL: {
      fontSize: '1.25rem', // 20px
      lineHeight: '1.4',
      fontWeight: 600,
    },
    titleL: {
      fontSize: '1.125rem', // 18px
      lineHeight: '1.45',
      fontWeight: 600,
    },
    titleM: {
      fontSize: '1rem', // 16px
      lineHeight: '1.5',
      fontWeight: 600,
    },
    titleS: {
      fontSize: '0.9375rem', // 15px
      lineHeight: '1.4',
      fontWeight: 600,
    },

    // Body Sizes
    bodyXL: {
      fontSize: '1.125rem', // 18px
      lineHeight: '1.5',
      fontWeight: 400,
    },
    bodyL: {
      fontSize: '1rem', // 16px
      lineHeight: '1.6',
      fontWeight: 400,
    },
    bodyM: {
      fontSize: '0.9375rem', // 15px
      lineHeight: '1.5',
      fontWeight: 400,
    },
    bodyS: {
      fontSize: '0.875rem', // 14px
      lineHeight: '1.5',
      fontWeight: 400,
    },

    // Subtitle Sizes
    subtitleL: {
      fontSize: '1rem', // 16px
      lineHeight: '1.5',
      fontWeight: 500,
    },
    subtitleM: {
      fontSize: '0.9375rem', // 15px
      lineHeight: '1.5',
      fontWeight: 500,
    },
    subtitleS: {
      fontSize: '0.875rem', // 14px
      lineHeight: '1.5',
      fontWeight: 500,
    },

    // Caption Sizes
    captionL: {
      fontSize: '0.875rem', // 14px
      lineHeight: '1.42',
      fontWeight: 500,
    },
    captionM: {
      fontSize: '0.8125rem', // 13px
      lineHeight: '1.38',
      fontWeight: 500,
    },
    captionS: {
      fontSize: '0.75rem', // 12px
      lineHeight: '1.33',
      fontWeight: 500,
    },

    // Label Sizes
    labelL: {
      fontSize: '0.875rem', // 14px
      lineHeight: '1.42',
      fontWeight: 600,
      letterSpacing: '0.01em',
      textTransform: 'uppercase',
    },
    labelM: {
      fontSize: '0.8125rem', // 13px
      lineHeight: '1.38',
      fontWeight: 600,
      letterSpacing: '0.012em',
      textTransform: 'uppercase',
    },
    labelS: {
      fontSize: '0.75rem', // 12px
      lineHeight: '1.33',
      fontWeight: 600,
      letterSpacing: '0.015em',
      textTransform: 'uppercase',
    },
  },
};

export default typography;

/**
 * IKHWEZI DESIGN SYSTEM - MOTION & ANIMATIONS
 * 
 * Physics-based animation system inspired by iOS
 * All animations feel natural and intentional
 */

export const transitions = {
  // Duration
  duration: {
    instant: '0ms',
    ultra: '100ms',
    fast: '150ms',
    base: '200ms',
    normal: '250ms',
    slow: '300ms',
    slower: '400ms',
    slowest: '500ms',
  },

  // Easing Functions (Bezier curves)
  easing: {
    // Linear
    linear: 'linear',

    // Ease In/Out (default cubic)
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',

    // iOS-style
    iosIn: 'cubic-bezier(0.86, 0, 0.07, 1)',
    iosOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    iosInOut: 'cubic-bezier(0.25, 0.1, 0.25, 1)',

    // Spring-like
    springBouncy: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    springSmooth: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    springGently: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',

    // Smooth Material Design
    material: 'cubic-bezier(0.4, 0, 0.2, 1)',
    materialAccelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    materialDecelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  },
};

export const animations = {
  // Transition Presets
  fadeIn: {
    animation: 'fadeIn',
    duration: '300ms',
    easing: 'cubic-bezier(0, 0, 0.2, 1)',
  },
  fadeOut: {
    animation: 'fadeOut',
    duration: '200ms',
    easing: 'cubic-bezier(0.4, 0, 1, 1)',
  },

  // Scale Animations
  scaleIn: {
    animation: 'scaleIn',
    duration: '300ms',
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  scaleOut: {
    animation: 'scaleOut',
    duration: '200ms',
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

  // Slide Animations
  slideInUp: {
    animation: 'slideInUp',
    duration: '400ms',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  slideOutDown: {
    animation: 'slideOutDown',
    duration: '300ms',
    easing: 'cubic-bezier(0.7, 0, 1, 0.5)',
  },
  slideInLeft: {
    animation: 'slideInLeft',
    duration: '350ms',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  slideOutRight: {
    animation: 'slideOutRight',
    duration: '300ms',
    easing: 'cubic-bezier(0.7, 0, 1, 0.5)',
  },

  // Pulse Animations
  pulse: {
    animation: 'pulse',
    duration: '2000ms',
    easing: 'ease-in-out',
    iterationCount: 'infinite',
  },
  glow: {
    animation: 'glow',
    duration: '1500ms',
    easing: 'ease-in-out',
    iterationCount: 'infinite',
  },

  // Micro-interactions
  bounce: {
    animation: 'bounce',
    duration: '600ms',
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  shake: {
    animation: 'shake',
    duration: '400ms',
    easing: 'ease-in-out',
  },
  wiggle: {
    animation: 'wiggle',
    duration: '500ms',
    easing: 'ease-in-out',
  },
};

export const keyframes = {
  // Fade
  fadeIn: `
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `,
  fadeOut: `
    @keyframes fadeOut {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }
  `,

  // Scale
  scaleIn: `
    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `,
  scaleOut: `
    @keyframes scaleOut {
      from {
        opacity: 1;
        transform: scale(1);
      }
      to {
        opacity: 0;
        transform: scale(0.95);
      }
    }
  `,

  // Slide
  slideInUp: `
    @keyframes slideInUp {
      from {
        opacity: 0;
        transform: translateY(24px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  slideOutDown: `
    @keyframes slideOutDown {
      from {
        opacity: 1;
        transform: translateY(0);
      }
      to {
        opacity: 0;
        transform: translateY(24px);
      }
    }
  `,
  slideInLeft: `
    @keyframes slideInLeft {
      from {
        opacity: 0;
        transform: translateX(-24px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `,
  slideOutRight: `
    @keyframes slideOutRight {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(24px);
      }
    }
  `,

  // Pulse
  pulse: `
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }
  `,
  glow: `
    @keyframes glow {
      0%, 100% {
        box-shadow: 0 0 8px rgba(147, 102, 240, 0.3);
      }
      50% {
        box-shadow: 0 0 20px rgba(147, 102, 240, 0.6);
      }
    }
  `,

  // Interactions
  bounce: `
    @keyframes bounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-12px);
      }
    }
  `,
  shake: `
    @keyframes shake {
      0%, 100% {
        transform: translateX(0);
      }
      10%, 30%, 50%, 70%, 90% {
        transform: translateX(-4px);
      }
      20%, 40%, 60%, 80% {
        transform: translateX(4px);
      }
    }
  `,
  wiggle: `
    @keyframes wiggle {
      0%, 100% {
        transform: rotate(0deg);
      }
      25% {
        transform: rotate(-3deg);
      }
      75% {
        transform: rotate(3deg);
      }
    }
  `,
};

export default {
  transitions,
  animations,
  keyframes,
};

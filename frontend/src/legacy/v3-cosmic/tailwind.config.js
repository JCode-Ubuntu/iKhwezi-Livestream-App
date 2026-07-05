/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        cosmic: {
          950: '#020617',
          900: '#0f172a',
          850: '#0c1222',
        },
        neon: {
          indigo: '#6366f1',
          purple: '#a855f7',
          cyan: '#22d3ee',
        },
      },
      boxShadow: {
        'glass': '0 0 40px rgba(99, 102, 241, 0.35)',
        'glass-strong': '0 0 56px rgba(168, 85, 247, 0.45)',
        'neon-ring': '0 0 0 1px rgba(255,255,255,0.1), 0 0 32px rgba(99, 102, 241, 0.4)',
      },
      backgroundImage: {
        'cosmic-gradient':
          'linear-gradient(to bottom right, #020617 0%, rgba(30, 27, 75, 0.35) 45%, #020617 100%)',
        'shimmer':
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
        'fashion-halo':
          'radial-gradient(ellipse at center, rgba(236, 72, 153, 0.15) 0%, transparent 65%)',
      },
      animation: {
        'neon-pulse': 'neon-pulse 2.2s ease-in-out infinite',
        'cosmic-drift': 'cosmic-drift 18s ease-in-out infinite',
        'shimmer-slide': 'shimmer-slide 1.8s ease-in-out infinite',
        'float-soft': 'float-soft 4s ease-in-out infinite',
        'live-ring': 'live-ring 1.5s ease-in-out infinite',
      },
      keyframes: {
        'neon-pulse': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.85', filter: 'brightness(1.15)' },
        },
        'cosmic-drift': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(2%, -1%) scale(1.02)' },
          '66%': { transform: 'translate(-1%, 1%) scale(0.99)' },
        },
        'shimmer-slide': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float-soft': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'live-ring': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.5)' },
          '50%': { boxShadow: '0 0 0 12px rgba(239, 68, 68, 0)' },
        },
      },
      transitionDuration: {
        300: '300ms',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

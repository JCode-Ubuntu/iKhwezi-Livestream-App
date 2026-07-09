/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Syne', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      colors: {
        void: {
          950: '#0A0A0A',
          900: '#0D0F1A',
          850: '#12141F',
        },
        gold: {
          200: '#fde68a',
          300: '#F5C542',
          400: '#EAB308',
          500: '#D4A012',
          600: '#B8860B',
        },
        pink: {
          300: '#F7A8C0',
          400: '#F0568F',
          500: '#E1306C',
          600: '#B91C58',
          700: '#8F1442',
        },
        plasma: {
          300: '#67e8f9',
          400: '#22D3EE',
          500: '#06b6d4',
        },
        violet: {
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
        },
        cosmic: {
          950: '#0A0A0A',
          900: '#12141F',
          850: '#161826',
        },
        neon: {
          indigo: '#6366f1',
          purple: '#a855f7',
          cyan: '#22d3ee',
          pink: '#E1306C',
        },
      },
      boxShadow: {
        glass: '0 0 40px rgba(225, 48, 108, 0.28)',
        'glass-strong': '0 0 56px rgba(225, 48, 108, 0.4)',
        'neon-ring': '0 0 0 1px rgba(255,255,255,0.1), 0 0 32px rgba(225, 48, 108, 0.35)',
        'ultima-glow': '0 0 60px rgba(245, 197, 66, 0.2), 0 0 120px rgba(225, 48, 108, 0.16)',
      },
      backgroundImage: {
        'cosmic-gradient':
          'linear-gradient(to bottom right, #0A0A0A 0%, rgba(225, 48, 108, 0.16) 45%, #0A0A0A 100%)',
        shimmer:
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
      },
      animation: {
        'neon-pulse': 'neon-pulse 2.2s ease-in-out infinite',
        'shimmer-slide': 'shimmer-slide 1.8s ease-in-out infinite',
        'live-ring': 'live-ring 1.5s ease-in-out infinite',
      },
      keyframes: {
        'neon-pulse': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.85', filter: 'brightness(1.15)' },
        },
        'shimmer-slide': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'live-ring': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.5)' },
          '50%': { boxShadow: '0 0 0 12px rgba(239, 68, 68, 0)' },
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-purple': '#a855f7',
        'brand-blue': '#3b82f6',
      },
    },
  },
  plugins: [],
}

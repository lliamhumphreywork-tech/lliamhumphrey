/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#1A1A1A',
        surface: '#242424',
        'surface-2': '#2E2E2E',
        accent: '#6B4C2A',
        'accent-hover': '#7D5A33',
        cream: '#F5F0E8',
        'cream-dim': 'rgba(245,240,232,0.6)',
        'cream-muted': 'rgba(245,240,232,0.35)',
        'line': 'rgba(245,240,232,0.1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['DM Serif Display', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

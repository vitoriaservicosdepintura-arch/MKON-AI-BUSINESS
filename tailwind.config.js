/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101114',
        graphite: '#1B1D21',
        slate2: '#292C31',
        snow: '#F5F5F5',
        brand: {
          DEFAULT: 'rgba(var(--brand-primary-rgb), 1)',
          soft: 'rgba(var(--brand-soft-rgb), 1)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { xl2: '14px' },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(.97)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up .25s ease-out both',
        'scale-in': 'scale-in .18s ease-out both',
      },
    },
  },
  plugins: [],
}

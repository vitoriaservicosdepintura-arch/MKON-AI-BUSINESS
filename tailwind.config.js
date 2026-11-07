/** @type {import('tailwindcss').Config} */
// Cores vêm de variáveis CSS (src/index.css) para o seletor de tema.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: v('ink'),
        graphite: v('graphite'),
        slate2: v('slate2'),
        snow: v('snow'),
        // "white" = cor de primeiro plano do tema (branco nos escuros, tinta no claro)
        white: v('fg'),
        brand: { DEFAULT: v('brand'), soft: v('brand-soft') },
        'on-brand': v('on-brand'),
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

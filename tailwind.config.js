/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // rgb(... / <alpha-value>) em vez de var(--x) puro: só assim bg-bordo/15,
      // border-danger/40 etc. são gerados (antes sumiam em silêncio).
      colors: {
        bg:          'rgb(var(--bg-rgb) / <alpha-value>)',
        surface:     'rgb(var(--surface-rgb) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2-rgb) / <alpha-value>)',
        border:      'rgb(var(--border-rgb) / <alpha-value>)',
        text:        'rgb(var(--text-rgb) / <alpha-value>)',
        muted:       'rgb(var(--muted-rgb) / <alpha-value>)',
        bordo:       'rgb(var(--bordo-rgb) / <alpha-value>)',
        'bordo-soft':'rgb(var(--bordo-soft-rgb) / <alpha-value>)',
        gold:        'rgb(var(--gold-rgb) / <alpha-value>)',
        success:     'rgb(var(--success-rgb) / <alpha-value>)',
        danger:      'rgb(var(--danger-rgb) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans:    ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};

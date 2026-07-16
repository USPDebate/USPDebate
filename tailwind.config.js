/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:          'var(--bg)',
        surface:     'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border:      'var(--border)',
        text:        'var(--text)',
        muted:       'var(--muted)',
        bordo:       'var(--bordo)',
        'bordo-soft':'var(--bordo-soft)',
        gold:        'var(--gold)',
        success:     'var(--success)',
        danger:      'var(--danger)',
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

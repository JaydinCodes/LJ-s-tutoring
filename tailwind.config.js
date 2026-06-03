/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media',
  content: [
    './*.html',
    './guides/**/*.html',
    './student/**/*.html',
    './student-app/src/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    screens: {
      xs: '390px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        brand: {
          navy: '#0f172a',
          deepBlue: '#1e3a5f',
          aegean: '#1F6F8B',
          gold: '#f4c518',
          parchment: '#f8f5ee',
          marble: '#e2e8f0',
          olympian: '#7c3aed',
          ionian: '#0ea5e9',
          spartan: '#dc2626',
          laurel: '#064e3b',
          obsidian: '#1c1917',

          // legacy aliases so old UI does not break immediately
          dark: '#0f172a',
          light: '#f8fafc',
          midnight: '#12203c',
          teal: '#14b8a6',
          violet: '#7c3aed',
        },
        academy: {
          ink: 'rgb(var(--academy-ink) / <alpha-value>)',
          muted: 'rgb(var(--academy-muted) / <alpha-value>)',
          navy: 'rgb(var(--academy-navy) / <alpha-value>)',
          deep: 'rgb(var(--academy-deep) / <alpha-value>)',
          aegean: 'rgb(var(--academy-aegean) / <alpha-value>)',
          gold: 'rgb(var(--academy-gold) / <alpha-value>)',
          parchment: 'rgb(var(--academy-parchment) / <alpha-value>)',
          marble: 'rgb(var(--academy-marble) / <alpha-value>)',
          surface: 'rgb(var(--academy-surface) / <alpha-value>)',
          hairline: 'rgb(var(--academy-hairline) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Cormorant Garamond', 'Fraunces', 'Georgia', 'Cambria', 'serif'],
      },
      borderRadius: {
        ios: '1.35rem',
        'ios-lg': '1.75rem',
        sheet: '2rem',
      },
      boxShadow: {
        academy: '0 18px 45px rgba(15, 23, 42, 0.07)',
        'academy-strong': '0 26px 80px rgba(7, 19, 38, 0.28)',
        'academy-soft': '0 10px 30px rgba(15, 23, 42, 0.08)',
        'academy-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.74)',
      },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-t': 'env(safe-area-inset-top)',
      },
      transitionTimingFunction: {
        ios: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        fast: '160ms',
        fluid: '260ms',
        sheet: '360ms',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

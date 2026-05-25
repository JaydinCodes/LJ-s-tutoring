/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './guides/**/*.html',
    './student/**/*.html',
    './student-app/src/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0f172a',
          gold: '#9b6e00',
          light: '#f8fafc',
          navy: '#091427',
          midnight: '#12203c',
          teal: '#14b8a6',
          violet: '#7c3aed',
        },
        green: {
          400: '#4ade80',
          500: '#008933',
          600: '#007329',
        },
        blue: {
          500: '#2563eb',
        },
        purple: {
          500: '#9333ea',
        },
        amber: {
          500: '#d97706',
          600: '#b45309',
        },
        slate: {
          500: '#475569',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

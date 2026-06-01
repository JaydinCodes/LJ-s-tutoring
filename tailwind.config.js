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
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

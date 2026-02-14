/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}', './public/**/*.html'],
  important: '#root',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3b6fa6',
          dark: '#1d4479',
          light: '#5888c8',
        },
        secondary: '#f8f9fa',
        accent: '#a8cbf5',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false, // Disable Tailwind reset to not conflict with MUI
  },
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1e40af',
        secondary: '#0891b2',
        success: '#16a34a',
        warning: '#ea580c',
        danger: '#dc2626',
      },
    },
  },
  plugins: [],
}

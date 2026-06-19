/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: '#1a6b3c',
        'felt-dark': '#145730',
        'felt-light': '#227a47',
      },
    },
  },
  plugins: [],
}


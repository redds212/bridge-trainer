/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: '#1a6b3c',
        'felt-dark': '#145730',
        'felt-light': '#227a47',
        // BridgeLoop brand tokens (docs/design/README.md — kierunek „Pętla")
        brand: {
          bg: '#0b1220',
          panel: '#131c2e',
          soft: '#1b2740',
          line: 'rgba(255,255,255,0.09)',
          text: '#e8edf5',
          dim: '#8a97ad',
          accent: '#10b981',
          'accent-soft': '#34d399',
          'accent-2': '#fbbf24',
          'btn-text': '#04130c',
          felt: '#155640',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}


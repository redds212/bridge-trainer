/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        // `md:` znaczy „jest miejsce na układ desktopowy", a nie tylko „szeroko".
        // Telefon w poziomie ma 812 px szerokości, ale 375 px wysokości — układ
        // desktopowy (tabela licytacji, ContractBox, pt-16 nad filcem) ściskał tam
        // stół do ~80 px i przycinał ręce N/S. Poniżej 500 px wysokości wracamy do
        // układu mobilnego: chipy + arkusz, czyli tego, co się skaluje do miejsca.
        //
        // UWAGA: `md:` to JEDYNY próg używany w projekcie i celowo tak zostaje.
        // Wbudowane `sm:`, `lg:`, `xl:` patrzą wyłącznie na szerokość, więc mieszanie
        // ich z tym progiem daje stany pośrednie — np. przy 812×375 `sm:` już działa,
        // a `md:` jeszcze nie. Zanim sięgniesz po kolejny próg, sprawdź, czy chodzi Ci
        // o samą szerokość, czy o „mieści się układ desktopowy".
        md: { raw: '(min-width: 768px) and (min-height: 500px)' },
      },
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


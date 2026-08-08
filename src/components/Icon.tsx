import type { CSSProperties, ReactNode } from 'react';

/**
 * Zestaw ikon interfejsu. Jeden komponent zamiast rozsypanych po plikach `<svg>`
 * i znaków Unicode (⏮ ◀ ▶), które na Androidzie potrafiły wyjść jako kolorowe emoji
 * zamiast szarej ikonki.
 *
 * TODO sugerowało sprite SVG z `<use href="/icons.svg#…">`, ale ta notatka powstała
 * przy założeniu, że sprite już w projekcie jest — nie było, plik pod tą nazwą
 * pochodził z szablonu Vite. Skoro trzeba było zaczynać od zera, wygrywa forma
 * zgodna z resztą kodu: reszta ikon w projekcie też jest inline'owana. Przy okazji
 * nie dochodzi osobne żądanie sieciowe ani kolejny plik do cache'owania.
 *
 * Styl: obrys 24×24, `currentColor`, zaokrąglone końce — jak dotychczasowy hamburger
 * i strzałki rozwijania.
 */
const PATHS = {
  menu: (
    <>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </>
  ),
  'chevron-down': <polyline points="6 9 12 15 18 9" />,
  'chevron-left': <polyline points="15 18 9 12 15 6" />,
  'chevron-right': <polyline points="9 18 15 12 9 6" />,
  restart: (
    <>
      <polygon points="19 20 9 12 19 4" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  /** Ikona „Udostępnij" z iOS — w instrukcji instalacji na iPhonie. */
  share: (
    <>
      <path d="M12 16V4" />
      <polyline points="8 8 12 4 16 8" />
      <path d="M6 12H5a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-1" />
    </>
  ),
  flag: (
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.65" y2="16.65" />
    </>
  ),
  /** Czyszczenie pola wyszukiwania — nie znak „×", żeby nie wracać do Unicode. */
  close: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

interface Props {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, strokeWidth = 2, className, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

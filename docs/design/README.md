# Handoff: BridgeLoop — rebranding trenażera brydżowego

## Overview
Zmiana marki istniejącej aplikacji do nauki brydża (obecnie „Trenażer Brydżowy / System SRS", host: `redds212.github.io`) na **BridgeLoop**. Pakiet zawiera:
- system logo (wybrany kierunek: **Pętla**) — znak, wariant poziomy, ikona aplikacji,
- gotowe pliki ikon (PNG 512px, 192px, favicon 32px i 16px),
- przeprojektowany **ekran logowania**,
- **odświeżenie brandingu interfejsu** (sidebar z przyciskami + stół z rozdaniem + plakietka kontraktu z licznikami lew),
- nowy **4-kolorowy schemat figur** w panelu rozdania,
- zrzuty ekranów referencyjnych.

To NIE jest pełny redesign UX — istniejące układy i funkcje zostają. Zmieniamy: nazwę, logo, kolory akcentu, typografię, kolory figur w rozdaniu.

## About the Design Files
- `BridgeLoop Brand.dc.html` — **interaktywna referencja projektowa**. Otwórz w przeglądarce; przełącznik Pętla/Monogram/Klasyk na górze nakłada wybrany branding na ekran logowania i interfejs. Wybrany kierunek: **Pętla**. Plik używa wewnętrznego runtime (`support.js`) tylko do podglądu — NIE przenoś runtime do aplikacji.
- `screens/01-logo-kierunki.png` — trzy kierunki znaku side-by-side.
- `screens/02-login.png` — przeprojektowany ekran logowania (kierunek Pętla).
- `screens/03-interface.png` — odświeżony interfejs: sidebar (z przyciskami Mój panel / Admin / Wyloguj), stół, plakietka kontraktu z licznikami NS/EW.
- `icons/icon-512.png` — ikona aplikacji 512×512 px (App Store / PWA).
- `icons/icon-192.png` — ikona PWA 192×192 px.
- `icons/favicon-32.png` — favicon 32×32 px.
- `icons/favicon-16.png` — favicon 16×16 px.

## Fidelity
**High-fidelity (hifi).** Kolory, typografia, odstępy i stany są finalne. Odtwórz UI 1:1 używając bibliotek/wzorców istniejącego kodu.

---

## Design Tokens

### Marka — kierunek „Pętla"
| Token | Hex | Zastosowanie |
|---|---|---|
| `--brand-bg` | `#0b1220` | tło aplikacji (granat) |
| `--brand-panel` | `#131c2e` | karty / panele / sidebar |
| `--brand-soft` | `#1b2740` | pola input, tła hover, chip, przyciski drugorzędne |
| `--brand-line` | `rgba(255,255,255,.09)` | obramowania / separatory |
| `--brand-text` | `#e8edf5` | tekst podstawowy |
| `--brand-dim` | `#8a97ad` | tekst drugorzędny / podpisy |
| `--brand-accent` | `#10b981` | akcent główny (przyciski CTA, aktywne elementy, border kontraktu) |
| `--brand-accent-soft` | `#34d399` | akcent jaśniejszy (wordmark „Loop", linki, przycisk Mój panel) |
| `--brand-accent-2` | `#fbbf24` | amber — wyróżnienia (★ Rekomendowane, kropki statusu, przycisk Admin) |
| `--brand-btn-text` | `#04130c` | tekst na wypełnionych przyciskach CTA |
| `--brand-felt` | `#155640` | zielone sukno stołu |
| `--brand-danger` | `#e0524d` | destrukcyjne akcje (przycisk Wyloguj) |

Wzór kropek sukna: `background-image: radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px); background-size: 18px 18px;`

### Kolory figur w panelu rozdania (4-color deck)
Stosować WSZĘDZIE gdzie pokazywane są karty/figury: ręce graczy, tabela licytacji, kontrakt.

| Figura | Na panelu kart (`--brand-panel`) | Na ciemnych wierszach licytacji |
|---|---|---|
| ♠ Pik | `#5b9be8` | `#5b9be8` |
| ♥ Kier | `#e0524d` | `#ff6b6b` |
| ♦ Karo | `#df8a2e` | `#f0a44a` |
| ♣ Trefl | `#36ad63` | `#4cc97e` |

Zalecana implementacja jako stała/mapa:
```js
const SUIT_COLORS = {
  panel:   { spade: '#5b9be8', heart: '#e0524d', diamond: '#df8a2e', club: '#36ad63' },
  bidding: { spade: '#5b9be8', heart: '#ff6b6b', diamond: '#f0a44a', club: '#4cc97e' },
};
```

**Uwaga:** w logo BridgeLoop (znak Pętla) kolory figur są markowe (jasne piki/trefle + czerwone kiery/kara) — NIE używaj schematu 4-kolorowego w samym logo.

### Typografia
- **Display / nagłówki / wordmark / cyfry:** `Space Grotesk` (500/600/700)
- **Tekst UI / body:** `Manrope` (400/500/600/700)
- **Etykiety techniczne / mono:** `IBM Plex Mono` (500/600)

Google Fonts import:
```
https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap
```

Skala typografii (klucz):
| Element | Font | Rozmiar/waga | Tracking |
|---|---|---|---|
| Wordmark duży | Space Grotesk 700 | 64px / line 1 | `-0.03em` |
| Wordmark w sidebarze | Space Grotesk 700 | 16px | `-0.02em` |
| Wordmark na logowaniu | Space Grotesk 700 | 22px | `-0.02em` |
| Nagłówek sekcji (mono) | IBM Plex Mono 600 | 13px | `0.22em`, UPPERCASE |
| Etykieta pola | Manrope 600 | 11px | — |
| Przycisk CTA | Space Grotesk 700 | 14px | — |
| Przyciski sidebar (Mój panel/Admin/Wyloguj) | Manrope 600 | 10px | — |
| Cyfry kart w ręce | Manrope 600 | 13px / line 1.7 | — |
| Liczniki lew NS/EW — wartość | Space Grotesk 700 | 16px | — |
| Liczniki lew NS/EW — etykieta | Manrope 700 | 8px | `0.1em`, UPPERCASE |

### Promienie / cienie
- Karty/panele: `border-radius: 18px` (główne), `12px` (plakietka kontraktu), `11px` (panele rąk), `9px` (inputy/przyciski CTA), `7px` (przyciski sidebar).
- Ikona aplikacji: `border-radius: 22%` boku (≈ 113px przy 512px).
- Cień karty logowania: `box-shadow: 0 24px 60px rgba(0,0,0,.5)`.

---

## Logo — kierunek „Pętla"

Koncept: **cztery kolory kart krążące po pętli** — symbol nauki przez powtarzanie (SRS). Zbudowane z prymitywów CSS + glifów Unicode (♠ ♥ ♦ ♣). Gotowe pliki PNG w `icons/`.

### Znak (mark), wersja ~150px
- Kontener `position:relative; width:150px; height:150px`.
- **Pierścień:** `position:absolute; inset:16px; border-radius:50%; border:2px solid rgba(52,211,153,.45)`.
- **Grot pętli** przy ~1 godz. zegara: mały trójkąt CSS, kolor `#34d399`, `transform: rotate(132deg)` (border-trick).
- **Cztery figury** N/E/S/W pierścienia, font-size 30px: góra ♠ `#cfe9df`, prawo ♦ `#e0524d`, dół ♣ `#cfe9df`, lewo ♥ `#e0524d`.
- **Środek:** kropka amber `width:9px; height:9px; border-radius:50%; background:#fbbf24`.

### Wariant poziomy (lockup)
`[mini-znak 40px]  Bridge` (kolor `--brand-text`) `Loop` (kolor `#34d399`) — Space Grotesk 700, tracking `-0.02em`; poniżej `SYSTEM SRS` — Manrope 600, 9px, UPPERCASE, tracking `0.2em`, kolor `--brand-dim`.

### Ikony aplikacji (gotowe pliki)
| Plik | Rozmiar | Zastosowanie |
|---|---|---|
| `icons/icon-512.png` | 512×512 | App Store, PWA manifest `512×512` |
| `icons/icon-192.png` | 192×192 | PWA manifest `192×192` |
| `icons/favicon-32.png` | 32×32 | `<link rel="icon" sizes="32x32">` |
| `icons/favicon-16.png` | 16×16 | `<link rel="icon" sizes="16x16">` |

HTML do dodania w `<head>`:
```html
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png">
<link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png">
```

PWA manifest (`manifest.json`):
```json
{
  "name": "BridgeLoop",
  "short_name": "BridgeLoop",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#0b1220",
  "background_color": "#0b1220",
  "display": "standalone"
}
```

---

## Screens / Views

### 1. Ekran logowania
- **Cel:** logowanie / zakładanie konta.
- **Layout:** wycentrowana karta `width: 300px` na tle `--brand-bg` z kropkowanym wzorem.
- **Karta:** `background: --brand-panel; border: 1px solid --brand-line; border-radius: 18px; padding: 26px 24px; box-shadow: 0 24px 60px rgba(0,0,0,.5)`.
- **Zawartość (od góry):**
  1. Znak „Pętla" 54px, wycentrowany.
  2. Wordmark `BridgeLoop` (Space Grotesk 700 22px; „Loop" w `#34d399`), wycentrowany.
  3. Tagline: „System SRS — nauka przez powtarzanie" — Manrope 500 11px `--brand-dim`.
  4. Zakładki: **Zaloguj się** (aktywna: border-bottom 2px `--brand-accent`) / **Utwórz konto** (`--brand-dim`).
  5. Pole „Adres e-mail" — etykieta Manrope 600 11px `--brand-dim`; input `background: --brand-soft; border: 1px solid --brand-line; border-radius: 9px; padding: 11px 13px`.
  6. Wiersz „Hasło" + link „Nie pamiętasz hasła?" (`#34d399`, po prawej). Input hasła analogiczny.
  7. Przycisk **Zaloguj się** — `background: --brand-accent; color: --brand-btn-text; border-radius: 9px; padding: 12px`; Space Grotesk 700 14px.
  8. Stopka: „Nowe konta wymagają akceptacji administratora przed pełnym dostępem." — Manrope 400 10px `--brand-dim`.
- **Stany:** focus inputu → `border-color: --brand-accent`. Hover przycisku → `background: --brand-accent-soft`.

### 2. Interfejs aplikacji (odświeżenie brandingu)
Układ bez zmian — tylko nowe logo, kolory akcentu i kolory figur.

**Sidebar (`width: ~248px`, `background: --brand-panel`, `border-right: 1px solid --brand-line`):**

*Sekcja logo:*
- Mini-znak 34px + wordmark `BridgeLoop` (Space Grotesk 700 16px) + „System SRS" (`--brand-dim`).

*Sekcja użytkownika (border-top + border-bottom `--brand-line`):*
- Avatar-kółko 26px (`--brand-soft`, inicjał w `--brand-accent-soft`) + „redds / Administrator".
- Trzy przyciski w jednym wierszu (`display:flex; gap:5px`):
  - **Mój panel** — `background: --brand-soft; color: --brand-accent-soft; border: 1px solid --brand-line; border-radius: 7px`.
  - **Admin** — `background: --brand-soft; color: --brand-accent-2; border: 1px solid --brand-line; border-radius: 7px`.
  - **Wyloguj** — `background: rgba(224,82,77,.12); color: #e0524d; border: 1px solid rgba(224,82,77,.3); border-radius: 7px`.
  - Wszystkie: Manrope 600 10px, `padding: 5px 4px`, `flex: 1`.

*Box „Rekomendowane na dziś":* `--brand-soft`, etykieta amber `--brand-accent-2`, UPPERCASE.

*Lista ćwiczeń:* kropka statusu (amber = aktywne/powtórka, `--brand-dim` = nowe), tytuł `--brand-text`, trudność „Easy" w `--brand-accent-soft`. Aktywna pozycja: `background: --brand-soft`.

**Stół (`background: --brand-felt` + wzór kropek):**

*Tabela licytacji (prawy-górny róg):*
- Nagłówek `W N E S`, wiersze odzywek. Figury wg kolumny `bidding` tabeli 4-kolorowej. „Pas" w `rgba(255,255,255,.45)`.

*Ręce N/W/E/S w układzie krzyża:*
- Panel: `--brand-panel; border: 1px solid --brand-line; border-radius: 11px; padding: 11px 13px`.
- 4 wiersze (♠/♥/♦/♣ + karty), figury wg kolumny `panel`. Ukryte karty: `? ? ? ?` w `rgba(255,255,255,.35)`.

*Plakietka kontraktu (prawy-dolny róg):*
- **⚠ WAŻNE — pozycjonowanie:** plakietka kontraktu musi być umieszczona tak, żeby **nie najeżdżała na żadne z 4 pól kart** (N/W/E/S). W prawym dolnym rogu jest wolne miejsce (poza zasięgiem rąk W i S) — tam należy ją osadzić. Jeśli układ jest ciasny, należy zmniejszyć padding lub przesunąć plakietkę, ale nigdy nie może przykrywać pól z kartami.
- `background: --brand-panel; border: 1px solid --brand-accent; border-radius: 12px; padding: 12px 16px; min-width: 140px; max-width: 150px`.
- Etykieta „KONTRAKT" (IBM Plex Mono 700 8px `--brand-dim` UPPERCASE).
- Wartość np. `6♥ S` (Space Grotesk 700 22px; figura wg schematu panel, oznaczenie strony w `--brand-accent-soft`).
- Podpis kierunkowy (Południe/Zachód/...) — Manrope 400 9px `--brand-dim`.
- **Liczniki lew** (border-top `--brand-line`, `padding-top: 8px`, `display: flex; gap: 6px`):
  - Dwa kafelki NS i EW (`background: --brand-soft; border-radius: 6px; padding: 5px; flex: 1; text-align: center`).
  - Etykieta NS/EW: Manrope 700 8px `--brand-dim` UPPERCASE.
  - Wartość: Space Grotesk 700 16px `--brand-text`.

---

## Mobile — co zachować bez zmian

**Wersja mobilna działa poprawnie — rebranding nie może jej zepsuć.**

Zmiany brandingowe (logo, kolory, typografia, ikony) aplikować na wszystkich breakpointach. Natomiast **układ i widoczność elementów na mobile zostawić dokładnie tak jak jest** — nie dodawać nowych reguł `display:none` ani nie zmieniać istniejących breakpointów.

Jeśli aplikacja ukrywa elementy na małych ekranach (np. sidebar, tabela licytacji, część przycisków), te reguły mają pozostać niezmienione. Przykładowe elementy, które mogą być ukryte na mobile — zachować ich obecne zachowanie:
- sidebar z listą ćwiczeń,
- tabela licytacji (prawy-górny róg stołu),
- przyciski Mój panel / Admin (mogą być schowane lub zwinięte),
- etykiety kierunków przy rękach (N/W/E/S).

**Zasada:** jeśli coś działa na mobile przed rebrandingiem, musi działać tak samo po. Wszelkie wątpliwości co do breakpointów — najpierw sprawdzić w istniejącym kodzie, nie zgadywać.

---

## Interactions & Behavior
- Przełączanie zakładek logowania (Zaloguj / Utwórz konto) — bez przeładowania.
- Przyciski Mój panel / Admin / Wyloguj — zachowanie bez zmian względem obecnej aplikacji.
- Hover na pozycjach listy w sidebarze → `background: --brand-soft`.
- Hover na przyciskach akcent → `background: --brand-accent-soft; transition: ~0.18s ease`.
- Reszta zachowań (rozgrywka, licytacja, punkty decyzji, liczniki lew) bez zmian.

## State Management
Bez nowego stanu. Schemat kolorów figur to czysta warstwa prezentacji. Zalecana implementacja: `SUIT_COLORS[context][suit]` używana we wszystkich komponentach renderujących figury.

---

## Assets — podsumowanie struktury paczki
```
design_handoff_bridgeloop/
├── README.md                     ← ten plik
├── BridgeLoop Brand.dc.html      ← interaktywna referencja (otwórz w przeglądarce)
├── support.js                    ← runtime podglądu (NIE do aplikacji)
├── icons/
│   ├── icon-512.png              ← ikona aplikacji 512×512
│   ├── icon-192.png              ← ikona PWA 192×192
│   ├── favicon-32.png            ← favicon 32×32
│   └── favicon-16.png            ← favicon 16×16
└── screens/
    ├── 01-logo-kierunki.png      ← 3 kierunki znaku (wybrany: Pętla)
    ├── 02-login.png              ← ekran logowania
    └── 03-interface.png          ← interfejs z sidebare'm i stołem
```

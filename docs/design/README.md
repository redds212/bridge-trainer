# Handoff: BridgeLoop — rebranding trenażera brydżowego

## Overview
Zmiana marki istniejącej aplikacji do nauki brydża (obecnie „Trenażer Brydżowy / System SRS", host: `redds212.github.io`) na **BridgeLoop**. Pakiet zawiera:
- system logo (wybrany kierunek: **Pętla**) — znak, wariant poziomy, ikona aplikacji,
- przeprojektowany **ekran logowania**,
- **odświeżenie brandingu interfejsu** (sidebar + stół z rozdaniem),
- nowy **4-kolorowy schemat figur** w panelu rozdania.

To NIE jest pełny redesign UX — istniejące układy i funkcje zostają. Zmieniamy nazwę, logo, kolory akcentu, typografię oraz kolory figur w rozdaniu.

## About the Design Files
Plik `BridgeLoop Brand.dc.html` to **referencja projektowa stworzona w HTML** — prototyp pokazujący docelowy wygląd, a nie kod produkcyjny do skopiowania. Zadaniem jest **odtworzenie tego wyglądu w istniejącym środowisku aplikacji** (frameworku/stacku, którego używa `redds212.github.io`), z wykorzystaniem jej obecnych wzorców i komponentów. Plik `.dc.html` używa wewnętrznego runtime (`support.js`) wyłącznie do podglądu — nie przenoś tego runtime do aplikacji. Interesuje nas zawartość: style inline, wartości kolorów, struktura.

## Fidelity
**High-fidelity (hifi).** Kolory, typografia, odstępy i stany są finalne. Odtwórz UI 1:1, używając bibliotek/wzorców istniejącego kodu.

---

## Design Tokens

### Marka — kierunek „Pętla"
| Token | Hex | Zastosowanie |
|---|---|---|
| `--brand-bg` | `#0b1220` | tło aplikacji (granat) |
| `--brand-panel` | `#131c2e` | karty / panele / sidebar |
| `--brand-soft` | `#1b2740` | pola input, tła hover, chip |
| `--brand-line` | `rgba(255,255,255,.09)` | obramowania / separatory |
| `--brand-text` | `#e8edf5` | tekst podstawowy |
| `--brand-dim` | `#8a97ad` | tekst drugorzędny / podpisy |
| `--brand-accent` | `#10b981` | akcent główny (przyciski, aktywne) |
| `--brand-accent-soft` | `#34d399` | akcent jaśniejszy (wordmark „Loop", linki) |
| `--brand-accent-2` | `#fbbf24` | amber — wyróżnienia („Rekomendowane na dziś", kropki statusu) |
| `--brand-btn-text` | `#04130c` | tekst na przyciskach z akcentem |
| `--brand-felt` | `#155640` | zielone sukno stołu |

Wzór kropek sukna: `background-image: radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px); background-size: 18px 18px;`

### Kolory figur w panelu rozdania (4-color deck)
Stosować WSZĘDZIE, gdzie pokazywane są karty/figury: ręce graczy, tabela licytacji, kontrakt.

| Figura | Hex (na panelu `#131c2e`) | Hex (na ciemnych wierszach licytacji) |
|---|---|---|
| ♠ Pik | `#5b9be8` (niebieski) | `#5b9be8` |
| ♥ Kier | `#e0524d` (czerwony) | `#ff6b6b` |
| ♦ Karo | `#df8a2e` (ciemnopomarańczowy) | `#f0a44a` |
| ♣ Trefl | `#36ad63` (zielony) | `#4cc97e` |

Uwaga: w licytacji na ciemniejszym tle używamy jaśniejszych wariantów kieru/karo/trefla (większy kontrast). Pik bez zmian.

### Typografia
- **Display / nagłówki / wordmark / cyfry kart:** `Space Grotesk` (500/600/700)
- **Tekst UI / body:** `Manrope` (400/500/600/700)
- **Etykiety techniczne / kody:** `IBM Plex Mono` (500/600)
- Import: `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap`

Skala typografii (klucz):
| Element | Font | Rozmiar/waga | Tracking |
|---|---|---|---|
| Wordmark duży | Space Grotesk 700 | 64px / line 1 | `-0.03em` |
| Wordmark w sidebarze | Space Grotesk 700 | 16px | `-0.02em` |
| Wordmark na logowaniu | Space Grotesk 700 | 22px | `-0.02em` |
| Nagłówek sekcji (mono) | IBM Plex Mono 600 | 13px | `0.22em`, UPPERCASE |
| Tekst body | Manrope 400 | 18px / line 1.6 | — |
| Etykieta pola | Manrope 600 | 11px | — |
| Przycisk | Space Grotesk 700 | 14px | — |
| Cyfry kart w ręce | Manrope 600 | 13px / line 1.7 | — |

### Promienie / cienie
- Karty/panele: `border-radius: 18px` (główne), `12px` (panele rąk), `9px` (inputy/przyciski).
- Ikona aplikacji: `border-radius: 16px` (przy 64px) ≈ 22–25% boku.
- Cień karty logowania: `0 24px 60px rgba(0,0,0,.5)`.
- Cień ikony aplikacji: `0 5px 14px rgba(0,0,0,.45)`.

---

## Logo — kierunek „Pętla"

Koncept: **cztery kolory kart krążące po pętli** (symbol nauki przez powtarzanie / SRS). Zbudowane w całości z prymitywów CSS + glify Unicode figur (♠ ♥ ♦ ♣) — bez plików rastrowych. Można odtworzyć jako komponent albo wyeksportować do SVG (patrz „Assets").

### Znak (mark), wersja ~150px
- Kontener `position:relative; width:150px; height:150px`.
- **Pierścień:** `position:absolute; inset:16px; border-radius:50%; border:2px solid rgba(52,211,153,.45)`.
- **Grot pętli** (trójkąt sugerujący ruch): mały trójkąt CSS przy górno-prawej krawędzi pierścienia, kolor `#34d399`, `transform: rotate(132deg)`. (border-trick: `border-left:6px solid transparent; border-right:6px solid transparent; border-bottom:10px solid #34d399`).
- **Cztery figury** rozmieszczone na N/E/S/W pierścienia, font-size 30px:
  - góra ♠ `#cfe9df`, prawo ♦ `#e0524d`, dół ♣ `#cfe9df`, lewo ♥ `#e0524d`.
  - (Uwaga: w SAMYM LOGO figury zostają w wersji markowej — jasne piki/trefle + czerwone kier/karo. 4-kolorowy schemat dotyczy panelu rozdania, nie logo.)
- **Środek:** kropka amber `width:9px; height:9px; border-radius:50%; background:#fbbf24`.

### Wariant poziomy (lockup)
`[mini-znak 40px]  Bridge` (kolor `--brand-text`) `Loop` (kolor `#34d399`) — Space Grotesk 700, tracking `-0.02em`; pod spodem `SYSTEM SRS` — Manrope 600, 9px, UPPERCASE, tracking `0.2em`, kolor `--brand-dim`.

### Ikona aplikacji (app icon)
Ciemny kafelek `#0a130f`, `border-radius:16px`, w środku uproszczony znak (pierścień + ♠ u góry `#cfe9df`, ♥ u dołu `#e0524d`, kropka amber w centrum). Wariant favicon = ta sama kompozycja w 32px.

---

## Screens / Views

### 1. Ekran logowania
- **Cel:** logowanie / zakładanie konta.
- **Layout:** wycentrowana karta `width:300px` na tle `--brand-bg` z kropkowanym wzorem (`radial-gradient` 1px co 20px).
- **Karta:** `background:--brand-panel; border:1px solid --brand-line; border-radius:18px; padding:26px 24px; box-shadow:0 24px 60px rgba(0,0,0,.5)`.
- **Zawartość (od góry):**
  1. Znak „Pętla" 54px, wycentrowany.
  2. Wordmark `BridgeLoop` (Space Grotesk 700, 22px; „Loop" w `#34d399`), wycentrowany.
  3. Podpis: „System SRS — nauka przez powtarzanie" — Manrope 500, 11px, `--brand-dim`.
  4. Zakładki: **Zaloguj się** (aktywna: underline 2px `--brand-accent`) / **Utwórz konto** (`--brand-dim`).
  5. Pole „Adres e-mail" — etykieta Manrope 600 11px `--brand-dim`; input `background:--brand-soft; border:1px solid --brand-line; border-radius:9px; padding:11px 13px`; placeholder „np. jan@example.com" (`#6b788c`).
  6. Wiersz „Hasło" + link „Nie pamiętasz hasła?" (`#34d399`, po prawej). Input hasła analogiczny.
  7. Przycisk **Zaloguj się** — `background:--brand-accent; color:--brand-btn-text; border-radius:9px; padding:12px`; Space Grotesk 700 14px.
  8. Stopka: „Nowe konta wymagają akceptacji administratora przed pełnym dostępem." — Manrope 400 10px `--brand-dim`, wycentrowana.
- **Stany:** focus inputu → `border-color:--brand-accent`. Hover przycisku → lekkie pojaśnienie (np. `#34d399`).

### 2. Interfejs aplikacji (odświeżenie brandingu)
Układ bez zmian względem obecnej aplikacji — tylko nowe logo, kolory akcentu i kolory figur.

**Sidebar (szer. ~248px, `--brand-panel`, prawy `border` `--brand-line`):**
- Góra: mini-znak 34px + wordmark `BridgeLoop` (16px) + „System SRS" (`--brand-dim`).
- Wiersz użytkownika: avatar-kółko (`--brand-soft`, inicjał w `--brand-accent-soft`) + „redds / Administrator" + link „Panel" (`--brand-accent-soft`).
- Box „★ Rekomendowane na dziś (N)": `--brand-soft`, etykieta w `--brand-accent-2` (amber), UPPERCASE.
- Nagłówek sekcji „ROZGRYWAJĄCY" (Manrope 700, 9px, tracking `0.14em`, `--brand-dim`).
- Lista pozycji: kropka statusu (amber `--brand-accent-2` = aktywne/powtórka, `--brand-dim` = nowe), tytuł `--brand-text`, podpis trudność/typ; trudność „Easy" w `--brand-accent-soft`. Aktywna pozycja: tło `--brand-soft`.

**Stół (`--brand-felt` + kropki):**
- **Tabela licytacji** (prawy-górny róg): nagłówek `W N E S`, wiersze odzywek. Figury wg 4-kolorowego schematu (warianty „licytacja"). „Pas" w `rgba(255,255,255,.45)`.
- **Ręce N / W / E / S** w układzie krzyża; panel ręki: `--brand-panel`, `border:1px solid --brand-line`, `border-radius:11px`, `padding:11px 13px`; cztery wiersze (♠/♥/♦/♣ + karty), figury wg 4-kolorowego schematu (warianty „panel"). Ręce ukryte: `? ? ? ?` w `rgba(255,255,255,.35)`.
- **Plakietka kontraktu** (prawy-dolny róg): `--brand-panel`, `border:1px solid --brand-accent`, `border-radius:12px`; etykieta „KONTRAKT" (mono, `--brand-dim`), wartość np. `6♥ S` (Space Grotesk 700 22px; figura wg schematu, oznaczenie strony w `--brand-accent-soft`), podpis „Południe".

---

## Interactions & Behavior
- Przełączanie zakładek logowania (Zaloguj / Utwórz konto) — bez przeładowania.
- Hover na pozycjach listy w sidebarze → tło `--brand-soft`.
- Hover na przyciskach → pojaśnienie akcentu, transition `~0.18s ease`.
- Reszta zachowań (rozgrywka, licytacja, punkty decyzji) bez zmian względem obecnej aplikacji.

## State Management
Bez nowego stanu wynikającego z rebrandingu. Schemat kolorów figur to czysta warstwa prezentacji — najlepiej jako mapa `suitColors[suit][context]` (context: `panel` | `bidding`) używana wszędzie, gdzie renderowane są figury.

## Assets
- Brak plików graficznych — logo zbudowane z CSS + Unicode (♠ ♥ ♦ ♣). W razie potrzeby pliku: wyeksportować znak/ikonę do SVG/PNG na bazie opisu w sekcji „Logo".
- Fonty: Google Fonts (Space Grotesk, Manrope, IBM Plex Mono) — patrz link importu.
- `uploads/a12.png` (w projekcie źródłowym) — referencja kolorów figur od użytkownika.

## Files
- `BridgeLoop Brand.dc.html` — kompletna referencja: 3 kierunki logo (użyć **Pętla**), ekran logowania, interfejs, schemat figur. Otwiera się w przeglądarce; przełącznik „Pętla / Monogram / Klasyk" pokazuje markę na ekranach (wybrany: **Pętla**).
- `support.js` — runtime tylko do podglądu pliku `.dc.html`; NIE używać w aplikacji.

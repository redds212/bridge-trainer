# 🃏 Interaktywny Trenażer Brydżowy SRS

Aplikacja SPA do nauki brydża oparta na systemie powtórek rozłożonych w czasie (Spaced Repetition System). Działa jak interaktywna książka z rozdaniami — uczysz się przez odtwarzanie sekwencji lew, podejmowanie decyzji i samoocenę.

## Funkcje

- **Stół brydżowy** z klasycznym układem N/S/E/W na zielonym suknie
- **Mechanika flashcard**: odtwarzanie wstępu lewia po lewi, Moment Decyzji, odsłonięcie rozwiązania
- **System SRS** (zapisywany w `localStorage`):
  - Statusy: `NOWE → NAUKA → POWTÓRKA → OPANOWANE`
  - Interwały: 3 dni → 7 dni → 21 dni → Archiwum
- **Sekcja "Rekomendowane na dziś"** — automatyczny filtr rozdań do powtórki
- **Tabela licytacji** i **box kontraktu** nakładkowe na stole

## Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 3](https://tailwindcss.com/)

## Uruchomienie

> **Wymagania:** Node.js 18+

```bash
# instalacja zależności (tylko za pierwszym razem)
npm install

# tryb developerski (http://localhost:5174)
npm run dev

# build produkcyjny
npm run build
```

## Struktura projektu

```
src/
├── components/
│   ├── BridgeTable.tsx    # stół z układem N/S/E/W
│   ├── HandDisplay.tsx    # wyświetlanie ręki (jawna / zakryta)
│   ├── TrickDisplay.tsx   # centrum stołu z lewią
│   ├── BiddingTable.tsx   # tabela licytacji
│   ├── ContractBox.tsx    # box kontraktu + wynik lew
│   ├── ControlPanel.tsx   # RESTART / POPRZEDNI / NEXT
│   ├── DecisionPanel.tsx  # panel samooceny SRS
│   └── Sidebar.tsx        # indeks rozdań
├── hooks/
│   ├── useSRS.ts          # logika SRS + localStorage
│   └── useGameState.ts    # stan gry (fazy intro→decision→revealed→rated)
├── data/
│   └── dealsMock.json     # przykładowe rozdania
└── types/
    └── index.ts           # typy TypeScript
```

## Dodawanie rozdań

Rozdania definiowane są w `src/data/dealsMock.json`. Minimalna struktura:

```json
{
  "id": "deal-XXX",
  "title": "Tytuł rozdania",
  "category": "Rozgrywający",
  "difficulty": "Medium",
  "contract": "3NT",
  "declarer": "S",
  "dealer": "W",
  "vulnerability": "None",
  "bidding": [["1NT", "P", "3NT", "P"], ["P", "P"]],
  "initialHands": {
    "N": { "S": "...", "H": "...", "D": "...", "C": "..." },
    "S": { "S": "...", "H": "...", "D": "...", "C": "..." },
    "E": { "hidden": true },
    "W": { "hidden": true }
  },
  "introSequence": [
    { "trick": 1, "leader": "W", "cards": { "W": "S5", "N": "S3", "E": "SJ", "S": "SA" }, "winner": "S" }
  ],
  "decisionPrompt": "Treść pytania dla uczącego się...",
  "solution": {
    "text": "Wyjaśnienie optymalnego rozegrania...",
    "revealAllCards": {
      "E": { "S": "...", "H": "...", "D": "...", "C": "..." },
      "W": { "S": "...", "H": "...", "D": "...", "C": "..." }
    }
  }
}
```

## Licencja

MIT

import { useState } from 'react';
import type { Deal, Difficulty, SRSEntry, SRSStatus } from '../types';
import { AuthProvider } from '../auth/AuthContext';
import { Sidebar } from '../components/Sidebar';
import mockDeals from '../data/dealsMock.json';

/**
 * Dev-only harness: montuje sam panel boczny na syntetycznej bibliotece, bez
 * logowania — żeby dało się iterować nad filtrami i zwijaniem rekomendacji, i robić
 * zrzuty. Wchodzi przez `?preview=sidebar` w trybie dev; produkcyjny build nie
 * importuje tego pliku (dynamiczny import w main.tsx).
 *
 * `Sidebar` woła `useAuth`, więc `AuthProvider` jest obowiązkowy — bez sesji pasek
 * użytkownika po prostu się nie renderuje, a reszta panelu działa normalnie.
 */

const CATEGORIES = ['Wistowanie', 'Rozgrywka', 'Licytacja'];
const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard', 'Expert'];
const STATUSES: SRSStatus[] = ['NEW', 'LEARNING', 'REVIEW', 'MASTERED'];

// Panel czyta z rozdania tylko id/title/category/difficulty, ale klonujemy pełne
// mocki, żeby obiekty pozostały prawdziwymi `Deal` — bez rzutowań na siłę.
const base = mockDeals as unknown as Deal[];
const deals: Deal[] = Array.from({ length: 12 }, (_, i) => ({
  ...base[i % base.length],
  id: `preview-${i}`,
  title: `Rozdanie ${101 + i} — ${['wyciąganie atutów', 'impas', 'przebitka', 'wistowanie w bezatu'][i % 4]}`,
  category: CATEGORIES[i % CATEGORIES.length],
  difficulty: DIFFICULTIES[i % DIFFICULTIES.length],
}));

const entry = (id: string): SRSEntry => ({
  status: STATUSES[Number(id.split('-')[1]) % STATUSES.length],
  consecutiveCorrect: 0,
  interval: 1,
  nextReviewDate: null,
  lastSeen: null,
});

export function SidebarPreview() {
  const [selectedId, setSelectedId] = useState<string | null>(deals[0].id);
  const [query, setQuery] = useState('');
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);

  return (
    <AuthProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-brand-bg">
        <Sidebar
          deals={deals}
          todayDeals={deals.slice(0, 5)}
          selectedId={selectedId}
          getEntry={entry}
          onSelect={setSelectedId}
          query={query}
          onQueryChange={setQuery}
          difficulties={difficulties}
          onToggleDifficulty={d =>
            setDifficulties(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]))
          }
          onPanel={() => {}}
        />
        <div className="flex-1 p-4 text-brand-dim text-xs font-mono">
          <div className="text-brand-accent-2 uppercase tracking-wider mb-2">preview: sidebar</div>
          <div>trudność: {difficulties.length ? difficulties.join(', ') : '(wszystkie)'}</div>
          <div>fraza: {query || '(pusta)'}</div>
          <div>wybrane: {selectedId ?? '—'}</div>
        </div>
      </div>
    </AuthProvider>
  );
}

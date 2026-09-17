import { useEffect, useState } from 'react';
import type { Deal, Difficulty, SRSEntry, UserSettings } from '../types';
import { AuthProvider } from '../auth/AuthContext';
import { TrainerApp } from '../App';
import { UserPanel } from '../components/UserPanel';
import { useSRS } from '../hooks/useSRS';
import { useHistory } from '../hooks/useHistory';
import { useDailySession } from '../hooks/useDailySession';
import { addDaysKey } from '../lib/date';
import mockDeals from '../data/dealsMock.json';

/**
 * Dev-only harness: sesja dzienna i dodatkowa partia na prawdziwych hookach, bez
 * logowania. `useSRS`, `useHistory` i `useDailySession` z `userId = null` pracują
 * wyłącznie w pamięci (zapisy do Supabase są pomijane), więc cały przepływ — start,
 * odpowiedzi, pauza, ukończenie, „Wylosuj partię", panel — da się przeklikać i zmierzyć.
 * Wchodzi przez `?preview=session`; produkcyjny build nie importuje tego pliku.
 * Odświeżenie strony zaczyna wszystko od zera.
 */

const KINDS = ['nowe', 'zaległe', 'później'] as const;
const kindOf = (i: number) => KINDS[Math.min(2, Math.floor(i / 4))];

const base = mockDeals as unknown as Deal[];
const deals: Deal[] = Array.from({ length: 12 }, (_, i) => ({
  ...base[i % base.length],
  id: `preview-${i}`,
  title: `Rozdanie ${101 + i} — ${kindOf(i)}`,
  category: ['Wistowanie', 'Rozgrywka', 'Licytacja'][i % 3],
  // Bez sekwencji wstępu jedno NEXT prowadzi prosto do momentu decyzji.
  introSequence: [],
}));

/** Stan SRS na starcie: po cztery nowe, zaległe powtórki i powtórki zaplanowane na później. */
function seedEntry(i: number): SRSEntry | null {
  if (kindOf(i) === 'nowe') return null;
  return {
    status: 'REVIEW',
    consecutiveCorrect: 1,
    interval: 3,
    nextReviewDate: addDaysKey(kindOf(i) === 'zaległe' ? -1 : 5),
    lastSeen: new Date(Date.now() - 4 * 86_400_000).toISOString(),
  };
}

export function SessionPreview() {
  return (
    <AuthProvider>
      <Harness />
    </AuthProvider>
  );
}

function Harness() {
  const srs = useSRS(null);
  const history = useHistory(null);
  const [settings, setSettings] = useState<UserSettings>({ dailyTarget: 5, mode: 'balanced', timedMode: false });
  const [view, setView] = useState<'trainer' | 'panel'>('trainer');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);

  const session = useDailySession({
    userId: null,
    deals,
    store: srs.store,
    storeLoading: srs.loading,
    settings,
    applyResult: srs.applyResult,
    recordHistory: history.record,
  });

  // Rozstawia SRS, gdy magazyn jest pusty: na starcie i po „Usuń postępy". Warunek,
  // a nie jednorazowy efekt, bo HMR odpala efekty ponownie i nadpisywał odpowiedzi.
  const { setEntry } = srs;
  const emptyStore = Object.keys(srs.store).length === 0;
  useEffect(() => {
    if (!emptyStore) return;
    deals.forEach((d, i) => {
      const entry = seedEntry(i);
      if (entry) setEntry(d.id, entry);
    });
  }, [emptyStore, setEntry]);

  // Stan do pomiarów z konsoli (`window.__preview`) — zrzuty bywają zamrożone, DOM i dane nie.
  useEffect(() => {
    Object.assign(window, { __preview: { session, store: srs.store, attempts: history.attempts, selectedId } });
  });

  if (view === 'panel') {
    return (
      <UserPanel
        deals={deals}
        store={srs.store}
        settings={settings}
        updateSettings={patch => setSettings(s => ({ ...s, ...patch }))}
        attempts={history.attempts}
        stats={history.stats}
        onReplay={id => { session.pause(); setSelectedId(id); setView('trainer'); }}
        pausedSession={session.pausedSession}
        pausedProgress={session.pausedProgress}
        extraSize={session.extraSize}
        onStartSession={() => { session.start(); setView('trainer'); }}
        onStartExtra={() => { session.startExtra(); setView('trainer'); }}
        onResumeSession={() => { session.resume(); setView('trainer'); }}
        onDiscardSession={session.discard}
        onClearHistory={history.clear}
        onResetProgress={async () => { await srs.clearAll(); history.clear(); }}
        onBack={() => setView('trainer')}
      />
    );
  }

  const openPanel = () => { session.pause(); setView('panel'); };
  const devButton = 'rounded-[7px] border border-brand-line bg-brand-panel/90 px-2 py-1 font-mono text-[10px] text-brand-dim';

  return (
    <>
      <TrainerApp
        deals={deals}
        selectedId={selectedId}
        onSelectId={setSelectedId}
        srs={srs}
        recordHistory={history.record}
        session={session}
        timedMode={settings.timedMode}
        dealQuery={query}
        onDealQueryChange={setQuery}
        dealDifficulties={difficulties}
        onToggleDifficulty={d => setDifficulties(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]))}
        onPanel={openPanel}
      />
      <div className="fixed bottom-2 right-2 z-[60] flex gap-1">
        {/* Bez zalogowanego konta panel boczny nie ma paska użytkownika, a z nim
            przycisku „Mój panel" — ten robi to samo. */}
        <button onClick={openPanel} className={devButton}>preview: panel</button>
        {/* Ekran powitalny pokazuje się tylko bez wybranego rozdania — w aplikacji po
            świeżym wczytaniu. Tu wystarczy odznaczyć rozdanie. */}
        {selectedId && (
          <button onClick={() => { session.pause(); setSelectedId(null); }} className={devButton}>
            preview: ekran powitalny
          </button>
        )}
      </div>
    </>
  );
}

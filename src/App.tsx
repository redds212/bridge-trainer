import { useState, useEffect, useMemo, useRef } from 'react';
import type { SRSEntry, Deal, Difficulty } from './types';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { ResetPasswordPage } from './auth/ResetPasswordPage';
import { AdminPanel } from './admin/AdminPanel';
import { UserPanel } from './components/UserPanel';
import { useSRS } from './hooks/useSRS';
import { useDeals } from './hooks/useDeals';
import { useGameState } from './hooks/useGameState';
import { useDealTimer, timeLimitForLevel } from './hooks/useDealTimer';
import { useHistory } from './hooks/useHistory';
import { useSettings } from './hooks/useSettings';
import { useDailySession, resumeLabel, type SessionProgress } from './hooks/useDailySession';
import { filterDeals } from './lib/dealSearch';
import type { DailySession } from './lib/session';
import { Sidebar } from './components/Sidebar';
import { LoopMark } from './components/LoopMark';
import { BridgeTable } from './components/BridgeTable';
import { ControlPanel } from './components/ControlPanel';
import { DecisionPanel } from './components/DecisionPanel';
import { DealTimer } from './components/DealTimer';
import { SessionBar, PausedSessionBar } from './components/SessionBar';
import { InstallBanner } from './components/InstallPrompt';
import { ReportDealButton } from './components/ReportDeal';
import { Icon } from './components/Icon';

type View = 'trainer' | 'admin' | 'panel';

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { user, loading, offline, recovery, refreshProfile } = useAuth();
  const [view, setView] = useState<View>('trainer');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Fraza wyszukiwania siedzi tutaj, a nie w `Sidebar`, bo po tym samym zbiorze
  // chodzi „Następne →" (DEAL_SEARCH_PLAN.md, D4). Skutek uboczny: przeżywa skok
  // do Admina i z powrotem, bo `AppShell` się nie odmontowuje — pole zostaje
  // wypełnione, a obok niego jest „✕".
  const [dealQuery, setDealQuery] = useState('');
  // Filtr trudności mieszka obok frazy i z tego samego powodu: „Następne →" musi
  // chodzić po tym samym zbiorze, który widać na liście (D5). Pusto = wszystkie.
  const [dealDifficulties, setDealDifficulties] = useState<Difficulty[]>([]);
  const toggleDifficulty = (d: Difficulty) =>
    setDealDifficulties(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]));

  const dealsHook = useDeals();
  const userId = user?.id ?? null;
  const srs = useSRS(userId);
  const history = useHistory(userId);
  const { settings, update: updateSettings } = useSettings(userId);

  const session = useDailySession({
    userId,
    deals: dealsHook.deals,
    store: srs.store,
    storeLoading: srs.loading,
    settings,
    applyResult: srs.applyResult,
    recordHistory: history.record,
  });

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginPage />;
  // Przed bramką statusu, bo konto czekające na akceptację też może resetować hasło —
  // `PendingScreen` nie ma formularza, więc reset kończyłby się tam ślepym zaułkiem.
  if (recovery) return <ResetPasswordPage />;
  // Przed sprawdzeniem statusu: offline nie zna prawdziwego `status`, więc bez tego
  // brak sieci udawałby konto czekające na akceptację.
  if (offline) return <OfflineScreen onRetry={refreshProfile} />;
  if (user.status !== 'approved') return <PendingScreen username={user.username} />;
  if (srs.loading || history.loading || dealsHook.loading || session.loading) return <LoadingScreen />;

  if (view === 'admin' && user.isAdmin) {
    return (
      <AdminPanel
        allDeals={dealsHook.allDeals}
        loading={dealsHook.loading}
        error={dealsHook.error}
        onAdd={dealsHook.addDeal}
        onAddMany={dealsHook.addDeals}
        onBackfill={dealsHook.backfillSignatures}
        onUpdate={dealsHook.updateDeal}
        onArchive={dealsHook.archiveDeal}
        onRestore={dealsHook.restoreDeal}
        onDelete={dealsHook.deleteDeal}
        onBack={() => setView('trainer')}
      />
    );
  }

  if (view === 'panel') {
    return (
      <UserPanel
        deals={dealsHook.deals}
        store={srs.store}
        settings={settings}
        updateSettings={updateSettings}
        attempts={history.attempts}
        stats={history.stats}
        onReplay={(id) => { session.pause(); setSelectedId(id); setView('trainer'); }}
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

  return (
    <TrainerApp
      deals={dealsHook.deals}
      selectedId={selectedId}
      onSelectId={setSelectedId}
      srs={srs}
      recordHistory={history.record}
      session={session}
      timedMode={settings.timedMode}
      dealQuery={dealQuery}
      onDealQueryChange={setDealQuery}
      dealDifficulties={dealDifficulties}
      onToggleDifficulty={toggleDifficulty}
      onAdmin={user.isAdmin ? () => setView('admin') : undefined}
      // Panel pauzuje sesję jak każde inne wyjście (D3). Inaczej karta „Dzisiejsza
      // sesja" nie wiedziała o sesji w toku i jej przyciski startu podmieniały ją
      // bez potwierdzenia (D16).
      onPanel={() => { session.pause(); setView('panel'); }}
    />
  );
}

type SessionApi = ReturnType<typeof useDailySession>;
type SRSApi = ReturnType<typeof useSRS>;

interface TrainerProps {
  deals: Deal[];
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  srs: SRSApi;
  recordHistory: (id: string, correct: boolean, phase: 'main' | 'buffer' | 'free') => void;
  session: SessionApi;
  timedMode: boolean;
  dealQuery: string;
  onDealQueryChange: (query: string) => void;
  dealDifficulties: Difficulty[];
  onToggleDifficulty: (difficulty: Difficulty) => void;
  onAdmin?: () => void;
  onPanel: () => void;
}

// Eksport tylko dla podglądu `?preview=session` (src/dev/SessionPreview.tsx).
export function TrainerApp({ deals, selectedId, onSelectId, srs, recordHistory, session, timedMode, dealQuery, onDealQueryChange, dealDifficulties, onToggleDifficulty, onAdmin, onPanel }: TrainerProps) {
  const { getEntry } = srs;

  // Rekomendacje = dzisiejsza kolejka SRS, w jej kolejności. Rozdanie z kolejki może
  // zniknąć z puli (archiwizacja w Adminie), więc braki wypadają zamiast robić dziury.
  const todayDeals = useMemo(() => {
    const byId = new Map(deals.map(d => [d.id, d]));
    return session.todayQueue.flatMap(id => { const d = byId.get(id); return d ? [d] : []; });
  }, [deals, session.todayQueue]);

  const selectedDeal = deals.find(d => d.id === selectedId) ?? null;
  const { state, next, prev, rewind, revealSolution, setPhase, reset } = useGameState(selectedDeal);

  // Tryb na czas: limit zależny od opanowania tego rozdania; zero → auto-odsłonięcie.
  const timerLimit = timeLimitForLevel(selectedId ? getEntry(selectedId).consecutiveCorrect : 0);
  // Klucz resetu zawiera token sesji, bo to samo rozdanie potrafi wrócić na stół
  // w nowym podejściu — choćby po wznowieniu sesji przerwanej w trakcie jego
  // rozwiązywania. Samo id dawało wtedy identyczną sygnaturę biegu i zegar wracał
  // zamrożony na zerze, z góry przegrany (dawniej trafiało to powtórki z bufora).
  // Token rośnie po każdej odpowiedzi i przy wznowieniu, więc każde podejście startuje
  // świeżo. W swobodnej grze token stoi na 0, dzięki czemu RESTART nadal nie fabrykuje
  // nowego czasu.
  const timer = useDealTimer({
    enabled: timedMode && !!selectedDeal,
    phase: state?.phase,
    limitSeconds: timerLimit,
    resetKey: selectedDeal ? `${selectedDeal.id}|${session.sessionToken}` : null,
    onExpire: revealSolution,
  });

  // Anti-gaming for free play: track the SRS snapshot before this visit's first
  // rating, so re-rating never accumulates and RESTART can discard a positive result.
  const visitBaseRef = useRef<{ dealId: string; snapshot: SRSEntry } | null>(null);
  const lastCorrectRef = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const restoreSnapshot = (id: string, snapshot: SRSEntry) => {
    if (snapshot.status === 'NEW' && !snapshot.lastSeen) srs.resetEntry(id);
    else srs.setEntry(id, snapshot);
  };

  useEffect(() => {
    if (selectedDeal) reset(selectedDeal);
    visitBaseRef.current = null; // committing any prior rating
    lastCorrectRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeal?.id]);

  // Guided session drives selection: each answer bumps sessionToken → load next deal fresh.
  useEffect(() => {
    if (!session.active || !session.currentDealId) return;
    onSelectId(session.currentDealId);
    const d = deals.find(x => x.id === session.currentDealId);
    if (d) reset(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sessionToken]);

  // Wyjście do wybranego rozdania nie kasuje sesji — migawka czeka na „Wznów" (D3).
  const handleSelect = (id: string) => {
    if (session.active) session.pause();
    onSelectId(id);
  };

  const handleRate = (correct: boolean) => {
    if (!selectedId) return;
    if (session.active) {
      session.answer(correct); // records history + SRS
      // Po ostatniej odpowiedzi rozdanie zostaje na stole pod podsumowaniem sesji.
      // W fazie `revealed` wisiałyby pod nim przyciski oceny, a ich kliknięcie po
      // „Zamknij" liczyło to samo rozdanie drugi raz jako swobodną grę. Po każdej
      // innej odpowiedzi token i tak wczytuje zaraz następne rozdanie od początku.
      setPhase('rated');
      return;
    }
    // Establish the pre-visit baseline once; always rate FROM it, so repeating the
    // same deal in one sitting never stacks SRS advances.
    if (!visitBaseRef.current || visitBaseRef.current.dealId !== selectedId) {
      visitBaseRef.current = { dealId: selectedId, snapshot: getEntry(selectedId) };
    }
    srs.applyFromSnapshot(selectedId, visitBaseRef.current.snapshot, correct);
    recordHistory(selectedId, correct, 'free');
    lastCorrectRef.current = correct;
    setPhase('rated');
  };

  // RESTART discards a positive result (anti-gaming); a wrong result stays.
  const handleRewind = () => {
    const base = visitBaseRef.current;
    if (base && base.dealId === selectedId && lastCorrectRef.current) {
      restoreSnapshot(selectedId, base.snapshot);
      lastCorrectRef.current = false;
    }
    // Wracamy na początek rozdania, więc licznik znika i staje; wróci — i znowu
    // ruszy — dopiero w momencie decyzji, jak przy pierwszym przejściu. Póki jest
    // schowany, nie może zjechać do zera i zapisać błędu w tle.
    timer.suspendUntilDecision();
    rewind();
  };

  // „Następne →" chodzi po tym samym zbiorze, który widać w panelu bocznym
  // (DEAL_SEARCH_PLAN.md, D5). Bez frazy i bez wybranej trudności
  // `visibleDeals === deals`, więc zachowanie jest dokładnie takie jak dotąd.
  const visibleDeals = filterDeals(deals, dealQuery, dealDifficulties);
  const visibleIdx = visibleDeals.findIndex(d => d.id === selectedId);
  // Gdy bieżące rozdanie wypadło z filtru (fraza zmieniona po wyborze), „następne"
  // znaczy „pierwsze z aktualnych trafień" — wejście do zbioru zamiast martwego przycisku.
  const nextDeal = visibleDeals[visibleIdx + 1] ?? null;
  // Licznik tylko wtedy, gdy filtr działa i bieżące rozdanie faktycznie w nim jest:
  // nie da się być na pozycji N zbioru, poza którym się stoi (D7).
  const filterActive = dealQuery.trim().length > 0 || dealDifficulties.length > 0;
  const filterPosition = filterActive && visibleIdx >= 0
    ? `${visibleIdx + 1}/${visibleDeals.length}`
    : null;

  const handleNextDeal = () => {
    if (nextDeal) handleSelect(nextDeal.id);
  };

  return (
    // h-[100dvh] (not h-screen/100vh) so the bottom bars stay visible above mobile browser chrome.
    <div className="flex h-[100dvh] overflow-hidden bg-brand-bg">
      {/* Mobile drawer backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar: off-canvas drawer on mobile, static column on desktop */}
      <div className={`fixed md:static inset-y-0 left-0 z-40 flex-shrink-0 transition-transform duration-200 md:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar
          deals={deals}
          todayDeals={todayDeals}
          selectedId={selectedId}
          getEntry={getEntry}
          onSelect={(id) => { handleSelect(id); setSidebarOpen(false); }}
          query={dealQuery}
          onQueryChange={onDealQueryChange}
          difficulties={dealDifficulties}
          onToggleDifficulty={onToggleDifficulty}
          onAdmin={onAdmin}
          onPanel={onPanel}
        />
      </div>

      {/* Wcięcia boczne: w trybie standalone przy `viewport-fit=cover` treść sięga
          krawędzi ekranu, więc w poziomie notch zjadałby brzeg filcu. */}
      <div
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
      >
        {/* Mobile top bar with hamburger — pasek statusu iOS nakłada się na treść
            (`black-translucent`), więc górne wcięcie jest tu obowiązkowe. */}
        <div
          className="md:hidden flex items-center gap-3 px-3 py-2 bg-brand-panel border-b border-brand-line flex-shrink-0"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <button onClick={() => setSidebarOpen(true)} className="text-brand-dim hover:text-brand-text p-1" aria-label="Menu">
            <Icon name="menu" size={22} />
          </button>
          <span className="text-brand-text text-sm font-medium truncate">{selectedDeal?.title ?? 'BridgeLoop'}</span>
        </div>

        <InstallBanner />

        {session.active && session.progress && (
          <SessionBar progress={session.progress} onPause={session.pause} />
        )}

        {!session.active && session.pausedProgress && (
          <PausedSessionBar progress={session.pausedProgress} onResume={session.resume} />
        )}

        {session.completed && (
          <SessionComplete
            session={session.completed}
            extraSize={session.extraSize}
            onStartExtra={session.startExtra}
            onClose={session.dismissCompleted}
          />
        )}

        {!selectedDeal || !state ? (
          <WelcomeScreen
            todayDeals={todayDeals}
            onSelect={handleSelect}
            pausedProgress={session.pausedProgress}
            extraSize={session.extraSize}
            onStartSession={() => session.start()}
            onStartExtra={session.startExtra}
            onResumeSession={() => session.resume()}
            onDiscardSession={session.discard}
          />
        ) : (
          <>
            {/* min-h: podłoga dla diagramu — rozwinięty opis nie zgniata go poniżej
                czytelności. Podłoga jest względna, bo na ekranie 375 px wysokości
                (telefon w poziomie) sztywne 240 px wypychało dok i panel poza ekran. */}
            <div className="relative flex-1 min-h-[min(240px,35dvh)] p-2 flex flex-col md:min-h-0 md:p-3">
              <BridgeTable
                deal={selectedDeal}
                state={state}
                timer={<DealTimer remaining={timer.remaining} limit={timerLimit} visible={timer.visible} />}
                report={<ReportDealButton deal={selectedDeal} />}
              />
            </div>

            {!session.active && state.phase === 'rated' && selectedId && (
              <RatedBanner
                entry={getEntry(selectedId)}
                onNext={handleNextDeal}
                hasNext={!!nextDeal}
                filterPosition={filterPosition}
              />
            )}

            <ControlPanel
              phase={state.phase}
              currentStep={state.currentStep}
              totalSteps={selectedDeal.introSequence.length}
              isAnimating={state.isAnimating}
              onNext={next}
              onPrev={prev}
              onRewind={handleRewind}
            />

            <DecisionPanel
              phase={state.phase}
              prompt={selectedDeal.decisionPrompt}
              solutionText={selectedDeal.solution.text}
              onReveal={revealSolution}
              onCorrect={() => handleRate(true)}
              onWrong={() => handleRate(false)}
              timedOut={timer.expired}
            />
          </>
        )}
      </div>
    </div>
  );
}

function SessionComplete({ session, extraSize, onStartExtra, onClose }: {
  session: DailySession;
  /** Ile rozdań wylosuje kolejna partia; zero chowa przycisk. */
  extraSize: number;
  onStartExtra: () => void;
  onClose: () => void;
}) {
  const total = session.slots.length;
  const extra = session.type === 'extra';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-brand-panel border border-brand-line rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl slide-up">
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="text-brand-text font-bold text-xl mb-2">{extra ? 'Partia ukończona!' : 'Sesja ukończona!'}</h2>
        <p className="text-brand-dim text-sm mb-6">
          {total > 0
            ? `Przerobiłeś ${extra ? 'partię' : 'dzisiejszą pulę'} ${total} rozdań. Błędne wrócą jutro.`
            : extra
            ? 'Nie ma już czego losować — każde rozdanie było dziś rozwiązane.'
            : 'Brak rozdań na dziś — wszystko powtórzone!'}
        </p>
        {/* To jest moment, w którym chce się dalszego treningu (D14) — stąd partia
            jako główny przycisk, gdy jest z czego losować. */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {extraSize > 0 && (
            <button
              onClick={onStartExtra}
              className="px-6 py-2.5 bg-brand-accent hover:bg-brand-accent-soft text-brand-btn-text font-display font-bold rounded-[9px] text-sm transition-colors"
            >
              🎲 Wylosuj partię ({extraSize})
            </button>
          )}
          <button
            onClick={onClose}
            className={extraSize > 0
              ? 'px-6 py-2.5 bg-brand-soft hover:bg-brand-line/60 text-brand-text font-medium rounded-[9px] border border-brand-line text-sm transition-colors'
              : 'px-6 py-2.5 bg-brand-accent hover:bg-brand-accent-soft text-brand-btn-text font-display font-bold rounded-[9px] text-sm transition-colors'}
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({
  todayDeals, onSelect, pausedProgress, extraSize, onStartSession, onStartExtra, onResumeSession, onDiscardSession,
}: {
  /** Dzisiejsza kolejka SRS — ta sama, którą pokazuje panel boczny. */
  todayDeals: Deal[];
  onSelect: (id: string) => void;
  pausedProgress: SessionProgress | null;
  /** Ile rozdań wylosuje partia; zero chowa przycisk. */
  extraSize: number;
  onStartSession: () => void;
  onStartExtra: () => void;
  onResumeSession: () => void;
  /** Porzuca wstrzymaną partię (D16). */
  onDiscardSession: () => void;
}) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  // Wstrzymanej partii nie zaczyna się „od nowa" — kończy się ją i wraca do wyboru
  // między sesją dzienną a kolejną partią (D16).
  const pausedExtra = pausedProgress?.type === 'extra';

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
      <div className="flex flex-col items-center">
        <div className="mb-4"><LoopMark size={72} /></div>
        <h2 className="font-display text-2xl font-bold tracking-[-0.02em] mb-2">
          <span className="text-brand-text">Bridge</span><span className="text-brand-accent-soft">Loop</span>
        </h2>
        <p className="text-brand-dim text-sm max-w-md">
          {pausedExtra
            ? 'Masz przerwaną partię dodatkową — wróć do niej tam, gdzie ją zostawiłeś, albo ją zakończ.'
            : pausedProgress
            ? 'Masz przerwaną sesję na dziś — wróć do niej tam, gdzie ją zostawiłeś, albo zacznij od nowa.'
            : 'Rozpocznij dzisiejszą sesję, aby system dobrał rozdania według algorytmu powtórek, wylosuj partię na dodatkowy trening albo wybierz rozdanie z listy po lewej.'}
        </p>
      </div>

      {pausedProgress ? (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onResumeSession}
            className="px-7 py-3 bg-brand-accent hover:bg-brand-accent-soft text-brand-btn-text font-display font-bold rounded-[9px] text-sm transition-colors shadow-lg shadow-black/30"
          >
            {resumeLabel(pausedProgress)}
          </button>

          {confirmRestart ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-brand-dim text-xs">
                {pausedExtra
                  ? 'Pozostałe rozdania partii przepadną. Wyniki rozwiązanych zostają w historii i w powtórkach.'
                  : 'Kolejka przepadnie. Wyniki dotychczasowych rozdań zostają w historii i w powtórkach.'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setConfirmRestart(false); if (pausedExtra) onDiscardSession(); else onStartSession(); }}
                  className="text-xs px-3 py-1.5 bg-brand-soft hover:bg-brand-line/60 text-brand-text rounded-[7px] border border-brand-line transition-colors"
                >
                  {pausedExtra ? 'Tak, zakończ' : 'Tak, od nowa'}
                </button>
                <button
                  onClick={() => setConfirmRestart(false)}
                  className="text-xs px-3 py-1.5 text-brand-dim hover:text-brand-text transition-colors"
                >
                  Anuluj
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRestart(true)}
              className="text-xs text-brand-dim hover:text-brand-text underline underline-offset-4 transition-colors"
            >
              {pausedExtra ? 'Zakończ partię' : 'Zacznij od nowa'}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onStartSession}
            className="px-7 py-3 bg-brand-accent hover:bg-brand-accent-soft text-brand-btn-text font-display font-bold rounded-[9px] text-sm transition-colors shadow-lg shadow-black/30"
          >
            ▶ Rozpocznij dzisiejszą sesję
          </button>
          {extraSize > 0 && (
            <button
              onClick={onStartExtra}
              className="px-5 py-2 bg-brand-soft hover:bg-brand-line/60 text-brand-text font-medium rounded-[9px] border border-brand-line text-sm transition-colors"
            >
              🎲 Wylosuj partię ({extraSize})
            </button>
          )}
        </div>
      )}

      {todayDeals.length > 0 && (
        <div className="bg-brand-soft border border-brand-line rounded-[12px] p-4 max-w-sm w-full">
          <div className="text-brand-accent-2 font-semibold text-sm mb-3 uppercase tracking-wider">
            ★ Na dziś ({todayDeals.length})
          </div>
          {todayDeals.slice(0, 3).map(d => (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className="w-full text-left text-sm text-brand-text/90 hover:text-brand-text py-1.5 px-3 rounded-[7px] hover:bg-brand-line/50 transition-colors"
            >
              → {d.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface RatedBannerProps {
  entry: SRSEntry;
  onNext: () => void;
  hasNext: boolean;
  /** „2/3" przy aktywnym filtrze, inaczej `null` — patrz DEAL_SEARCH_PLAN.md, D7. */
  filterPosition: string | null;
}

function RatedBanner({ entry, onNext, hasNext, filterPosition }: RatedBannerProps) {
  const mastered = entry.status === 'MASTERED';
  const nextDate = entry.nextReviewDate
    ? new Date(entry.nextReviewDate).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })
    : null;

  return (
    <div className={`px-4 py-2 text-sm flex items-center justify-between slide-up ${
      mastered
        ? 'bg-brand-accent/15 border-t border-brand-accent/50'
        : 'bg-brand-panel/80 border-t border-brand-line'
    }`}>
      <div className={mastered ? 'text-brand-accent-soft' : 'text-brand-text/90'}>
        {mastered
          ? `🏆 Opanowane! Następna powtórka: ${nextDate}`
          : nextDate
          ? `⏰ Następna powtórka: ${nextDate}`
          : ''}
      </div>
      {/* Na końcu zbioru przycisk zostaje, ale wyszarzony: dotąd renderował się
          aktywny i po prostu nic nie robił. Przy filtrze na 3 trafienia trafia się
          to bez przerwy, więc martwy przycisk czytałby się jak awaria (D6). */}
      <button
        onClick={onNext}
        disabled={!hasNext}
        title={hasNext
          ? undefined
          : filterPosition
          ? 'To ostatnie rozdanie pasujące do filtrów'
          : 'To ostatnie rozdanie na liście'}
        className={`text-xs px-3 py-1 rounded-[7px] border transition-colors flex-shrink-0 whitespace-nowrap ${
          hasNext
            ? 'bg-brand-soft hover:bg-brand-line/60 text-brand-text border-brand-line'
            : 'bg-brand-soft/40 text-brand-dim border-brand-line/50 cursor-not-allowed'
        }`}
      >
        {filterPosition ? `Następne (${filterPosition}) →` : 'Następne →'}
      </button>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-4">
      <div className="animate-pulse"><LoopMark size={56} /></div>
      <div className="text-brand-dim text-sm">Ładowanie…</div>
    </div>
  );
}

/**
 * Rozdania, postępy SRS i historia mieszkają wyłącznie w Supabase, a service worker
 * cache'uje tylko powłokę — bez sieci nie ma czego trenować. Mówimy to wprost,
 * zamiast pokazywać ekran „konto oczekuje na akceptację".
 */
function OfflineScreen({ onRetry }: { onRetry: () => Promise<void> }) {
  const [checking, setChecking] = useState(false);

  const retry = async () => {
    setChecking(true);
    await onRetry();
    setChecking(false);
  };

  return (
    <div className="min-h-[100dvh] bg-brand-bg flex items-center justify-center p-4">
      <div className="bg-brand-panel border border-brand-line rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="text-5xl mb-4">📡</div>
        <h2 className="text-brand-text font-bold text-xl mb-2">Brak połączenia</h2>
        <p className="text-brand-dim text-sm mb-6">
          Aplikacja się uruchomiła, ale nie może pobrać rozdań ani Twoich postępów —
          te dane są po stronie serwera. Jesteś nadal zalogowany; wróci sieć, wróci trening.
        </p>
        <button
          onClick={retry}
          disabled={checking}
          className="px-5 py-2.5 bg-brand-accent hover:bg-brand-accent-soft disabled:opacity-50 text-brand-btn-text rounded-[9px] text-sm font-display font-bold transition-colors"
        >
          {checking ? 'Sprawdzam…' : 'Spróbuj ponownie'}
        </button>
      </div>
    </div>
  );
}

function PendingScreen({ username }: { username: string }) {
  const { logout, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);

  const checkAgain = async () => {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="bg-brand-panel border border-brand-line rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-brand-text font-bold text-xl mb-2">Konto oczekuje na akceptację</h2>
        <p className="text-brand-dim text-sm mb-6">
          Cześć <span className="text-brand-text font-medium">{username}</span>! Twoje konto zostało utworzone,
          ale administrator musi je zatwierdzić, zanim uzyskasz dostęp do rozdań i systemu powtórek.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={checkAgain}
            disabled={checking}
            className="px-5 py-2.5 bg-brand-accent hover:bg-brand-accent-soft disabled:opacity-50 text-brand-btn-text rounded-[9px] text-sm font-display font-bold transition-colors"
          >
            {checking ? 'Sprawdzam…' : 'Sprawdź ponownie'}
          </button>
          <button
            onClick={logout}
            className="px-5 py-2.5 bg-brand-soft hover:bg-brand-line/60 text-brand-text rounded-[9px] text-sm font-medium border border-brand-line transition-colors"
          >
            Wyloguj
          </button>
        </div>
      </div>
    </div>
  );
}

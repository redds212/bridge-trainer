import { useState, useEffect, useRef } from 'react';
import type { SRSEntry, Deal } from './types';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { AdminPanel } from './admin/AdminPanel';
import { UserPanel } from './components/UserPanel';
import { useSRS, isReviewDue } from './hooks/useSRS';
import { useDeals } from './hooks/useDeals';
import { useGameState } from './hooks/useGameState';
import { useHistory } from './hooks/useHistory';
import { useSettings } from './hooks/useSettings';
import { useDailySession } from './hooks/useDailySession';
import { Sidebar } from './components/Sidebar';
import { LoopMark } from './components/LoopMark';
import { BridgeTable } from './components/BridgeTable';
import { ControlPanel } from './components/ControlPanel';
import { DecisionPanel } from './components/DecisionPanel';
import { SessionBar } from './components/SessionBar';

type View = 'trainer' | 'admin' | 'panel';

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>('trainer');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dealsHook = useDeals();
  const userId = user?.id ?? null;
  const srs = useSRS(userId);
  const history = useHistory(userId);
  const { settings, update: updateSettings } = useSettings(userId);

  const session = useDailySession({
    deals: dealsHook.deals,
    store: srs.store,
    settings,
    applyResult: srs.applyResult,
    finalizeBufferResult: srs.finalizeBufferResult,
    recordHistory: history.record,
  });

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginPage />;
  if (user.status !== 'approved') return <PendingScreen username={user.username} />;
  if (srs.loading || history.loading || dealsHook.loading) return <LoadingScreen />;

  if (view === 'admin' && user.isAdmin) {
    return (
      <AdminPanel
        allDeals={dealsHook.allDeals}
        loading={dealsHook.loading}
        error={dealsHook.error}
        onAdd={dealsHook.addDeal}
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
        onReplay={(id) => { session.cancel(); setSelectedId(id); setView('trainer'); }}
        onStartSession={() => { session.start(); setView('trainer'); }}
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
      onAdmin={user.isAdmin ? () => setView('admin') : undefined}
      onPanel={() => setView('panel')}
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
  onAdmin?: () => void;
  onPanel: () => void;
}

function TrainerApp({ deals, selectedId, onSelectId, srs, recordHistory, session, onAdmin, onPanel }: TrainerProps) {
  const { getEntry } = srs;

  const selectedDeal = deals.find(d => d.id === selectedId) ?? null;
  const { state, next, prev, rewind, revealSolution, setPhase, reset } = useGameState(selectedDeal);

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

  const handleSelect = (id: string) => {
    if (session.active) session.cancel();
    onSelectId(id);
  };

  const handleRate = (correct: boolean) => {
    if (!selectedId) return;
    if (session.active) {
      session.answer(correct); // records history + SRS (main or buffer pass)
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
    rewind();
  };

  const handleNextDeal = () => {
    const idx = deals.findIndex(d => d.id === selectedId);
    const nextDeal = deals[idx + 1];
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
          selectedId={selectedId}
          getEntry={getEntry}
          onSelect={(id) => { handleSelect(id); setSidebarOpen(false); }}
          onAdmin={onAdmin}
          onPanel={onPanel}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar with hamburger */}
        <div className="md:hidden flex items-center gap-3 px-3 py-2 bg-brand-panel border-b border-brand-line flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-brand-dim hover:text-brand-text p-1" aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-brand-text text-sm font-medium truncate">{selectedDeal?.title ?? 'BridgeLoop'}</span>
        </div>

        {session.active && session.progress && (
          <SessionBar progress={session.progress} onCancel={session.cancel} />
        )}

        {session.completed && (
          <SessionComplete
            total={session.completed.slots.length}
            onClose={session.dismissCompleted}
          />
        )}

        {!selectedDeal || !state ? (
          <WelcomeScreen
            deals={deals}
            onSelect={handleSelect}
            getEntry={getEntry}
            onStartSession={() => session.start()}
          />
        ) : (
          <>
            <div className="flex-1 p-3 min-h-0 flex flex-col">
              <BridgeTable deal={selectedDeal} state={state} />
            </div>

            {!session.active && state.phase === 'rated' && selectedId && (
              <RatedBanner entry={getEntry(selectedId)} onNext={handleNextDeal} />
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
            />
          </>
        )}
      </div>
    </div>
  );
}

function SessionComplete({ total, onClose }: { total: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-brand-panel border border-brand-line rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl slide-up">
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="text-brand-text font-bold text-xl mb-2">Sesja ukończona!</h2>
        <p className="text-brand-dim text-sm mb-6">
          {total > 0
            ? `Przerobiłeś dzisiejszą pulę ${total} rozdań. Błędne wrócą jutro.`
            : 'Brak rozdań na dziś — wszystko powtórzone!'}
        </p>
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-brand-accent hover:bg-brand-accent-soft text-brand-btn-text font-display font-bold rounded-[9px] text-sm transition-colors"
        >
          Zamknij
        </button>
      </div>
    </div>
  );
}

function WelcomeScreen({
  deals, onSelect, getEntry, onStartSession,
}: {
  deals: Deal[];
  onSelect: (id: string) => void;
  getEntry: (id: string) => SRSEntry;
  onStartSession: () => void;
}) {
  const due = deals.filter(d => isReviewDue(getEntry(d.id)));

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
      <div className="flex flex-col items-center">
        <div className="mb-4"><LoopMark size={72} /></div>
        <h2 className="font-display text-2xl font-bold tracking-[-0.02em] mb-2">
          <span className="text-brand-text">Bridge</span><span className="text-brand-accent-soft">Loop</span>
        </h2>
        <p className="text-brand-dim text-sm max-w-md">
          Rozpocznij dzisiejszą sesję, aby system dobrał rozdania według algorytmu powtórek,
          albo wybierz rozdanie z listy po lewej.
        </p>
      </div>

      <button
        onClick={onStartSession}
        className="px-7 py-3 bg-brand-accent hover:bg-brand-accent-soft text-brand-btn-text font-display font-bold rounded-[9px] text-sm transition-colors shadow-lg shadow-black/30"
      >
        ▶ Rozpocznij dzisiejszą sesję
      </button>

      {due.length > 0 && (
        <div className="bg-brand-soft border border-brand-line rounded-[12px] p-4 max-w-sm w-full">
          <div className="text-brand-accent-2 font-semibold text-sm mb-3 uppercase tracking-wider">
            ★ {due.length} rozdań do powtórki dziś
          </div>
          {due.slice(0, 3).map(d => (
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

function RatedBanner({ entry, onNext }: { entry: SRSEntry; onNext: () => void }) {
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
          ? '🏆 Opanowane! To rozdanie trafiło do archiwum.'
          : nextDate
          ? `⏰ Następna powtórka: ${nextDate}`
          : ''}
      </div>
      <button
        onClick={onNext}
        className="text-xs px-3 py-1 bg-brand-soft hover:bg-brand-line/60 text-brand-text rounded-[7px] border border-brand-line transition-colors"
      >
        Następne →
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

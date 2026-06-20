import { useState, useEffect } from 'react';
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
  const { getEntry, applyResult } = srs;

  const selectedDeal = deals.find(d => d.id === selectedId) ?? null;
  const { state, next, prev, rewind, revealSolution, setPhase, reset } = useGameState(selectedDeal);

  useEffect(() => {
    if (selectedDeal) reset(selectedDeal);
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
    } else {
      applyResult(selectedId, correct);
      recordHistory(selectedId, correct, 'free');
      setPhase('rated');
    }
  };

  const handleNextDeal = () => {
    const idx = deals.findIndex(d => d.id === selectedId);
    const nextDeal = deals[idx + 1];
    if (nextDeal) handleSelect(nextDeal.id);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar
        deals={deals}
        selectedId={selectedId}
        getEntry={getEntry}
        onSelect={handleSelect}
        onAdmin={onAdmin}
        onPanel={onPanel}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
              onRewind={rewind}
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
      <div className="bg-slate-800 border border-slate-600 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl slide-up">
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="text-white font-bold text-xl mb-2">Sesja ukończona!</h2>
        <p className="text-slate-400 text-sm mb-6">
          {total > 0
            ? `Przerobiłeś dzisiejszą pulę ${total} rozdań. Błędne wrócą jutro.`
            : 'Brak rozdań na dziś — wszystko powtórzone!'}
        </p>
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-colors"
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
      <div>
        <div className="text-6xl mb-4">🃏</div>
        <h2 className="text-2xl font-bold text-white mb-2">Trenażer Brydżowy SRS</h2>
        <p className="text-slate-400 text-sm max-w-md">
          Rozpocznij dzisiejszą sesję, aby system dobrał rozdania według algorytmu powtórek,
          albo wybierz rozdanie z listy po lewej.
        </p>
      </div>

      <button
        onClick={onStartSession}
        className="px-7 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-blue-900/40"
      >
        ▶ Rozpocznij dzisiejszą sesję
      </button>

      {due.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-4 max-w-sm w-full">
          <div className="text-yellow-400 font-semibold text-sm mb-3">
            📅 {due.length} rozdań do powtórki dziś
          </div>
          {due.slice(0, 3).map(d => (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className="w-full text-left text-sm text-yellow-300 hover:text-yellow-200 py-1.5 px-3 rounded hover:bg-yellow-900/30 transition-colors"
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
        ? 'bg-emerald-900/40 border-t border-emerald-700'
        : 'bg-slate-800/80 border-t border-slate-700'
    }`}>
      <div className={mastered ? 'text-emerald-300' : 'text-slate-300'}>
        {mastered
          ? '🏆 Opanowane! To rozdanie trafiło do archiwum.'
          : nextDate
          ? `⏰ Następna powtórka: ${nextDate}`
          : ''}
      </div>
      <button
        onClick={onNext}
        className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded border border-slate-600 transition-colors"
      >
        Następne →
      </button>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <div className="text-5xl animate-pulse">🃏</div>
      <div className="text-slate-400 text-sm">Ładowanie…</div>
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-white font-bold text-xl mb-2">Konto oczekuje na akceptację</h2>
        <p className="text-slate-400 text-sm mb-6">
          Cześć <span className="text-slate-200 font-medium">{username}</span>! Twoje konto zostało utworzone,
          ale administrator musi je zatwierdzić, zanim uzyskasz dostęp do rozdań i systemu powtórek.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={checkAgain}
            disabled={checking}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {checking ? 'Sprawdzam…' : 'Sprawdź ponownie'}
          </button>
          <button
            onClick={logout}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium border border-slate-600 transition-colors"
          >
            Wyloguj
          </button>
        </div>
      </div>
    </div>
  );
}

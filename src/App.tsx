import { useState, useEffect } from 'react';
import type { SRSEntry } from './types';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { AdminPanel } from './admin/AdminPanel';
import { useSRS, isReviewDue } from './hooks/useSRS';
import { useDeals } from './hooks/useDeals';
import { useGameState } from './hooks/useGameState';
import { Sidebar } from './components/Sidebar';
import { BridgeTable } from './components/BridgeTable';
import { ControlPanel } from './components/ControlPanel';
import { DecisionPanel } from './components/DecisionPanel';
import type { Deal } from './types';

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { user } = useAuth();
  const [view, setView] = useState<'trainer' | 'admin'>('trainer');
  const dealsHook = useDeals();

  if (!user) return <LoginPage />;

  if (view === 'admin' && user.role === 'admin') {
    return (
      <AdminPanel
        baseDeals={dealsHook.baseDeals}
        customDeals={dealsHook.customDeals}
        hiddenIds={dealsHook.hiddenIds}
        onAdd={dealsHook.addDeal}
        onDelete={dealsHook.deleteDeal}
        onRestore={dealsHook.restoreDeal}
        onBack={() => setView('trainer')}
      />
    );
  }

  return (
    <TrainerApp
      deals={dealsHook.deals}
      userId={user.id}
      onAdmin={user.role === 'admin' ? () => setView('admin') : undefined}
    />
  );
}

function TrainerApp({ deals, userId, onAdmin }: { deals: Deal[]; userId: string; onAdmin?: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { getEntry, applyResult } = useSRS(userId);

  const selectedDeal = deals.find(d => d.id === selectedId) ?? null;
  const { state, next, prev, rewind, revealSolution, setPhase, reset } = useGameState(selectedDeal);

  useEffect(() => {
    if (selectedDeal) reset(selectedDeal);
  }, [selectedDeal?.id]);

  const handleSelect = (id: string) => setSelectedId(id);

  const handleCorrect = () => {
    if (!selectedId) return;
    applyResult(selectedId, true);
    setPhase('rated');
  };

  const handleWrong = () => {
    if (!selectedId) return;
    applyResult(selectedId, false);
    setPhase('rated');
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
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedDeal || !state ? (
          <WelcomeScreen deals={deals} onSelect={handleSelect} getEntry={getEntry} />
        ) : (
          <>
            <div className="flex-1 p-3 min-h-0 flex flex-col">
              <BridgeTable deal={selectedDeal} state={state} />
            </div>

            {state.phase === 'rated' && selectedId && (
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
              onCorrect={handleCorrect}
              onWrong={handleWrong}
            />
          </>
        )}
      </div>
    </div>
  );
}

function WelcomeScreen({ deals, onSelect, getEntry }: { deals: Deal[]; onSelect: (id: string) => void; getEntry: (id: string) => SRSEntry }) {
  const due = deals.filter(d => isReviewDue(getEntry(d.id)));

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
      <div>
        <div className="text-6xl mb-4">🃏</div>
        <h2 className="text-2xl font-bold text-white mb-2">Trenażer Brydżowy SRS</h2>
        <p className="text-slate-400 text-sm max-w-md">
          Wybierz rozdanie z listy po lewej, aby rozpocząć naukę.
          System SRS pomoże Ci zapamiętać kluczowe pozycje przez zaplanowane powtórki.
        </p>
      </div>

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

      <div className="grid grid-cols-3 gap-4 max-w-lg w-full">
        {deals.slice(0, 3).map(d => (
          <button
            key={d.id}
            onClick={() => onSelect(d.id)}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg p-3 text-center transition-colors group"
          >
            <div className="text-3xl mb-1 group-hover:scale-110 transition-transform">🂠</div>
            <div className="text-white text-xs font-medium leading-snug">{d.title}</div>
            <div className="text-slate-500 text-[10px] mt-1">{d.difficulty}</div>
          </button>
        ))}
      </div>
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

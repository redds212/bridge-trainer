import { formatClock } from '../lib/pomodoro';
import type { PomodoroApi } from '../hooks/usePomodoro';

/** Licznik ukończonych dziś pomidorów: „🍅×2". */
function Tally({ done }: { done: number }) {
  return done > 0 ? <span className="text-brand-dim text-xs tabular-nums flex-shrink-0" title={`Ukończone dziś: ${done}`}>🍅×{done}</span> : null;
}

/**
 * Pasek trwającego pomidora — nad paskiem sesji. Pokazuje czas do przerwy, a po jego upływie
 * prosi o dokończenie bieżącego rozdania (przerwa zaczyna się po ocenie).
 */
export function PomodoroBar({ pomodoro }: { pomodoro: PomodoroApi }) {
  const { phase, remaining, done, stop } = pomodoro;
  if (phase !== 'work' && phase !== 'wrapup') return null;
  const wrapup = phase === 'wrapup';

  return (
    <div
      role="timer"
      aria-label={wrapup ? 'Pomidor: czas minął, dokończ rozdanie' : `Pomidor: do przerwy ${formatClock(remaining)}`}
      className={`px-4 py-1.5 short:py-0.5 flex items-center gap-3 border-b text-xs ${
        wrapup ? 'bg-red-900/30 border-red-700/50' : 'bg-brand-soft/60 border-brand-line'
      }`}
    >
      <span className={`font-semibold tabular-nums flex-shrink-0 ${wrapup ? 'text-red-300' : 'text-brand-text'}`}>
        🍅 {wrapup ? 'Czas!' : formatClock(remaining)}
      </span>
      <span className="text-brand-dim truncate min-w-0 flex-1">
        {wrapup ? 'Dokończ to rozdanie — potem 3 min przerwy' : 'do przerwy'}
      </span>
      <Tally done={done} />
      <button
        onClick={stop}
        className="px-2 py-0.5 text-brand-dim hover:text-brand-text rounded-[7px] border border-brand-line hover:bg-brand-line/60 transition-colors flex-shrink-0"
      >
        Zakończ
      </button>
    </div>
  );
}

/**
 * Okno przerwy (3 min) i — po jej upływie — gotowości do kolejnego pomidora. Kliknięcie tła nie
 * kończy pomidora: wyjście jest jednym z dwóch jawnych przycisków.
 */
export function PomodoroBreak({ pomodoro, onNext }: { pomodoro: PomodoroApi; onNext: () => void }) {
  const { phase, remaining, done, stop } = pomodoro;
  if (phase !== 'break' && phase !== 'ready') return null;
  const ready = phase === 'ready';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ready ? 'Przerwa skończona' : 'Przerwa'}
        className="bg-brand-panel border border-brand-line rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl slide-up"
      >
      <div className="text-5xl mb-3">{ready ? '🍅' : '☕'}</div>
      <h2 className="text-brand-text font-bold text-xl mb-1">{ready ? 'Przerwa skończona' : 'Przerwa'}</h2>
      {!ready && (
        <div role="timer" aria-label={`Do końca przerwy ${formatClock(remaining)}`} className="font-display text-4xl font-bold tabular-nums text-brand-text my-3">
          {formatClock(remaining)}
        </div>
      )}
      <p className="text-brand-dim text-sm mb-6">
        {done > 0 ? `Ukończone dziś: ${done} 🍅. ` : ''}
        {ready ? 'Gotowy na kolejne 15 minut?' : 'Odejdź od ekranu — sesja czeka wstrzymana.'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={onNext}
          className="px-6 py-2.5 bg-brand-accent hover:bg-brand-accent-soft text-brand-btn-text font-display font-bold rounded-[9px] text-sm transition-colors"
        >
          {ready ? '▶ Kolejny 🍅' : 'Pomiń przerwę'}
        </button>
        <button
          onClick={stop}
          className="px-6 py-2.5 bg-brand-soft hover:bg-brand-line/60 text-brand-text font-medium rounded-[9px] border border-brand-line text-sm transition-colors"
        >
          Zakończ
        </button>
      </div>
      </div>
    </div>
  );
}

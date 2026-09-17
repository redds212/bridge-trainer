import type { SessionProgress } from '../hooks/useDailySession';

interface Props {
  progress: SessionProgress;
  onPause: () => void;
}

/**
 * Pasek wstrzymanej sesji — stoi dokładnie tam, gdzie przed „Przerwij" stał
 * `SessionBar`. Bez niego powrót do sesji byłby widoczny tylko na ekranie
 * powitalnym (a ten się nie pokazuje, dopóki jakieś rozdanie jest wybrane).
 */
export function PausedSessionBar({ progress, onResume }: { progress: SessionProgress; onResume: () => void }) {
  const { type, done, total } = progress;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="px-4 py-2 flex items-center gap-3 border-b bg-brand-soft/60 border-brand-line">
      <span className="text-xs font-semibold uppercase tracking-wider flex-shrink-0 text-brand-dim">
        ⏸ {type === 'extra' ? 'Partia wstrzymana' : 'Sesja wstrzymana'}
      </span>

      <div className="flex-1 h-2 bg-brand-soft rounded-full overflow-hidden min-w-0">
        <div className="h-full bg-brand-line" style={{ width: `${pct}%` }} />
      </div>

      <span className="text-brand-dim text-xs tabular-nums flex-shrink-0">
        {done} / {total}
      </span>

      <button
        onClick={onResume}
        className="text-xs px-2.5 py-1 bg-brand-accent hover:bg-brand-accent-soft text-brand-btn-text font-semibold rounded-[7px] transition-colors flex-shrink-0"
      >
        Wznów
      </button>
    </div>
  );
}

export function SessionBar({ progress, onPause }: Props) {
  const { type, done, total } = progress;
  const pct = total ? Math.round((done / total) * 100) : 0;
  // Partia dostaje bursztyn, żeby nie dało się jej pomylić z sesją dzienną.
  const extra = type === 'extra';

  return (
    <div className={`px-4 py-2 flex items-center gap-3 border-b ${
      extra ? 'bg-brand-accent-2/15 border-brand-accent-2/40' : 'bg-brand-accent/15 border-brand-accent/40'
    }`}>
      <span className={`text-xs font-semibold uppercase tracking-wider flex-shrink-0 ${
        extra ? 'text-brand-accent-2' : 'text-brand-accent-soft'
      }`}>
        {extra ? '🎲 Partia dodatkowa' : '▶ Sesja dzienna'}
      </span>

      <div className="flex-1 h-2 bg-brand-soft rounded-full overflow-hidden min-w-0">
        <div
          className={`h-full transition-all duration-300 ${extra ? 'bg-brand-accent-2' : 'bg-brand-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <span className="text-brand-text/80 text-xs tabular-nums flex-shrink-0">
        {done} / {total}
      </span>

      <button
        onClick={onPause}
        title={`Postęp zostanie zapisany — wrócisz tu przyciskiem „Wznów ${extra ? 'partię' : 'sesję'}”`}
        className="text-xs px-2.5 py-1 bg-brand-soft hover:bg-brand-line/60 text-brand-text rounded-[7px] border border-brand-line transition-colors flex-shrink-0"
      >
        Przerwij
      </button>
    </div>
  );
}

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
  const { inBuffer, mainDone, mainTotal, bufferDone, bufferTotal } = progress;
  const done = inBuffer ? bufferDone : mainDone;
  const total = inBuffer ? bufferTotal : mainTotal;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="px-4 py-2 flex items-center gap-3 border-b bg-brand-soft/60 border-brand-line">
      <span className="text-xs font-semibold uppercase tracking-wider flex-shrink-0 text-brand-dim">
        ⏸ {inBuffer ? 'Poprawki wstrzymane' : 'Sesja wstrzymana'}
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
  const { inBuffer, mainDone, mainTotal, bufferDone, bufferTotal } = progress;
  const done = inBuffer ? bufferDone : mainDone;
  const total = inBuffer ? bufferTotal : mainTotal;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className={`px-4 py-2 flex items-center gap-3 border-b ${
      inBuffer ? 'bg-brand-accent-2/15 border-brand-accent-2/40' : 'bg-brand-accent/15 border-brand-accent/40'
    }`}>
      <span className={`text-xs font-semibold uppercase tracking-wider flex-shrink-0 ${
        inBuffer ? 'text-brand-accent-2' : 'text-brand-accent-soft'
      }`}>
        {inBuffer ? '🔁 Bufor sesji' : '▶ Sesja dzienna'}
      </span>

      <div className="flex-1 h-2 bg-brand-soft rounded-full overflow-hidden min-w-0">
        <div
          className={`h-full transition-all duration-300 ${inBuffer ? 'bg-brand-accent-2' : 'bg-brand-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <span className="text-brand-text/80 text-xs tabular-nums flex-shrink-0">
        {done} / {total}
      </span>

      {inBuffer ? (
        // Bufor idzie na raz — pauzy tu nie ma (SESSION_RESUME_PLAN.md, D6). Migawka
        // jest zapisywana dalej, więc awaryjne zamknięcie karty wraca w to samo miejsce.
        <span className="text-brand-accent-2/80 text-[10px] flex-shrink-0">poprawa błędów</span>
      ) : (
        <button
          onClick={onPause}
          title="Postęp zostanie zapisany — wrócisz tu przyciskiem „Wznów sesję”"
          className="text-xs px-2.5 py-1 bg-brand-soft hover:bg-brand-line/60 text-brand-text rounded-[7px] border border-brand-line transition-colors flex-shrink-0"
        >
          Przerwij
        </button>
      )}
    </div>
  );
}

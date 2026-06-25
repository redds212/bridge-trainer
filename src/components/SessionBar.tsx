import type { SessionProgress } from '../hooks/useDailySession';

interface Props {
  progress: SessionProgress;
  onCancel: () => void;
}

export function SessionBar({ progress, onCancel }: Props) {
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

      {inBuffer && (
        <span className="text-brand-accent-2/80 text-[10px] flex-shrink-0">poprawa błędów</span>
      )}

      <button
        onClick={onCancel}
        className="text-xs px-2.5 py-1 bg-brand-soft hover:bg-brand-line/60 text-brand-text rounded-[7px] border border-brand-line transition-colors flex-shrink-0"
      >
        Przerwij
      </button>
    </div>
  );
}

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
      inBuffer ? 'bg-amber-900/30 border-amber-800/50' : 'bg-blue-900/30 border-blue-800/50'
    }`}>
      <span className={`text-xs font-semibold uppercase tracking-wider flex-shrink-0 ${
        inBuffer ? 'text-amber-400' : 'text-blue-400'
      }`}>
        {inBuffer ? '🔁 Bufor sesji' : '▶ Sesja dzienna'}
      </span>

      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden min-w-0">
        <div
          className={`h-full transition-all duration-300 ${inBuffer ? 'bg-amber-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <span className="text-slate-300 text-xs tabular-nums flex-shrink-0">
        {done} / {total}
      </span>

      {inBuffer && (
        <span className="text-amber-400/80 text-[10px] flex-shrink-0">poprawa błędów</span>
      )}

      <button
        onClick={onCancel}
        className="text-xs px-2.5 py-1 bg-slate-700/70 hover:bg-slate-600 text-slate-300 rounded border border-slate-600 transition-colors flex-shrink-0"
      >
        Przerwij
      </button>
    </div>
  );
}

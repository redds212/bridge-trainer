import { formatClock } from '../hooks/useDealTimer';

interface Props {
  remaining: number;
  limit: number;
  visible: boolean;
}

/**
 * Dyskretny licznik mono w rogu stołu. Stonowany, żeby nie stresował:
 * ostatnie 10 s zmienia kolor na bursztynowy jako delikatny sygnał.
 */
export function DealTimer({ remaining, limit, visible }: Props) {
  if (!visible) return null;

  const low = remaining <= 10;
  const done = remaining <= 0;

  return (
    <div
      role="timer"
      aria-label={`Pozostały czas: ${formatClock(remaining)}`}
      title={`Limit dla tego rozdania: ${formatClock(limit)}`}
      className={`absolute top-2 left-1/2 -translate-x-1/2 z-10 select-none rounded-[8px] border px-3 py-1.5
        font-mono text-lg tabular-nums leading-none tracking-tight transition-colors
        ${done
          ? 'border-red-700/60 bg-red-950/70 text-red-300'
          : low
            ? 'border-amber-600/50 bg-amber-950/50 text-amber-300'
            : 'border-brand-line bg-brand-bg/80 text-brand-dim'}`}
    >
      ⏱ {formatClock(remaining)}
    </div>
  );
}

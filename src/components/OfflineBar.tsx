import { useState } from 'react';

interface Props {
  /** Kiedy zapisano kopię, z której korzysta aplikacja (ISO). */
  since: string | null;
  onRetry: () => Promise<void>;
}

function formatSince(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pl-PL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

/**
 * Pasek trybu offline (docs/OFFLINE_PLAN.md, O4/O6): mówi wprost, że dane pochodzą
 * z kopii w telefonie i z kiedy, oraz że oceniać się nie da. Stały, nie do zamknięcia —
 * znika sam, gdy wróci sieć.
 */
export function OfflineBar({ since, onRetry }: Props) {
  const [checking, setChecking] = useState(false);
  const when = formatSince(since);

  const retry = async () => {
    setChecking(true);
    await onRetry();
    setChecking(false);
  };

  return (
    <div
      role="status"
      className="flex flex-shrink-0 items-center gap-3 border-b border-amber-700/50 bg-amber-900/30 px-4 py-2 text-xs text-amber-200"
    >
      <span className="min-w-0 flex-1 leading-snug">
        <span className="font-semibold">Offline</span>
        {when && <> · dane z {when}</>}
        <span className="text-amber-200/70"> · przeglądanie bez oceniania</span>
      </span>
      <button
        onClick={retry}
        disabled={checking}
        className="flex-shrink-0 rounded-[7px] border border-amber-600/60 px-2.5 py-1 font-semibold text-amber-100 transition-colors hover:bg-amber-800/40 disabled:opacity-50"
      >
        {checking ? 'Sprawdzam…' : 'Połącz'}
      </button>
    </div>
  );
}

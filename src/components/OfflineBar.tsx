import { useState } from 'react';
import type { OutboxState } from '../lib/outbox';

interface Props {
  /** Tryb offline z logowania: dane idą z kopii w telefonie. */
  offline: boolean;
  /** Kiedy zapisano kopię, z której korzysta aplikacja (ISO). */
  since: string | null;
  /** Ile rozdań ma zapisy czekające na wysyłkę. */
  pending: number;
  status: OutboxState['status'];
  /** Offline: sprawdzenie sieci i profilu. Online: ponowna wysyłka kolejki. */
  onRetry: () => Promise<void>;
}

function formatSince(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pl-PL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

/**
 * Pasek stanu synchronizacji (docs/OFFLINE_PLAN.md, O4/O6). Mówi, że dane pochodzą z
 * kopii w telefonie i z kiedy, oraz ile ocen czeka na wysyłkę. Stały, nie do
 * zamknięcia — znika sam, gdy wróci sieć i kolejka się opróżni.
 */
export function OfflineBar({ offline, since, pending, status, onRetry }: Props) {
  const [checking, setChecking] = useState(false);
  const when = formatSince(since);

  const retry = async () => {
    setChecking(true);
    await onRetry();
    setChecking(false);
  };

  const sending = !offline && status === 'sending';
  const failed = !offline && status === 'error';

  return (
    <div
      role="status"
      className="flex flex-shrink-0 items-center gap-3 border-b border-amber-700/50 bg-amber-900/30 px-4 py-2 text-xs text-amber-200"
    >
      <span className="min-w-0 flex-1 leading-snug">
        {sending ? (
          <span className="font-semibold">Wysyłanie… ({pending})</span>
        ) : failed ? (
          <>
            <span className="font-semibold">Nie udało się wysłać ({pending})</span>
            <span className="text-amber-200/70"> · ponowię</span>
          </>
        ) : (
          <>
            <span className="font-semibold">Offline</span>
            {offline && when && <> · dane z {when}</>}
            {pending > 0 && <span className="text-amber-200/70"> · {pending} do wysłania</span>}
          </>
        )}
      </span>
      {!sending && (
        <button
          onClick={retry}
          disabled={checking}
          className="flex-shrink-0 rounded-[7px] border border-amber-600/60 px-2.5 py-1 font-semibold text-amber-100 transition-colors hover:bg-amber-800/40 disabled:opacity-50"
        >
          {checking ? 'Sprawdzam…' : failed ? 'Ponów' : 'Połącz'}
        </button>
      )}
    </div>
  );
}

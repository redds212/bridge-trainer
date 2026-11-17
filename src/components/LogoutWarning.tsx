import { createPortal } from 'react-dom';

/** „1 rozdanie", „2 rozdania", „5 rozdań", „22 rozdania". */
function dealsLabel(n: number): string {
  if (n === 1) return '1 rozdanie';
  const tens = n % 100;
  const ones = n % 10;
  return ones >= 2 && ones <= 4 && (tens < 12 || tens > 14) ? `${n} rozdania` : `${n} rozdań`;
}

/**
 * Ostrzeżenie przy wylogowaniu, gdy w kolejce leżą oceny, których nie udało się
 * wysłać (docs/OFFLINE_PLAN.md, O7). Wylogowanie kasuje kopię z telefonu razem
 * z kolejką, więc te oceny przepadłyby bez śladu.
 *
 * Portal do `body`, bo panel boczny ma `overflow-hidden` i na telefonie jest szufladą
 * — okno w nim byłoby przycięte do jej szerokości.
 */
export function LogoutWarning({ unsent, busy, onStay, onLogout }: {
  unsent: number;
  busy: boolean;
  onStay: () => void;
  onLogout: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onStay}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-warning-title"
        aria-describedby="logout-warning-text"
        onClick={e => e.stopPropagation()}
        className="bg-brand-panel border border-brand-line rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl slide-up"
      >
        <div className="text-4xl mb-3">📤</div>
        <h2 id="logout-warning-title" className="text-brand-text font-bold text-lg mb-2">
          Niewysłane oceny
        </h2>
        <p id="logout-warning-text" className="text-brand-dim text-sm mb-5">
          Oceny za {dealsLabel(unsent)} nie dotarły jeszcze na serwer. Wylogowanie je
          skasuje. Zostań, a wyjdą same, gdy wróci połączenie.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={onStay}
            autoFocus
            className="px-6 py-2.5 bg-brand-accent hover:bg-brand-accent-soft text-brand-btn-text font-display font-bold rounded-[9px] text-sm transition-colors"
          >
            Zostań
          </button>
          <button
            onClick={onLogout}
            disabled={busy}
            className="px-6 py-2.5 bg-[rgba(224,82,77,.12)] text-[#e0524d] border border-[rgba(224,82,77,.3)] hover:bg-[rgba(224,82,77,.2)] disabled:opacity-50 font-medium rounded-[9px] text-sm transition-colors"
          >
            {busy ? 'Wylogowuję…' : 'Wyloguj mimo to'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

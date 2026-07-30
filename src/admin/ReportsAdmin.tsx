import { useState } from 'react';
import type { ReportStatus } from '../lib/database.types';
import { useDealReports, type DealReport } from '../hooks/useDealReports';

interface Props {
  /** Otwiera edytor rozdania, którego dotyczy zgłoszenie; brak = rozdania już nie ma. */
  onEditDeal: (dealId: string) => boolean;
}

const STATUS_LABEL: Record<ReportStatus, string> = {
  new: 'Nowe',
  seen: 'Przejrzane',
  resolved: 'Rozwiązane',
};

const STATUS_STYLE: Record<ReportStatus, string> = {
  new: 'bg-amber-900/40 text-amber-300 border-amber-700',
  seen: 'bg-sky-900/40 text-sky-300 border-sky-700',
  resolved: 'bg-emerald-900/40 text-emerald-300 border-emerald-700',
};

const FILTERS = ['open', 'all'] as const;
type Filter = (typeof FILTERS)[number];

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('pl-PL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function ReportsAdmin({ onEditDeal }: Props) {
  const { reports, loading, error, newCount, setStatus, remove } = useDealReports();
  const [filter, setFilter] = useState<Filter>('open');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  // Domyślnie chowamy rozwiązane — lista ma pokazywać, co jeszcze wymaga uwagi.
  const visible = filter === 'open' ? reports.filter(r => r.status !== 'resolved') : reports;

  const run = async (id: number, op: () => Promise<{ error?: string }>) => {
    setBusyId(id);
    setOpError(null);
    const res = await op();
    setBusyId(null);
    if (res.error) setOpError(res.error);
  };

  if (loading) return <div className="text-slate-400 text-sm">Wczytywanie zgłoszeń…</div>;

  if (error) {
    return (
      <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
        Nie udało się wczytać zgłoszeń: {error}
        <div className="text-red-400/80 text-xs mt-1">
          Jeśli tabela jeszcze nie istnieje, uruchom migrację 0008_deal_reports.sql w Supabase.
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-slate-200 font-semibold text-sm">
          Zgłoszenia błędów
          {newCount > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 border border-amber-700 text-[10px]">
              {newCount} nowych
            </span>
          )}
        </h2>
        <div className="flex gap-1 ml-auto">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                filter === f ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'open' ? 'Do załatwienia' : `Wszystkie (${reports.length})`}
            </button>
          ))}
        </div>
      </div>

      {opError && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-2 text-red-300 text-sm">✗ {opError}</div>
      )}

      {visible.length === 0 ? (
        <p className="text-slate-500 text-sm">
          {filter === 'open' ? 'Nic nie czeka na reakcję.' : 'Brak zgłoszeń.'}
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map(r => (
            <ReportCard
              key={r.id}
              report={r}
              busy={busyId === r.id}
              confirming={confirmDelete === r.id}
              onEditDeal={onEditDeal}
              onStatus={(s) => run(r.id, () => setStatus(r.id, s))}
              onAskDelete={() => setConfirmDelete(r.id)}
              onCancelDelete={() => setConfirmDelete(null)}
              onDelete={() => { setConfirmDelete(null); return run(r.id, () => remove(r.id)); }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReportCard({
  report, busy, confirming, onEditDeal, onStatus, onAskDelete, onCancelDelete, onDelete,
}: {
  report: DealReport;
  busy: boolean;
  confirming: boolean;
  onEditDeal: (dealId: string) => boolean;
  onStatus: (s: ReportStatus) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const [missing, setMissing] = useState(false);

  const openDeal = () => {
    if (!onEditDeal(report.dealId)) setMissing(true);
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className="flex items-start gap-3 mb-2">
        <span className={`px-2 py-0.5 rounded border text-[10px] flex-shrink-0 ${STATUS_STYLE[report.status]}`}>
          {STATUS_LABEL[report.status]}
        </span>
        <button
          onClick={openDeal}
          title="Otwórz rozdanie w edytorze"
          className="min-w-0 flex-1 text-left text-sm text-white hover:text-blue-300 transition-colors truncate"
        >
          {report.dealTitle || report.dealId}
        </button>
        <span className="text-slate-500 text-[10px] flex-shrink-0">{formatWhen(report.createdAt)}</span>
      </div>

      <p className="text-slate-300 text-sm whitespace-pre-wrap mb-2">{report.message}</p>

      <div className="text-slate-500 text-[10px] mb-3">
        {report.reporter} · <span className="font-mono">{report.dealId}</span>
      </div>

      {missing && (
        <div className="mb-3 text-amber-400 text-xs">
          Tego rozdania już nie ma w bazie — zgłoszenie zostaje dla historii.
        </div>
      )}

      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-red-300 text-xs">Usunąć zgłoszenie bezpowrotnie?</span>
          <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors">
            Usuń
          </button>
          <button onClick={onCancelDelete} className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">
            Anuluj
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {report.status === 'new' && (
            <button
              onClick={() => onStatus('seen')}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50"
            >
              Przejrzane
            </button>
          )}
          {report.status !== 'resolved' ? (
            <button
              onClick={() => onStatus('resolved')}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
            >
              Rozwiązane
            </button>
          ) : (
            <button
              onClick={() => onStatus('new')}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50"
            >
              Otwórz ponownie
            </button>
          )}
          <button
            onClick={onAskDelete}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors disabled:opacity-50 ml-auto"
          >
            Usuń
          </button>
        </div>
      )}
    </div>
  );
}

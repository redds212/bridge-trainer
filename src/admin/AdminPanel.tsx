import { useState, useRef } from 'react';
import type { Deal } from '../types';
import type { DealRecord } from '../hooks/useDeals';
import { DealBuilder } from './DealBuilder';
import { UsersAdmin } from './UsersAdmin';
import { validateDeal } from '../lib/validateDeal';

type Tab = 'deals' | 'users';

type BuilderMode =
  | { type: 'new' }
  | { type: 'edit'; deal: Deal }
  | { type: 'clone'; deal: Deal };

interface OpResult { error?: string }

interface Props {
  allDeals: DealRecord[];
  loading: boolean;
  error: string | null;
  onAdd: (deal: Deal) => Promise<OpResult>;
  onUpdate: (id: string, deal: Deal) => Promise<OpResult>;
  onArchive: (id: string) => Promise<OpResult>;
  onRestore: (id: string) => Promise<OpResult>;
  onDelete: (id: string) => Promise<OpResult>;
  onBack: () => void;
}

const DIFF_COLOR: Record<string, string> = {
  Easy: 'text-emerald-400',
  Medium: 'text-yellow-400',
  Hard: 'text-red-400',
  Expert: 'text-violet-400',
};

/** Strip DB-only fields back to a clean Deal for JSON export. */
function toDeal(r: DealRecord): Deal {
  const { isBase: _i, archived: _a, ...deal } = r;
  return deal;
}

export function AdminPanel({ allDeals, loading, error, onAdd, onUpdate, onArchive, onRestore, onDelete, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('deals');
  const [builder, setBuilder] = useState<BuilderMode | null>(null);
  const [flash, setFlash] = useState('');
  const [flashErr, setFlashErr] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 4000); };
  const showErr = (msg: string) => { setFlashErr(msg); setTimeout(() => setFlashErr(''), 6000); };

  const customDeals = allDeals.filter(d => !d.isBase);
  const active = allDeals.filter(d => !d.archived);
  const archived = allDeals.filter(d => d.archived);
  const visible = showArchived ? allDeals : active;

  const runOp = async (op: () => Promise<OpResult>, okMsg: string) => {
    setBusy(true);
    const res = await op();
    setBusy(false);
    if (res.error) showErr('Błąd: ' + res.error);
    else showFlash(okMsg);
  };

  const exportDeals = () => {
    const data = JSON.stringify(customDeals.map(toDeal), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bridge-deals-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDeals = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const deals: Deal[] = Array.isArray(parsed) ? parsed : [parsed];
        if (!deals.every(d => d.id && d.title)) throw new Error('nieprawidłowy format');
        setBusy(true);
        let ok = 0; let skipped = 0; const reasons: string[] = [];
        for (const d of deals) {
          const v = validateDeal(d);
          if (v.errors.length) { skipped++; reasons.push(`„${d.title}": ${v.errors[0]}`); continue; }
          const res = await onAdd(d);
          if (res.error) { skipped++; reasons.push(`„${d.title}": ${res.error}`); } else ok++;
        }
        setBusy(false);
        if (skipped) showErr(`Zaimportowano ${ok}, pominięto ${skipped} z błędami (np. ${reasons[0]}).`);
        else showFlash(`Zaimportowano ${ok} rozdań.`);
      } catch (err) {
        setBusy(false);
        showErr(`Błąd importu: ${err instanceof Error ? err.message : 'nieprawidłowy plik'}`);
      }
    };
    reader.readAsText(file);
  };

  if (builder) {
    const isEdit = builder.type === 'edit';
    const initialData = builder.type !== 'new' ? builder.deal : undefined;
    const cloneTitle = builder.type === 'clone' ? `Kopia: ${builder.deal.title}` : undefined;
    return (
      <DealBuilder
        initialData={cloneTitle ? { ...initialData!, title: cloneTitle } : initialData}
        isEdit={isEdit}
        onSave={async (deal) => {
          const res = isEdit ? await onUpdate(deal.id, deal) : await onAdd(deal);
          if (!res.error) { setBuilder(null); showFlash(isEdit ? 'Rozdanie zaktualizowane.' : 'Rozdanie dodane.'); }
          return res;
        }}
        onCancel={() => setBuilder(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <button onClick={onBack} className="text-slate-400 hover:text-white text-sm flex items-center gap-1.5 transition-colors">
          ← Powrót
        </button>
        <h1 className="text-white font-bold">Panel Administracyjny</h1>
        <div className="flex gap-1 ml-2">
          {(['deals', 'users'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'deals' ? 'Rozdania' : 'Użytkownicy'}
            </button>
          ))}
        </div>
        {busy && <span className="text-blue-400 text-xs animate-pulse ml-auto">Zapisywanie…</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-8">
        {tab === 'users' && <UsersAdmin />}
        {tab === 'deals' && (<>
        {flash && (
          <div className="bg-emerald-900/40 border border-emerald-700 rounded-lg px-4 py-2 text-emerald-300 text-sm">✓ {flash}</div>
        )}
        {flashErr && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-2 text-red-300 text-sm">✗ {flashErr}</div>
        )}
        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-2 text-red-300 text-sm">
            Nie udało się wczytać rozdań: {error}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-300 font-semibold text-xs uppercase tracking-wider">
              Rozdania ({active.length} aktywnych{archived.length ? `, ${archived.length} zarchiwizowanych` : ''})
            </h2>
            {archived.length > 0 && (
              <button
                onClick={() => setShowArchived(v => !v)}
                className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors"
              >
                {showArchived ? 'Ukryj zarchiwizowane' : `Pokaż zarchiwizowane (${archived.length})`}
              </button>
            )}
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            {loading && allDeals.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">Ładowanie rozdań…</div>
            ) : visible.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">Brak rozdań.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-700/50">
                    <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Tytuł</th>
                    <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Kategoria</th>
                    <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Trudność</th>
                    <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Źródło</th>
                    <th className="px-4 py-2 w-44"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(deal => (
                    <tr key={deal.id} className={`border-b border-slate-700/50 transition-opacity ${deal.archived ? 'opacity-40' : ''} ${!deal.isBase ? 'bg-blue-950/20' : ''}`}>
                      <td className="px-4 py-2.5">
                        <div className="text-white text-sm">{deal.title}</div>
                        <div className="text-slate-500 text-[10px] font-mono">{deal.id}</div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{deal.category}</td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className={DIFF_COLOR[deal.difficulty] ?? 'text-slate-400'}>{deal.difficulty}</span>
                      </td>
                      <td className={`px-4 py-2.5 text-xs ${deal.isBase ? 'text-slate-500' : 'text-blue-400'}`}>
                        {deal.isBase ? 'bazowe' : 'własne'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex gap-1.5 justify-end">
                          {deal.archived ? (
                            confirmDelete === deal.id ? (
                              <>
                                <span className="text-red-300 text-xs self-center mr-1">Usunąć na zawsze?</span>
                                <button
                                  onClick={async () => { setConfirmDelete(null); await runOp(() => onDelete(deal.id), 'Usunięto trwale.'); }}
                                  disabled={busy}
                                  className="text-xs px-2.5 py-1 bg-red-600 text-white rounded hover:bg-red-500 transition-colors disabled:opacity-50"
                                >
                                  Tak, usuń
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="text-xs px-2.5 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors border border-slate-600"
                                >
                                  Anuluj
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => runOp(() => onRestore(deal.id), 'Przywrócono.')}
                                  disabled={busy}
                                  className="text-xs px-2.5 py-1 bg-emerald-900/40 text-emerald-400 rounded hover:bg-emerald-900/70 transition-colors border border-emerald-800/50 disabled:opacity-50"
                                >
                                  Przywróć
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(deal.id)}
                                  disabled={busy}
                                  className="text-xs px-2.5 py-1 bg-red-900/40 text-red-400 rounded hover:bg-red-900/70 transition-colors border border-red-800/50 disabled:opacity-50"
                                  title="Usuń trwale z bazy"
                                >
                                  Usuń trwale
                                </button>
                              </>
                            )
                          ) : (
                            <>
                              {!deal.isBase && (
                                <button
                                  onClick={() => setBuilder({ type: 'edit', deal: toDeal(deal) })}
                                  className="text-xs px-2.5 py-1 bg-blue-900/40 text-blue-400 rounded hover:bg-blue-900/70 transition-colors border border-blue-800/50"
                                >
                                  Edytuj
                                </button>
                              )}
                              <button
                                onClick={() => setBuilder({ type: 'clone', deal: toDeal(deal) })}
                                className="text-xs px-2.5 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors border border-slate-600"
                              >
                                Klonuj
                              </button>
                              <button
                                onClick={() => runOp(() => onArchive(deal.id), 'Zarchiwizowano.')}
                                disabled={busy}
                                className="text-xs px-2.5 py-1 bg-red-900/40 text-red-400 rounded hover:bg-red-900/70 transition-colors border border-red-800/50 disabled:opacity-50"
                              >
                                Usuń
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-slate-300 font-semibold text-xs uppercase tracking-wider">Zarządzanie rozdaniami</h2>

          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={() => setBuilder({ type: 'new' })}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-colors shadow"
            >
              + Nowe rozdanie
            </button>

            <div className="h-6 border-l border-slate-700" />

            <button
              onClick={exportDeals}
              disabled={customDeals.length === 0}
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl text-sm transition-colors border border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Eksportuj JSON ({customDeals.length})
            </button>

            <button
              onClick={() => importRef.current?.click()}
              disabled={busy}
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl text-sm transition-colors border border-slate-600 disabled:opacity-50"
            >
              Importuj JSON
            </button>
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={importDeals} />
          </div>

          <p className="text-slate-500 text-xs">
            Rozdania są przechowywane w bazie (Supabase) i współdzielone przez wszystkich zaakceptowanych użytkowników.
            Eksport JSON zapisuje Twoje własne rozdania jako backup; import wczytuje je z powrotem.
          </p>
        </div>
        </>)}
      </div>
    </div>
  );
}

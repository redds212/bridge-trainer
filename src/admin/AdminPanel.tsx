import { useState, useRef, useMemo } from 'react';
import type { Deal } from '../types';
import type { DealRecord, BulkAddResult, BackfillResult } from '../hooks/useDeals';
import { DealBuilder } from './DealBuilder';
import { UsersAdmin } from './UsersAdmin';
import { validateDeal } from '../lib/validateDeal';
import { dealSignature, normalizeTitle } from '../lib/dealSignature';

type Tab = 'deals' | 'users';

type BuilderMode =
  | { type: 'new' }
  | { type: 'edit'; deal: Deal };

interface OpResult { error?: string }

interface Props {
  allDeals: DealRecord[];
  loading: boolean;
  error: string | null;
  onAdd: (deal: Deal) => Promise<OpResult>;
  onAddMany: (deals: Deal[]) => Promise<BulkAddResult>;
  onBackfill: () => Promise<BackfillResult>;
  onUpdate: (id: string, deal: Deal) => Promise<OpResult>;
  onArchive: (id: string) => Promise<OpResult>;
  onRestore: (id: string) => Promise<OpResult>;
  onDelete: (id: string) => Promise<OpResult>;
  onBack: () => void;
}

/** Wynik przejrzenia wybranych plików — liczony PRZED jakimkolwiek zapisem. */
interface ImportScan {
  fileCount: number;
  total: number;
  /** Gotowe do zapisu. */
  fresh: Deal[];
  /** Tytuł już w bazie, ale inny rozkład kart — wymaga decyzji użytkownika. */
  renamed: { deal: Deal; existing: string }[];
  /** Ten sam rozkład 52 kart — pomijane bezwarunkowo. */
  duplicates: { title: string; against: string; inBatch: boolean }[];
  invalid: { title: string; reason: string }[];
  /** Bez kompletu 52 kart → poza kontrolą duplikatów. */
  unsigned: number;
  badFiles: string[];
}

interface ImportReport {
  scan: ImportScan;
  added: number;
  renamedIncluded: boolean;
  failures: { title: string; error: string }[];
}

const DIFF_COLOR: Record<string, string> = {
  Easy: 'text-emerald-400',
  Medium: 'text-yellow-400',
  Hard: 'text-red-400',
  Expert: 'text-violet-400',
};

/** Editable Deal for the builder (keeps motifs/source so edit preserves them). */
function toDeal(r: DealRecord): Deal {
  const { isBase: _i, archived: _a, cardSignature: _c, ...deal } = r;
  return deal;
}

/** Portable Deal for JSON export — drops DB-local refs (tag/source uuids, signature). */
function toExportDeal(r: DealRecord): Deal {
  const { isBase: _i, archived: _a, tagIds: _t, sourceId: _s, sourceDetails: _d, cardSignature: _c, ...deal } = r;
  return deal;
}

export function AdminPanel({ allDeals, loading, error, onAdd, onAddMany, onBackfill, onUpdate, onArchive, onRestore, onDelete, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('deals');
  const [builder, setBuilder] = useState<BuilderMode | null>(null);
  const [flash, setFlash] = useState('');
  const [flashErr, setFlashErr] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [importScan, setImportScan] = useState<ImportScan | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 4000); };
  const showErr = (msg: string) => { setFlashErr(msg); setTimeout(() => setFlashErr(''), 6000); };

  // Newest first — recently added/edited deals are easiest to find at the top.
  const ordered = [...allDeals].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const customDeals = ordered.filter(d => !d.isBase);
  const active = ordered.filter(d => !d.archived);
  const archived = ordered.filter(d => d.archived);
  const visible = showArchived ? ordered : active;

  const runOp = async (op: () => Promise<OpResult>, okMsg: string) => {
    setBusy(true);
    const res = await op();
    setBusy(false);
    if (res.error) showErr('Błąd: ' + res.error);
    else showFlash(okMsg);
  };

  const exportDeals = () => {
    const data = JSON.stringify(customDeals.map(toExportDeal), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bridge-deals-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Stan bazy widziany przez kontrolę duplikatów.
   * Dla wierszy sprzed migracji (`cardSignature === null`) liczymy sygnaturę z ich
   * bieżących kart — to dokładnie to, co dopisze backfill, więc kontrola działa
   * także przed jego uruchomieniem.
   */
  const audit = useMemo(() => {
    const bySig = new Map<string, string>();
    const byTitle = new Map<string, string>();
    const groups = new Map<string, string[]>();
    let signed = 0, pending = 0, exempt = 0;

    for (const r of allDeals) {
      const sig = r.cardSignature ?? dealSignature(r);
      if (r.cardSignature) signed++;
      else if (sig) pending++;
      else exempt++;

      if (sig) {
        if (!bySig.has(sig)) bySig.set(sig, r.title);
        groups.set(sig, [...(groups.get(sig) ?? []), r.title]);
      }
      const nt = normalizeTitle(r.title);
      if (!byTitle.has(nt)) byTitle.set(nt, r.title);
    }

    return {
      bySig, byTitle, signed, pending, exempt,
      total: allDeals.length,
      dupGroups: [...groups.values()].filter(g => g.length > 1),
    };
  }, [allDeals]);

  /** Przegląda pliki bez zapisywania czegokolwiek — w jednym wspólnym przebiegu. */
  const scanFiles = async (files: File[]): Promise<ImportScan> => {
    const scan: ImportScan = {
      fileCount: files.length, total: 0,
      fresh: [], renamed: [], duplicates: [], invalid: [], unsigned: 0, badFiles: [],
    };
    // Kopie map: rozdania z tego wsadu rezerwują swoje sygnatury i tytuły, więc
    // powtórka wewnątrz wsadu (np. euvc.json po plikach pojedynczych) też się złapie.
    const bySig = new Map(audit.bySig);
    const byTitle = new Map(audit.byTitle);
    const batchSigs = new Set<string>();

    const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name, 'pl', { numeric: true }));
    for (const file of ordered) {
      let deals: Deal[];
      try {
        const parsed = JSON.parse(await file.text());
        deals = (Array.isArray(parsed) ? parsed : [parsed]) as Deal[];
        if (!deals.every(d => d && d.id && d.title)) throw new Error('nieprawidłowy format');
      } catch (err) {
        scan.badFiles.push(`${file.name}: ${err instanceof Error ? err.message : 'nieprawidłowy JSON'}`);
        continue;
      }

      for (const d of deals) {
        scan.total++;

        const v = validateDeal(d);
        if (v.errors.length) { scan.invalid.push({ title: d.title, reason: v.errors[0] }); continue; }

        const sig = dealSignature(d);
        if (sig) {
          const hit = bySig.get(sig);
          if (hit) { scan.duplicates.push({ title: d.title, against: hit, inBatch: batchSigs.has(sig) }); continue; }
          bySig.set(sig, d.title);
          batchSigs.add(sig);
        } else {
          scan.unsigned++;
        }

        const nt = normalizeTitle(d.title);
        const titleHit = byTitle.get(nt);
        if (titleHit) scan.renamed.push({ deal: d, existing: titleHit });
        else scan.fresh.push(d);
        byTitle.set(nt, d.title);
      }
    }
    return scan;
  };

  const runImport = async (scan: ImportScan, includeRenamed: boolean) => {
    setImportScan(null);
    const deals = includeRenamed ? [...scan.fresh, ...scan.renamed.map(r => r.deal)] : scan.fresh;
    setBusy(true);
    const res = deals.length ? await onAddMany(deals) : { ok: 0, failures: [] };
    setBusy(false);
    setImportReport({ scan, added: res.ok, renamedIncluded: includeRenamed, failures: res.failures });
  };

  const importDeals = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setImportReport(null);
    setBusy(true);
    const scan = await scanFiles(files);
    setBusy(false);
    // Kolizja tytułu nie blokuje, ale wymaga decyzji — patrz docs/DEDUP_PLAN.md.
    if (scan.renamed.length) setImportScan(scan);
    else await runImport(scan, false);
  };

  const runBackfill = async () => {
    setBusy(true);
    const res = await onBackfill();
    setBusy(false);
    if (res.error) showErr('Błąd przeliczania sygnatur: ' + res.error);
    else showFlash(`Uzupełniono sygnatury: ${res.updated}. Zwolnionych (mniej niż 52 karty): ${res.exempt}.`);
  };

  if (builder) {
    const isEdit = builder.type === 'edit';
    const initialData = isEdit ? builder.deal : undefined;
    return (
      <DealBuilder
        initialData={initialData}
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

        {/* Action bar — always visible at the top */}
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
          <input ref={importRef} type="file" accept=".json" multiple className="hidden" onChange={importDeals} />
          <span className="text-slate-500 text-xs">Możesz zaznaczyć wiele plików naraz.</span>
        </div>

        {/* Kolizja tytułów — ten sam board, inny rozkład kart. Decyzja użytkownika. */}
        {importScan && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 space-y-3">
            <div className="text-amber-200 text-sm font-semibold">
              {importScan.renamed.length} {importScan.renamed.length === 1 ? 'rozdanie ma' : 'rozdań ma'} tytuł już obecny w bazie, ale INNY rozkład kart.
            </div>
            <p className="text-amber-200/70 text-xs">
              Zwykle znaczy to, że plik został poprawiony (albo kartę poprawiono wcześniej w aplikacji).
              Import doda je jako osobne rozdania — nic nie zostanie nadpisane.
            </p>
            <ul className="text-xs text-amber-100/80 max-h-40 overflow-y-auto space-y-0.5 font-mono">
              {importScan.renamed.map((r, i) => <li key={i}>„{r.deal.title}" ↔ „{r.existing}"</li>)}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => runImport(importScan, true)}
                disabled={busy}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                Importuj wszystko ({importScan.fresh.length + importScan.renamed.length})
              </button>
              <button
                onClick={() => runImport(importScan, false)}
                disabled={busy}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg border border-slate-600 transition-colors disabled:opacity-50"
              >
                Pomiń te ({importScan.renamed.length}), importuj resztę ({importScan.fresh.length})
              </button>
              <button
                onClick={() => setImportScan(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-lg border border-slate-700 transition-colors"
              >
                Anuluj
              </button>
            </div>
          </div>
        )}

        {/* Raport importu — duplikaty liczone osobno od błędów walidacji. */}
        {importReport && (() => {
          const { scan, added, renamedIncluded, failures } = importReport;
          const skippedRenamed = renamedIncluded ? 0 : scan.renamed.length;
          const item = 'text-xs font-mono text-slate-300 py-0.5';
          return (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="text-sm text-white">
                  Zaimportowano <span className="text-emerald-400 font-semibold">{added}</span>
                  {' · '}pominięto <span className="text-amber-400 font-semibold">{scan.duplicates.length}</span> duplikatów
                  {skippedRenamed > 0 && <> · pominięto {skippedRenamed} z kolizją tytułu</>}
                  {scan.invalid.length > 0 && <> · <span className="text-red-400 font-semibold">{scan.invalid.length}</span> z błędami</>}
                  {failures.length > 0 && <> · <span className="text-red-400 font-semibold">{failures.length}</span> odrzuconych przez bazę</>}
                  <div className="text-slate-500 text-xs mt-0.5">
                    {scan.total} rozdań z {scan.fileCount} {scan.fileCount === 1 ? 'pliku' : 'plików'}
                    {scan.unsigned > 0 && ` · ${scan.unsigned} bez kompletu 52 kart (poza kontrolą duplikatów)`}
                  </div>
                </div>
                <button onClick={() => setImportReport(null)} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
              </div>

              {scan.duplicates.length > 0 && (
                <details className="group">
                  <summary className="text-amber-400 text-xs cursor-pointer hover:text-amber-300">
                    Duplikaty ({scan.duplicates.length}) — ten sam rozkład 52 kart
                  </summary>
                  <ul className="mt-1 max-h-56 overflow-y-auto pl-3 border-l border-slate-700">
                    {scan.duplicates.map((d, i) => (
                      <li key={i} className={item}>
                        „{d.title}" → „{d.against}"
                        <span className="text-slate-500"> ({d.inBatch ? 'w tym wsadzie' : 'w bazie'})</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {scan.invalid.length > 0 && (
                <details>
                  <summary className="text-red-400 text-xs cursor-pointer hover:text-red-300">
                    Błędy walidacji ({scan.invalid.length})
                  </summary>
                  <ul className="mt-1 max-h-56 overflow-y-auto pl-3 border-l border-slate-700">
                    {scan.invalid.map((d, i) => <li key={i} className={item}>„{d.title}": {d.reason}</li>)}
                  </ul>
                </details>
              )}

              {failures.length > 0 && (
                <details open>
                  <summary className="text-red-400 text-xs cursor-pointer hover:text-red-300">
                    Odrzucone przez bazę ({failures.length})
                  </summary>
                  <ul className="mt-1 max-h-56 overflow-y-auto pl-3 border-l border-slate-700">
                    {failures.map((f, i) => <li key={i} className={item}>„{f.title}": {f.error}</li>)}
                  </ul>
                </details>
              )}

              {scan.badFiles.length > 0 && (
                <details open>
                  <summary className="text-red-400 text-xs cursor-pointer hover:text-red-300">
                    Nieczytelne pliki ({scan.badFiles.length})
                  </summary>
                  <ul className="mt-1 pl-3 border-l border-slate-700">
                    {scan.badFiles.map((f, i) => <li key={i} className={item}>{f}</li>)}
                  </ul>
                </details>
              )}
            </div>
          );
        })()}

        {/* Konserwacja sygnatur — widoczne tylko dopóki jest co zrobić. */}
        {(audit.pending > 0 || audit.dupGroups.length > 0) && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-300 text-xs">
                Sygnatury rozkładu: <span className="text-white">{audit.signed}/{audit.total}</span> podpisanych
                {audit.pending > 0 && <> · <span className="text-amber-400">{audit.pending}</span> do uzupełnienia</>}
                {audit.exempt > 0 && <> · {audit.exempt} bez kompletu 52 kart (zwolnione)</>}
              </span>
              {audit.pending > 0 && (
                <button
                  onClick={runBackfill}
                  disabled={busy}
                  className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg border border-slate-600 transition-colors disabled:opacity-50"
                >
                  Przelicz sygnatury
                </button>
              )}
            </div>
            {audit.dupGroups.length > 0 && (
              <details open>
                <summary className="text-red-400 text-xs cursor-pointer hover:text-red-300">
                  Duplikaty już w bazie: {audit.dupGroups.length} {audit.dupGroups.length === 1 ? 'grupa' : 'grup'} — usuń nadmiarowe przed migracją 0007
                </summary>
                <ul className="mt-1 max-h-56 overflow-y-auto pl-3 border-l border-slate-700">
                  {audit.dupGroups.map((g, i) => (
                    <li key={i} className="text-xs font-mono text-slate-300 py-0.5">{g.map(t => `„${t}"`).join(' = ')}</li>
                  ))}
                </ul>
                <p className="text-slate-500 text-[11px] mt-1">
                  Usunięcie rozdania kasuje też historię powtórek (SRS) z nim związaną — zostaw tę kopię, która ma postępy.
                </p>
              </details>
            )}
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

          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
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
                              <button
                                onClick={() => setBuilder({ type: 'edit', deal: toDeal(deal) })}
                                className="text-xs px-2.5 py-1 bg-blue-900/40 text-blue-400 rounded hover:bg-blue-900/70 transition-colors border border-blue-800/50"
                              >
                                Edytuj
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

        <p className="text-slate-500 text-xs">
          Rozdania są przechowywane w bazie (Supabase) i współdzielone przez wszystkich zaakceptowanych użytkowników.
          Eksport JSON zapisuje Twoje własne rozdania jako backup; import wczytuje je z powrotem.
        </p>
        </>)}
      </div>
    </div>
  );
}

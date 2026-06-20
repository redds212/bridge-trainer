import { useState, useRef } from 'react';
import type { Deal } from '../types';
import { DealBuilder } from './DealBuilder';

type BuilderMode =
  | { type: 'new' }
  | { type: 'edit'; deal: Deal }
  | { type: 'clone'; deal: Deal };

interface Props {
  baseDeals: Deal[];
  customDeals: Deal[];
  hiddenIds: string[];
  onAdd: (deal: Deal) => void;
  onUpdate: (id: string, deal: Deal) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onBack: () => void;
}

const DIFF_COLOR: Record<string, string> = {
  Easy: 'text-emerald-400',
  Medium: 'text-yellow-400',
  Hard: 'text-red-400',
  Expert: 'text-violet-400',
};

export function AdminPanel({ baseDeals, customDeals, hiddenIds, onAdd, onUpdate, onDelete, onRestore, onBack }: Props) {
  const [builder, setBuilder] = useState<BuilderMode | null>(null);
  const [flash, setFlash] = useState('');
  const [flashErr, setFlashErr] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 4000); };
  const showErr = (msg: string) => { setFlashErr(msg); setTimeout(() => setFlashErr(''), 5000); };

  const isHidden = (id: string) => hiddenIds.includes(id);
  const deletedCount = baseDeals.filter(d => isHidden(d.id)).length;

  const exportDeals = () => {
    const data = JSON.stringify(customDeals, null, 2);
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
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const deals: Deal[] = Array.isArray(parsed) ? parsed : [parsed];
        if (!deals.every(d => d.id && d.title)) throw new Error('nieprawidłowy format');
        deals.forEach(d => onAdd({ ...d, id: `deal-custom-${Date.now()}-${Math.random().toString(36).slice(2)}` }));
        showFlash(`Zaimportowano ${deals.length} rozdań.`);
      } catch (err) {
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
        onSave={(deal) => {
          if (isEdit) { onUpdate(deal.id, deal); showFlash('Rozdanie zaktualizowane.'); }
          else { onAdd(deal); showFlash('Rozdanie dodane.'); }
          setBuilder(null);
        }}
        onCancel={() => setBuilder(null)}
      />
    );
  }

  const visibleBaseDeals = showDeleted ? baseDeals : baseDeals.filter(d => !isHidden(d.id));

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white text-sm flex items-center gap-1.5 transition-colors"
        >
          ← Powrót
        </button>
        <h1 className="text-white font-bold">Panel Administracyjny</h1>
        <span className="text-slate-500 text-xs">Zarządzanie rozdaniami</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-8">
        {/* Flashes */}
        {flash && (
          <div className="bg-emerald-900/40 border border-emerald-700 rounded-lg px-4 py-2 text-emerald-300 text-sm">
            ✓ {flash}
          </div>
        )}
        {flashErr && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-2 text-red-300 text-sm">
            ✗ {flashErr}
          </div>
        )}

        {/* Deal list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-300 font-semibold text-xs uppercase tracking-wider">
              Rozdania ({visibleBaseDeals.length + customDeals.length} widocznych
              {deletedCount > 0 ? `, ${deletedCount} usuniętych` : ''})
            </h2>
            {deletedCount > 0 && (
              <button
                onClick={() => setShowDeleted(v => !v)}
                className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors"
              >
                {showDeleted ? 'Ukryj usunięte' : `Pokaż usunięte (${deletedCount})`}
              </button>
            )}
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-700/50">
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Tytuł</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Kategoria</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Trudność</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Źródło</th>
                  <th className="px-4 py-2 w-36"></th>
                </tr>
              </thead>
              <tbody>
                {visibleBaseDeals.map(deal => (
                  <tr key={deal.id} className={`border-b border-slate-700/50 transition-opacity ${isHidden(deal.id) ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-2.5">
                      <div className="text-white text-sm">{deal.title}</div>
                      <div className="text-slate-500 text-[10px] font-mono">{deal.id}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{deal.category}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className={DIFF_COLOR[deal.difficulty] ?? 'text-slate-400'}>{deal.difficulty}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">baza</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex gap-1.5 justify-end">
                        {isHidden(deal.id) ? (
                          <button
                            onClick={() => onRestore(deal.id)}
                            className="text-xs px-2.5 py-1 bg-emerald-900/40 text-emerald-400 rounded hover:bg-emerald-900/70 transition-colors border border-emerald-800/50"
                          >
                            Przywróć
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setBuilder({ type: 'clone', deal })}
                              className="text-xs px-2.5 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors border border-slate-600"
                            >
                              Klonuj
                            </button>
                            <button
                              onClick={() => onDelete(deal.id)}
                              className="text-xs px-2.5 py-1 bg-red-900/40 text-red-400 rounded hover:bg-red-900/70 transition-colors border border-red-800/50"
                            >
                              Usuń
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {customDeals.map(deal => (
                  <tr key={deal.id} className="border-b border-slate-700/50 bg-blue-950/20">
                    <td className="px-4 py-2.5">
                      <div className="text-white text-sm">{deal.title}</div>
                      <div className="text-slate-500 text-[10px] font-mono">{deal.id}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{deal.category}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className={DIFF_COLOR[deal.difficulty] ?? 'text-slate-400'}>{deal.difficulty}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-blue-400">własne</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => setBuilder({ type: 'edit', deal })}
                          className="text-xs px-2.5 py-1 bg-blue-900/40 text-blue-400 rounded hover:bg-blue-900/70 transition-colors border border-blue-800/50"
                        >
                          Edytuj
                        </button>
                        <button
                          onClick={() => onDelete(deal.id)}
                          className="text-xs px-2.5 py-1 bg-red-900/40 text-red-400 rounded hover:bg-red-900/70 transition-colors border border-red-800/50"
                        >
                          Usuń
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add deal + Export/Import */}
        <div className="space-y-4">
          <h2 className="text-slate-300 font-semibold text-xs uppercase tracking-wider">Zarządzanie własnymi rozdaniami</h2>

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
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl text-sm transition-colors border border-slate-600"
            >
              Importuj JSON
            </button>
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={importDeals} />
          </div>

          <p className="text-slate-500 text-xs">
            Własne rozdania zapisują się w localStorage przeglądarki — przeżywają reload i deploy na tym samym adresie URL.
            Użyj Eksport/Import jako backup przed zmianą domeny lub wyczyszczeniem danych przeglądarki.
          </p>
        </div>
      </div>
    </div>
  );
}

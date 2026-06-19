import { useState } from 'react';
import type { Deal } from '../types';

interface Props {
  baseDeals: Deal[];
  customDeals: Deal[];
  hiddenIds: string[];
  onAdd: (deal: Deal) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onBack: () => void;
}

export function AdminPanel({ baseDeals, customDeals, hiddenIds, onAdd, onDelete, onRestore, onBack }: Props) {
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    try {
      const deal = JSON.parse(jsonInput) as Deal;
      if (!deal.id || !deal.title) throw new Error('Brak wymaganych pól: id, title');
      onAdd(deal);
      setJsonInput('');
      setJsonError('');
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Błąd parsowania JSON');
    }
  };

  const isHidden = (id: string) => hiddenIds.includes(id);

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
        {/* Deal list */}
        <div>
          <h2 className="text-slate-300 font-semibold mb-3 text-xs uppercase tracking-wider">
            Rozdania ({baseDeals.length + customDeals.length} łącznie, {hiddenIds.length} ukrytych)
          </h2>
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-700/50">
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Tytuł</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Kategoria</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Trudność</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Źródło</th>
                  <th className="px-4 py-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {baseDeals.map(deal => (
                  <tr key={deal.id} className={`border-b border-slate-700/50 transition-opacity ${isHidden(deal.id) ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-2.5">
                      <div className="text-white text-sm">{deal.title}</div>
                      <div className="text-slate-500 text-[10px] font-mono">{deal.id}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{deal.category}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className={
                        deal.difficulty === 'Easy' ? 'text-emerald-400' :
                        deal.difficulty === 'Medium' ? 'text-yellow-400' : 'text-red-400'
                      }>{deal.difficulty}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">baza</td>
                    <td className="px-4 py-2.5 text-right">
                      {isHidden(deal.id) ? (
                        <button
                          onClick={() => onRestore(deal.id)}
                          className="text-xs px-2.5 py-1 bg-emerald-900/40 text-emerald-400 rounded hover:bg-emerald-900/70 transition-colors border border-emerald-800/50"
                        >
                          Przywróć
                        </button>
                      ) : (
                        <button
                          onClick={() => onDelete(deal.id)}
                          className="text-xs px-2.5 py-1 bg-red-900/40 text-red-400 rounded hover:bg-red-900/70 transition-colors border border-red-800/50"
                        >
                          Ukryj
                        </button>
                      )}
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
                      <span className={
                        deal.difficulty === 'Easy' ? 'text-emerald-400' :
                        deal.difficulty === 'Medium' ? 'text-yellow-400' : 'text-red-400'
                      }>{deal.difficulty}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-blue-400">własne</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => onDelete(deal.id)}
                        className="text-xs px-2.5 py-1 bg-red-900/40 text-red-400 rounded hover:bg-red-900/70 transition-colors border border-red-800/50"
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add deal via JSON */}
        <div>
          <h2 className="text-slate-300 font-semibold mb-3 text-xs uppercase tracking-wider">Dodaj nowe rozdanie (JSON)</h2>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
            <textarea
              value={jsonInput}
              onChange={e => { setJsonInput(e.target.value); setJsonError(''); setAdded(false); }}
              rows={14}
              placeholder={`{\n  "id": "deal-custom-001",\n  "title": "Tytuł rozdania",\n  "category": "Rozgrywający",\n  "difficulty": "Medium",\n  "contract": "3NT",\n  "declarer": "S",\n  "dealer": "W",\n  "vulnerability": "None",\n  "bidding": [["1NT","P","3NT","P"],["P","P"]],\n  "initialHands": { ... },\n  "introSequence": [ ... ],\n  "decisionPrompt": "...",\n  "solution": { "text": "...", "revealAllCards": {} }\n}`}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-y"
            />
            {jsonError && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-xs">
                Błąd: {jsonError}
              </div>
            )}
            {added && (
              <div className="bg-emerald-900/40 border border-emerald-700 rounded-lg px-3 py-2 text-emerald-300 text-xs">
                Rozdanie zostało dodane.
              </div>
            )}
            <button
              onClick={handleAdd}
              disabled={!jsonInput.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              Dodaj rozdanie
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

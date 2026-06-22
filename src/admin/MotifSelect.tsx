import { useState, useMemo, type KeyboardEvent } from 'react';
import type { Tag } from '../types';

interface Props {
  tags: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreate: (name: string) => Promise<Tag | null>;
}

const inputCls = 'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500';

/** Multi-select for motifs (pick existing) + explicit "+ Nowy motyw" inline add. */
export function MotifSelect({ tags, selectedIds, onChange, onCreate }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');

  const byId = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);
  const selected = selectedIds.map(id => byId.get(id)).filter((t): t is Tag => !!t);

  const q = query.trim().toLowerCase();
  const candidates = tags.filter(t => !selectedIds.includes(t.id) && (!q || t.name.toLowerCase().includes(q)));

  const add = (id: string) => { onChange([...selectedIds, id]); setQuery(''); };
  const remove = (id: string) => onChange(selectedIds.filter(x => x !== id));

  const createNew = async () => {
    const name = newName.trim();
    setErr('');
    if (!name) { setErr('Podaj nazwę motywu.'); return; }
    setCreating(true);
    const tag = await onCreate(name);
    setCreating(false);
    if (!tag) { setErr('Nie udało się dodać motywu.'); return; }
    if (!selectedIds.includes(tag.id)) onChange([...selectedIds, tag.id]);
    setNewName('');
    setAdding(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); if (candidates.length) add(candidates[0].id); }
    else if (e.key === 'Backspace' && !query && selected.length) remove(selected[selected.length - 1].id);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div
          className="flex flex-wrap gap-1.5 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 focus-within:border-blue-500 cursor-text"
          onClick={() => setOpen(true)}
        >
          {selected.map(t => (
            <span key={t.id} className="flex items-center gap-1 bg-blue-900/50 border border-blue-700 text-blue-200 text-xs rounded px-2 py-0.5">
              {t.name}
              <button type="button" onClick={(e) => { e.stopPropagation(); remove(t.id); }} className="text-blue-300 hover:text-white leading-none">×</button>
            </span>
          ))}
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            placeholder={selected.length ? '' : 'Wybierz motyw z listy…'}
            className="flex-1 min-w-[140px] bg-transparent text-white text-sm focus:outline-none"
          />
        </div>
        {open && candidates.length > 0 && (
          <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-slate-800 border border-slate-600 rounded-lg shadow-xl">
            {candidates.map(t => (
              <button key={t.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => add(t.id)}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700">
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={() => { setAdding(v => !v); setErr(''); }}
        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm border border-slate-600">
        {adding ? 'Anuluj' : '+ Nowy motyw'}
      </button>

      {adding && (
        <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createNew(); } }}
            placeholder="Nazwa motywu (np. Skucie atutowe)"
            className={inputCls}
          />
          {err && <div className="text-red-400 text-xs">{err}</div>}
          <button type="button" onClick={createNew} disabled={creating}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50">
            {creating ? 'Dodawanie…' : 'Dodaj motyw'}
          </button>
        </div>
      )}
    </div>
  );
}

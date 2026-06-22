import { useState, useMemo, type KeyboardEvent } from 'react';
import type { Tag } from '../types';

interface Props {
  tags: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreate: (name: string) => Promise<Tag | null>;
}

/** Creatable multi-select for technical motifs (tags). */
export function MotifSelect({ tags, selectedIds, onChange, onCreate }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const byId = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);
  const selected = selectedIds.map(id => byId.get(id)).filter((t): t is Tag => !!t);

  const q = query.trim().toLowerCase();
  const candidates = tags.filter(t => !selectedIds.includes(t.id) && (!q || t.name.toLowerCase().includes(q)));
  const exactExists = tags.some(t => t.name.toLowerCase() === q);

  const add = (id: string) => { onChange([...selectedIds, id]); setQuery(''); };
  const remove = (id: string) => onChange(selectedIds.filter(x => x !== id));

  const create = async () => {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    const tag = await onCreate(name);
    setCreating(false);
    if (tag && !selectedIds.includes(tag.id)) onChange([...selectedIds, tag.id]);
    setQuery('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (candidates.length) add(candidates[0].id);
      else if (q && !exactExists) create();
    } else if (e.key === 'Backspace' && !query && selected.length) {
      remove(selected[selected.length - 1].id);
    }
  };

  return (
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
          placeholder={selected.length ? '' : 'Wybierz lub wpisz motyw…'}
          className="flex-1 min-w-[140px] bg-transparent text-white text-sm focus:outline-none"
        />
      </div>

      {open && (candidates.length > 0 || (!!q && !exactExists)) && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-slate-800 border border-slate-600 rounded-lg shadow-xl">
          {candidates.map(t => (
            <button key={t.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => add(t.id)}
              className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700">
              {t.name}
            </button>
          ))}
          {q && !exactExists && (
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={create} disabled={creating}
              className="w-full text-left px-3 py-1.5 text-sm text-emerald-300 hover:bg-slate-700 border-t border-slate-700 disabled:opacity-50">
              {creating ? 'Dodawanie…' : `+ Dodaj „${query.trim()}”`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

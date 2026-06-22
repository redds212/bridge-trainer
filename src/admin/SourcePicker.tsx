import { useState } from 'react';
import type { Source, SourceType } from '../types';
import { SOURCE_TYPES } from '../types';

interface Props {
  sources: Source[];
  value: string | null;
  onChange: (id: string | null) => void;
  onCreate: (input: { name: string; sourceType: SourceType; sourceUrl: string }) => Promise<Source | { error: string }>;
  details: string;
  onDetailsChange: (v: string) => void;
}

const inputCls = 'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500';

/** Dropdown of reusable sources + inline "add new source" + free-text details. */
export function SourcePicker({ sources, value, onChange, onCreate, details, onDetailsChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<SourceType>('Książka');
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setErr('');
    if (!name.trim()) { setErr('Podaj nazwę źródła.'); return; }
    setSaving(true);
    const res = await onCreate({ name, sourceType: type, sourceUrl: url });
    setSaving(false);
    if ('error' in res) { setErr(res.error); return; }
    onChange(res.id);
    setAdding(false); setName(''); setUrl(''); setType('Książka');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select value={value ?? ''} onChange={e => onChange(e.target.value || null)} className={`${inputCls} flex-1`}>
          <option value="">— brak źródła —</option>
          {sources.map(s => <option key={s.id} value={s.id}>{s.name} ({s.sourceType})</option>)}
        </select>
        <button type="button" onClick={() => { setAdding(v => !v); setErr(''); }}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm border border-slate-600 whitespace-nowrap">
          {adding ? 'Anuluj' : '+ Nowe źródło'}
        </button>
      </div>

      {adding && (
        <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nazwa (książka, strona, turniej…)" className={inputCls} />
          <div className="flex gap-2">
            <select value={type} onChange={e => setType(e.target.value as SourceType)} className={`${inputCls} flex-1`}>
              {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL (opcjonalnie)" className={`${inputCls} flex-1`} />
          </div>
          {err && <div className="text-red-400 text-xs">{err}</div>}
          <button type="button" onClick={save} disabled={saving}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50">
            {saving ? 'Zapisywanie…' : 'Zapisz źródło'}
          </button>
        </div>
      )}

      <input value={details} onChange={e => onDetailsChange(e.target.value)}
        placeholder="Szczegóły (np. Rozdział 4, s. 52 lub Sesja 2, rozdanie 14)"
        className={inputCls} />
    </div>
  );
}

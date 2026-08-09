import { useState, type FormEvent } from 'react';
import { useAuth, MIN_PASSWORD_LENGTH } from './AuthContext';

const inputCls =
  'w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors';

/**
 * Zmiana hasła bez wychodzenia z aplikacji. Formularz startuje zwinięty, bo w
 * panelu poza nim są same ustawienia nauki — trzy pola haseł na wierzchu
 * przeciągałyby uwagę na coś, co robi się raz na rok.
 */
export function ChangePasswordCard() {
  const { user, changePassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const clear = () => { setCurrent(''); setNext(''); setConfirm(''); setError(''); };

  const toggle = () => {
    setOpen(o => !o);
    clear();
    setDone(false);
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setDone(false);
    if (!current) { setError('Podaj obecne hasło.'); return; }
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`Nowe hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`);
      return;
    }
    if (next === current) { setError('Nowe hasło musi się różnić od obecnego.'); return; }
    if (next !== confirm) { setError('Hasła nie są identyczne.'); return; }

    setSaving(true);
    try {
      const { error } = await changePassword(current, next);
      if (error) { setError(error); return; }
      clear();
      setOpen(false);
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-slate-200 font-semibold text-sm">Konto</h2>
          <p className="text-slate-500 text-xs mt-1 truncate">{user?.email}</p>
        </div>
        <button
          onClick={toggle}
          className="flex-shrink-0 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium border border-slate-600 transition-colors"
        >
          {open ? 'Anuluj' : 'Zmień hasło'}
        </button>
      </div>

      {done && !open && (
        <div className="text-emerald-400 text-xs bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2">
          ✓ Hasło zmienione. Od teraz loguj się nowym.
        </div>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-700 pt-4">
          {/* Menedżery haseł potrzebują pola z loginem, żeby wiedzieć, co nadpisać. */}
          <input type="email" value={user?.email ?? ''} autoComplete="username" readOnly hidden />

          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Obecne hasło</label>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)}
              autoComplete="current-password" placeholder="••••••••" className={inputCls} />
          </div>

          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Nowe hasło</label>
            <input type="password" value={next} onChange={e => setNext(e.target.value)}
              autoComplete="new-password" placeholder={`Minimum ${MIN_PASSWORD_LENGTH} znaków`} className={inputCls} />
          </div>

          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Powtórz nowe hasło</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password" placeholder="••••••••" className={inputCls} />
          </div>

          {error && (
            <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {saving ? 'Zapisywanie…' : 'Zapisz nowe hasło'}
          </button>
        </form>
      )}
    </section>
  );
}

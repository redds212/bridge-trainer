import { useState, type FormEvent } from 'react';
import { useAuth, MIN_PASSWORD_LENGTH } from './AuthContext';
import { AuthCard, ErrorNote, inputCls } from './AuthCard';

/**
 * Docelowy ekran linku „resetuj hasło". Sesja w tym momencie już istnieje —
 * supabase-js wymienia token z adresu przy starcie — więc jedyne, co dzieli
 * użytkownika od aplikacji, to ustawienie nowego hasła. Wyjście awaryjne
 * (wylogowanie) zostawiamy, bo inaczej link byłby pułapką bez powrotu.
 */
export function ResetPasswordPage() {
  const { setNewPassword, endRecovery, logout, user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`);
      return;
    }
    if (password !== confirm) { setError('Hasła nie są identyczne.'); return; }
    setSaving(true);
    try {
      const { error } = await setNewPassword(password);
      if (error) setError(error);
      else setDone(true);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <AuthCard>
        <div className="text-center text-[11px] text-brand-dim mt-2 mb-5">Hasło zmienione</div>
        <div className="text-center text-[34px] mb-3">✓</div>
        <p className="text-center text-[12px] text-brand-dim leading-relaxed mb-5">
          Od teraz loguj się nowym hasłem.
        </p>
        <button
          onClick={endRecovery}
          className="w-full font-display font-bold text-[14px] rounded-[9px] py-3 bg-brand-accent text-brand-btn-text hover:bg-brand-accent-soft transition-colors"
        >
          Przejdź do aplikacji
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="text-center text-[11px] text-brand-dim mt-2 mb-5">Ustaw nowe hasło</div>
      {user?.email && (
        <div className="text-[12px] text-brand-dim mb-[18px]">
          Konto <span className="text-brand-text">{user.email}</span>. Podaj hasło, którym będziesz się logować.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Menedżery haseł potrzebują pola z loginem, żeby wiedzieć, co nadpisać. */}
        <input type="email" value={user?.email ?? ''} autoComplete="username" readOnly hidden />

        <div>
          <label className="block text-[11px] font-semibold text-brand-dim mb-[7px]">Nowe hasło</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password"
            placeholder={`Minimum ${MIN_PASSWORD_LENGTH} znaków`} className={inputCls} />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-brand-dim mb-[7px]">Powtórz hasło</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password"
            placeholder="••••••••" className={inputCls} />
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <button type="submit" disabled={saving}
          className="w-full font-display font-bold text-[14px] rounded-[9px] py-3 bg-brand-accent text-brand-btn-text hover:bg-brand-accent-soft transition-colors disabled:opacity-60">
          {saving ? 'Zapisywanie…' : 'Zapisz hasło'}
        </button>

        <button type="button" onClick={logout} className="w-full text-[11px] text-brand-dim hover:text-brand-text">
          Anuluj i wyloguj się
        </button>
      </form>
    </AuthCard>
  );
}

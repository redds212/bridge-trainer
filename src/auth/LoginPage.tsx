import { useState, type FormEvent } from 'react';
import { useAuth, MIN_PASSWORD_LENGTH } from './AuthContext';
import { AuthCard, ErrorNote, InfoNote, inputCls } from './AuthCard';

type Mode = 'login' | 'register' | 'reset';

export function LoginPage() {
  const { login, register, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (m: Mode) => { setMode(m); setError(''); setInfo(''); };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setInfo('');
    if (!email.trim()) { setError('Podaj adres e-mail.'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await login(email, password);
        if (error) setError(error);
      } else if (mode === 'register') {
        if (!username.trim()) { setError('Podaj nazwę użytkownika.'); return; }
        if (password.length < MIN_PASSWORD_LENGTH) { setError(`Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`); return; }
        const { error, needsConfirmation } = await register(email, username, password);
        if (error) setError(error);
        else if (needsConfirmation) {
          setInfo('Konto utworzone. Sprawdź e-mail i potwierdź adres, a potem zaloguj się. Dostęp aktywuje administrator.');
          setMode('login');
        }
      } else {
        const { error } = await resetPassword(email);
        if (error) setError(error);
        else setInfo('Jeśli konto istnieje, wysłaliśmy link do resetu hasła na podany e-mail.');
      }
    } finally {
      setLoading(false);
    }
  }

  const title = mode === 'login' ? 'Zaloguj się' : mode === 'register' ? 'Utwórz konto' : 'Resetuj hasło';

  return (
    <AuthCard>
      <>
        <div className="text-center text-[11px] text-brand-dim mt-2 mb-5">System SRS — nauka przez powtarzanie</div>

        {/* Tabs (hidden in reset mode) */}
        {mode !== 'reset' ? (
          <div className="flex gap-[18px] border-b border-brand-line mb-[18px]">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => switchMode(t)}
                className={`text-[13px] font-semibold pb-2.5 transition-colors ${
                  mode === t ? 'text-brand-text border-b-2 border-brand-accent -mb-px' : 'text-brand-dim hover:text-brand-text'
                }`}
              >
                {t === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-brand-dim mb-[18px]">Podaj e-mail konta — wyślemy link do ustawienia nowego hasła.</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-brand-dim mb-[7px]">Adres e-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
              placeholder="np. jan@example.com" className={inputCls} />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-[11px] font-semibold text-brand-dim mb-[7px]">Nazwa użytkownika</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username"
                placeholder="np. jan_kowalski" className={inputCls} />
            </div>
          )}

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-[7px]">
                <label className="text-[11px] font-semibold text-brand-dim">Hasło</label>
                {mode === 'login' && (
                  <button type="button" onClick={() => switchMode('reset')} className="text-[11px] text-brand-accent-soft hover:underline">
                    Nie pamiętasz hasła?
                  </button>
                )}
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'register' ? `Minimum ${MIN_PASSWORD_LENGTH} znaków` : '••••••••'} className={inputCls} />
            </div>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}
          {info && <InfoNote>{info}</InfoNote>}

          <button type="submit" disabled={loading}
            className="w-full font-display font-bold text-[14px] rounded-[9px] py-3 bg-brand-accent text-brand-btn-text hover:bg-brand-accent-soft transition-colors disabled:opacity-60">
            {loading ? 'Ładowanie…' : title}
          </button>

          {mode === 'reset' && (
            <button type="button" onClick={() => switchMode('login')} className="w-full text-[11px] text-brand-dim hover:text-brand-text">
              ← Powrót do logowania
            </button>
          )}
        </form>

        <div className="text-center text-[10px] leading-normal text-brand-dim mt-4">
          Nowe konta wymagają akceptacji administratora przed pełnym dostępem.{' '}
          <a href="mailto:kontakt@bridgeloop.pl" className="text-brand-accent-soft hover:underline">
            kontakt@bridgeloop.pl
          </a>
        </div>
      </>
    </AuthCard>
  );
}

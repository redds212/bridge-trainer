import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';

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
        if (password.length < 6) { setError('Hasło musi mieć co najmniej 6 znaków.'); return; }
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🃏</div>
          <h1 className="text-white text-2xl font-bold">Trenażer Brydżowy</h1>
          <p className="text-slate-400 text-sm mt-1">System SRS — nauka przez powtarzanie</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
          {mode !== 'reset' && (
            <div className="flex border-b border-slate-700">
              {(['login', 'register'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => switchMode(t)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    mode === t
                      ? 'text-white bg-slate-700/50 border-b-2 border-blue-500'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {t === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {mode === 'reset' && (
              <p className="text-slate-400 text-xs">Podaj e-mail konta — wyślemy link do ustawienia nowego hasła.</p>
            )}

            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5">Adres e-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="np. jan@example.com"
                autoComplete="email"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1.5">Nazwa użytkownika</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="np. jan_kowalski"
                  autoComplete="username"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            )}

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-300 text-xs font-medium">Hasło</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => switchMode('reset')} className="text-blue-400 hover:text-blue-300 text-xs">
                      Nie pamiętasz hasła?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Minimum 6 znaków' : '••••••••'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-xs">{error}</div>
            )}
            {info && (
              <div className="bg-emerald-900/40 border border-emerald-700 rounded-lg px-3 py-2 text-emerald-300 text-xs">{info}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              {loading ? 'Ładowanie...' : title}
            </button>

            {mode === 'reset' && (
              <button type="button" onClick={() => switchMode('login')} className="w-full text-slate-400 hover:text-slate-300 text-xs">
                ← Powrót do logowania
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          Nowe konta wymagają akceptacji administratora przed pełnym dostępem.
        </p>
      </div>
    </div>
  );
}

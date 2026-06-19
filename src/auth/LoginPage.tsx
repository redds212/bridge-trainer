import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError('');
    setLoading(true);

    if (tab === 'login') {
      const result = await login(username.trim(), password);
      if (result === 'bad_credentials') setError('Nieprawidłowa nazwa użytkownika lub hasło.');
    } else {
      if (password.length < 4) { setError('Hasło musi mieć co najmniej 4 znaki.'); setLoading(false); return; }
      const result = await register(username.trim(), password);
      if (result === 'taken') setError('Ta nazwa użytkownika jest już zajęta.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🃏</div>
          <h1 className="text-white text-2xl font-bold">Trenażer Brydżowy</h1>
          <p className="text-slate-400 text-sm mt-1">System SRS — nauka przez powtarzanie</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
          {/* Tabs */}
          <div className="flex border-b border-slate-700">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'text-white bg-slate-700/50 border-b-2 border-blue-500'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {t === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5">Hasło</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={tab === 'register' ? 'Minimum 4 znaki' : '••••••••'}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              {loading ? 'Ładowanie...' : tab === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
            </button>
          </form>
        </div>

        {/* Admin hint */}
        <p className="text-center text-slate-600 text-xs mt-4">
          Panel admina: <span className="text-slate-500">admin / admin1</span>
        </p>
      </div>
    </div>
  );
}

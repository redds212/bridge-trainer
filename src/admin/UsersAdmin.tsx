import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useUsers } from '../hooks/useUsers';

interface OpResult { error?: string }

export function UsersAdmin() {
  const { user } = useAuth();
  const { users, loading, error, approve, revoke, setAdmin, deleteUser } = useUsers();
  const [flash, setFlash] = useState('');
  const [flashErr, setFlashErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash(''), 4000); };
  const showErr = (m: string) => { setFlashErr(m); setTimeout(() => setFlashErr(''), 6000); };

  const run = async (op: () => Promise<OpResult>, ok: string) => {
    setBusy(true);
    const r = await op();
    setBusy(false);
    if (r.error) showErr('Błąd: ' + r.error);
    else showFlash(ok);
  };

  const pendingCount = users.filter(u => u.status === 'pending').length;

  return (
    <div className="space-y-6">
      {flash && <div className="bg-emerald-900/40 border border-emerald-700 rounded-lg px-4 py-2 text-emerald-300 text-sm">✓ {flash}</div>}
      {flashErr && <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-2 text-red-300 text-sm">✗ {flashErr}</div>}
      {error && <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-2 text-red-300 text-sm">Nie udało się wczytać użytkowników: {error}</div>}

      <div>
        <h2 className="text-slate-300 font-semibold text-xs uppercase tracking-wider mb-3">
          Użytkownicy ({users.length}{pendingCount ? `, ${pendingCount} oczekujących` : ''})
        </h2>

        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
          {loading && users.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">Ładowanie użytkowników…</div>
          ) : users.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">Brak użytkowników.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-700/50">
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Użytkownik</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Status</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Rola</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Utworzono</th>
                  <th className="px-4 py-2 w-72"></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isSelf = u.id === user?.id;
                  const confirming = confirmDelete === u.id;
                  return (
                    <tr key={u.id} className="border-b border-slate-700/50">
                      <td className="px-4 py-2.5">
                        <div className="text-white text-sm">
                          {u.username || '—'} {isSelf && <span className="text-slate-500 text-[10px]">(to Ty)</span>}
                        </div>
                        <div className="text-slate-500 text-[10px] font-mono">{u.id.slice(0, 8)}…</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {u.status === 'approved'
                          ? <span className="text-emerald-400">zaakceptowany</span>
                          : <span className="text-amber-400">oczekuje</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {u.isAdmin ? <span className="text-blue-400">admin</span> : <span className="text-slate-500">użytkownik</span>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">
                        {new Date(u.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isSelf ? (
                          <span className="text-slate-600 text-xs">—</span>
                        ) : confirming ? (
                          <div className="flex gap-1.5 justify-end items-center">
                            <span className="text-red-300 text-xs mr-1">Usunąć konto na zawsze?</span>
                            <button
                              onClick={async () => { setConfirmDelete(null); await run(() => deleteUser(u.id), 'Konto usunięte.'); }}
                              disabled={busy}
                              className="text-xs px-2.5 py-1 bg-red-600 text-white rounded hover:bg-red-500 transition-colors disabled:opacity-50"
                            >
                              Tak, usuń
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs px-2.5 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors border border-slate-600"
                            >
                              Anuluj
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5 justify-end">
                            {u.status === 'pending' ? (
                              <button
                                onClick={() => run(() => approve(u.id), 'Konto zaakceptowane.')}
                                disabled={busy}
                                className="text-xs px-2.5 py-1 bg-emerald-900/40 text-emerald-400 rounded hover:bg-emerald-900/70 transition-colors border border-emerald-800/50 disabled:opacity-50"
                              >
                                Zaakceptuj
                              </button>
                            ) : (
                              <button
                                onClick={() => run(() => revoke(u.id), 'Cofnięto akceptację.')}
                                disabled={busy}
                                className="text-xs px-2.5 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors border border-slate-600 disabled:opacity-50"
                              >
                                Cofnij
                              </button>
                            )}
                            <button
                              onClick={() => run(() => setAdmin(u.id, !u.isAdmin), u.isAdmin ? 'Odebrano admina.' : 'Nadano admina.')}
                              disabled={busy}
                              className="text-xs px-2.5 py-1 bg-blue-900/40 text-blue-400 rounded hover:bg-blue-900/70 transition-colors border border-blue-800/50 disabled:opacity-50"
                            >
                              {u.isAdmin ? 'Odbierz admina' : 'Nadaj admina'}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(u.id)}
                              disabled={busy}
                              className="text-xs px-2.5 py-1 bg-red-900/40 text-red-400 rounded hover:bg-red-900/70 transition-colors border border-red-800/50 disabled:opacity-50"
                            >
                              Usuń
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-slate-500 text-xs mt-3">
          Nowe konta są domyślnie „oczekujące" i nie mają dostępu do rozdań ani SRS, dopóki ich nie zaakceptujesz.
          „Usuń" trwale kasuje konto i wszystkie jego postępy (operacja nieodwracalna).
        </p>
      </div>
    </div>
  );
}

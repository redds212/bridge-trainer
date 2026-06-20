import { useMemo, useState, Fragment } from 'react';
import type { Deal, SRSStore, SRSEntry, UserSettings, Attempt, LearningMode } from '../types';
import { normalizeEntry } from '../lib/srs';
import { generateDailySession, modeSplit, MODE_LABELS, MODE_PROPORTIONS } from '../lib/session';
import { todayKey, toDateKey, formatDayKey } from '../lib/date';
import { DAILY_TARGET_MIN, DAILY_TARGET_MAX } from '../hooks/useSettings';
import type { HistoryStats } from '../hooks/useHistory';

interface Props {
  deals: Deal[];
  store: SRSStore;
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
  attempts: Attempt[];
  stats: HistoryStats;
  onReplay: (dealId: string) => void;
  onStartSession: () => void;
  onClearHistory: () => void;
  onResetProgress: () => void | Promise<void>;
  onBack: () => void;
}

const MODES: LearningMode[] = ['maintenance', 'balanced', 'intensive'];

export function UserPanel({
  deals, store, settings, updateSettings, attempts, stats,
  onReplay, onStartSession, onClearHistory, onResetProgress, onBack,
}: Props) {
  const [showRepeats, setShowRepeats] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const doReset = async () => {
    setResetting(true);
    await onResetProgress();
    setResetting(false);
    setShowResetConfirm(false);
  };

  const titleOf = useMemo(() => {
    const m = new Map(deals.map(d => [d.id, d.title]));
    return (id: string) => m.get(id) ?? id;
  }, [deals]);

  const entryOf = (id: string): SRSEntry => normalizeEntry(store[id]);

  const session = useMemo(
    () => generateDailySession(deals, store, settings),
    [deals, store, settings],
  );
  const split = modeSplit(settings);

  const masteredCount = useMemo(
    () => deals.filter(d => entryOf(d.id).status === 'MASTERED').length,
    [deals, store],
  );

  // Future repeats grouped by review day (excludes mastered / new-unscheduled).
  const repeatsByDay = useMemo(() => {
    const today = todayKey();
    const groups = new Map<string, { id: string; title: string; wrong: boolean }[]>();
    for (const deal of deals) {
      const e = entryOf(deal.id);
      if (e.status === 'MASTERED') continue;
      const key = toDateKey(e.nextReviewDate);
      if (!key) continue;
      const dayKey = key < today ? today : key; // overdue shown under "dziś"
      const wrong = e.status === 'LEARNING' && e.interval === 1;
      let bucket = groups.get(dayKey);
      if (!bucket) { bucket = []; groups.set(dayKey, bucket); }
      bucket.push({ id: deal.id, title: deal.title, wrong });
    }
    return [...groups.entries()]
      .map(([day, items]) => ({ day, items, wrongCount: items.filter(i => i.wrong).length }))
      .sort((a, b) => (a.day < b.day ? -1 : 1));
  }, [deals, store]);

  const recentAttempts = useMemo(
    () => [...attempts].reverse().slice(0, 40),
    [attempts],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <button onClick={onBack} className="text-slate-400 hover:text-white text-sm flex items-center gap-1.5 transition-colors">
          ← Powrót
        </button>
        <h1 className="text-white font-bold">Panel Użytkownika</h1>
        <span className="text-slate-500 text-xs">Postępy i ustawienia nauki</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon="🔥" value={`${stats.streak}`} label={stats.streak === 1 ? 'dzień z rzędu' : 'dni z rzędu'} accent="text-orange-400" />
          <StatCard icon="📊" value={stats.avgPerDay ? stats.avgPerDay.toFixed(1) : '0'} label="śr. dziennie" accent="text-sky-400" />
          <StatCard icon="✅" value={`${stats.totalAttempts}`} label="rozwiązanych łącznie" accent="text-emerald-400" />
          <StatCard icon="🏆" value={`${masteredCount}`} label="opanowanych" accent="text-violet-400" />
        </div>

        {/* Today's session */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-slate-200 font-semibold text-sm">Dzisiejsza sesja</h2>
            <span className="text-slate-500 text-xs">{formatDayKey(session.date)} · cel {settings.dailyTarget}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SessionStat value={session.retryCount} label="Powtórki błędów" color="text-red-400" sub="z wczoraj" />
            <SessionStat value={session.reviewCount} label="Powtórki" color="text-yellow-400" sub="zaplanowane" />
            <SessionStat value={session.newCount} label="Nowe" color="text-sky-400" sub="nigdy nierozwiązane" />
          </div>
          {session.deferredReviewIds.length > 0 && (
            <div className="text-amber-400/80 text-xs mb-3">
              ↪ {session.deferredReviewIds.length} powtórek przekracza dzienny limit — przesunięte na kolejny dzień.
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onStartSession}
              disabled={session.slots.length === 0}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors shadow"
            >
              {session.slots.length ? `Rozpocznij sesję (${session.slots.length})` : 'Brak rozdań na dziś'}
            </button>
            {stats.solvedToday > 0 && (
              <span className="text-emerald-400/80 text-xs">Dziś rozwiązano: {stats.solvedToday}</span>
            )}
          </div>
        </section>

        {/* Settings: daily target + mode */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-5">
          <h2 className="text-slate-200 font-semibold text-sm">Ustawienia nauki</h2>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-300 text-sm">Rozdań dziennie (X)</label>
              <span className="text-white font-bold text-lg tabular-nums">{settings.dailyTarget}</span>
            </div>
            <input
              type="range"
              min={DAILY_TARGET_MIN}
              max={DAILY_TARGET_MAX}
              value={settings.dailyTarget}
              onChange={e => updateSettings({ dailyTarget: Number(e.target.value) })}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-slate-600 text-[10px] mt-1">
              <span>{DAILY_TARGET_MIN}</span>
              <span className="text-slate-500">sugerowane 10</span>
              <span>{DAILY_TARGET_MAX}</span>
            </div>
            <div className="mt-3 flex gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-yellow-900/30 text-yellow-400 border border-yellow-800/40">
                {split.reviewLimit} powtórek
              </span>
              <span className="px-2 py-1 rounded bg-sky-900/30 text-sky-400 border border-sky-800/40">
                {split.newLimit} nowych
              </span>
              <span className="px-2 py-1 rounded bg-slate-700/50 text-slate-400 border border-slate-600">
                {Math.round(MODE_PROPORTIONS[settings.mode].newPct * 100)}% / {Math.round(MODE_PROPORTIONS[settings.mode].reviewPct * 100)}%
              </span>
            </div>
          </div>

          <div>
            <label className="text-slate-300 text-sm block mb-2">Tryb nauki</label>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map(m => {
                const active = settings.mode === m;
                const p = MODE_PROPORTIONS[m];
                return (
                  <button
                    key={m}
                    onClick={() => updateSettings({ mode: m })}
                    className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      active
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-semibold">{MODE_LABELS[m]}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {Math.round(p.newPct * 100)}% nowych
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Future repeats — expandable */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <button
            onClick={() => setShowRepeats(v => !v)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
          >
            <h2 className="text-slate-200 font-semibold text-sm">
              Plan powtórek na kolejne dni
              <span className="text-slate-500 font-normal ml-2">({repeatsByDay.length} dni)</span>
            </h2>
            <span className="text-slate-400 text-xs">{showRepeats ? '▲ zwiń' : '▼ rozwiń'}</span>
          </button>

          {showRepeats && (
            <div className="border-t border-slate-700">
              {repeatsByDay.length === 0 ? (
                <div className="px-5 py-6 text-center text-slate-500 text-sm">
                  Brak zaplanowanych powtórek. Rozwiąż kilka rozdań, aby zbudować plan.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 text-xs border-b border-slate-700/70">
                      <th className="px-5 py-2 font-medium">Dzień</th>
                      <th className="px-3 py-2 font-medium text-center">Rozdań</th>
                      <th className="px-3 py-2 font-medium text-center">Błędne</th>
                      <th className="px-5 py-2 font-medium text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {repeatsByDay.map(({ day, items, wrongCount }) => {
                      const open = expandedDay === day;
                      return (
                        <Fragment key={day}>
                          <tr
                            className="border-b border-slate-700/40 hover:bg-slate-700/20 cursor-pointer"
                            onClick={() => setExpandedDay(open ? null : day)}
                          >
                            <td className="px-5 py-2.5 text-slate-200 capitalize">{formatDayKey(day)}</td>
                            <td className="px-3 py-2.5 text-center text-slate-300">{items.length}</td>
                            <td className="px-3 py-2.5 text-center">
                              {wrongCount > 0
                                ? <span className="text-red-400 font-medium">{wrongCount}</span>
                                : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="px-5 py-2.5 text-right text-slate-500 text-xs">{open ? '▲' : '▼'}</td>
                          </tr>
                          {open && (
                            <tr className="bg-slate-900/40">
                              <td colSpan={4} className="px-5 py-3">
                                <div className="flex flex-col gap-1.5">
                                  {items.map(it => (
                                    <button
                                      key={it.id}
                                      onClick={() => onReplay(it.id)}
                                      className="flex items-center gap-2 text-left text-xs hover:text-white transition-colors group"
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${it.wrong ? 'bg-red-500' : 'bg-yellow-400'}`} />
                                      <span className="text-slate-300 group-hover:text-white">{it.title}</span>
                                      {it.wrong && <span className="text-red-400/70 text-[10px]">błędne</span>}
                                      <span className="text-blue-400/0 group-hover:text-blue-400 text-[10px] ml-auto">otwórz →</span>
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

        {/* History */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-700">
            <h2 className="text-slate-200 font-semibold text-sm">
              Historia rozwiązań
              <span className="text-slate-500 font-normal ml-2">({attempts.length})</span>
            </h2>
            {attempts.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors"
              >
                Wyczyść
              </button>
            )}
          </div>
          {recentAttempts.length === 0 ? (
            <div className="px-5 py-6 text-center text-slate-500 text-sm">
              Jeszcze nie rozwiązano żadnego rozdania.
            </div>
          ) : (
            <div className="divide-y divide-slate-700/40 max-h-96 overflow-y-auto">
              {recentAttempts.map((a, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3 hover:bg-slate-700/20">
                  <span className={`text-base flex-shrink-0 ${a.correct ? 'text-emerald-400' : 'text-red-400'}`}>
                    {a.correct ? '✓' : '✗'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-200 text-sm truncate">{titleOf(a.dealId)}</div>
                    <div className="text-slate-500 text-[10px]">
                      {new Date(a.ts).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {a.phase === 'buffer' && <span className="text-amber-400/70 ml-1.5">· bufor sesji</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => onReplay(a.dealId)}
                    className="text-xs px-2.5 py-1 bg-slate-700 text-slate-300 rounded hover:bg-blue-600 hover:text-white border border-slate-600 transition-colors flex-shrink-0"
                  >
                    Rozwiąż ↻
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reset zone */}
        <section className="bg-slate-800 rounded-xl border border-red-900/40 p-5">
          <h2 className="text-red-400 font-semibold text-sm mb-1">Strefa resetu</h2>
          <p className="text-slate-500 text-xs mb-4">
            Wyzeruj wszystkie swoje postępy — harmonogram powtórek wróci do stanu „Nowe",
            a historia rozwiązań i streak zostaną usunięte. Rozdania pozostają nietknięte.
          </p>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-5 py-2.5 bg-red-900/40 hover:bg-red-900/70 text-red-300 font-medium rounded-lg text-sm transition-colors border border-red-800/50"
          >
            Usuń postępy
          </button>
        </section>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-2xl p-7 max-w-sm w-full text-center shadow-2xl">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-white font-bold text-lg mb-2">Usunąć wszystkie postępy?</h3>
            <p className="text-slate-400 text-sm mb-6">
              Wszystkie rozdania wrócą do statusu „Nowe", a historia rozwiązań i streak zostaną
              wyczyszczone. Tej operacji nie można cofnąć.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={doReset}
                disabled={resetting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                {resetting ? 'Usuwanie…' : 'Tak, usuń postępy'}
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium border border-slate-600 transition-colors disabled:opacity-50"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, accent }: { icon: string; value: string; label: string; accent: string }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col items-center text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-slate-500 text-[10px] mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

function SessionStat({ value, label, sub, color }: { value: number; label: string; sub: string; color: string }) {
  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-700/60 p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-slate-300 text-xs mt-1">{label}</div>
      <div className="text-slate-600 text-[10px]">{sub}</div>
    </div>
  );
}

import { useState } from 'react';
import type { Deal, Difficulty, SRSEntry, SRSStatus } from '../types';
import { useAuth } from '../auth/AuthContext';
import { filterDeals } from '../lib/dealSearch';
import { DIFF_COLOR } from '../lib/difficulty';
import { LoopMark } from './LoopMark';
import { DifficultyFilter } from './DifficultyFilter';
import { Icon } from './Icon';

interface Props {
  deals: Deal[];
  /** Dzisiejsza kolejka SRS — najwyżej `dailyTarget` pozycji, w kolejności sesji. */
  todayDeals: Deal[];
  selectedId: string | null;
  getEntry: (id: string) => SRSEntry;
  onSelect: (id: string) => void;
  /** Fraza wyszukiwania — stan trzyma `AppShell`, bo używa go też „Następne →". */
  query: string;
  onQueryChange: (query: string) => void;
  /** Wybrane poziomy trudności; pusto = bez filtru. Stan również w `AppShell`,
      z tego samego powodu co fraza (DEAL_SEARCH_PLAN.md, D5). */
  difficulties: readonly Difficulty[];
  onToggleDifficulty: (difficulty: Difficulty) => void;
  onAdmin?: () => void;
  onPanel?: () => void;
}

// Status dot — amber for active/review, dim for new (docs/design/README.md).
const STATUS_DOT: Record<SRSStatus, string> = {
  NEW: 'bg-brand-dim',
  LEARNING: 'bg-brand-accent-2',
  REVIEW: 'bg-brand-accent-2',
  MASTERED: 'bg-brand-accent',
};

const STATUS_LABEL: Record<SRSStatus, string> = {
  NEW: 'Nowe',
  LEARNING: 'Nauka',
  REVIEW: 'Powtórka',
  MASTERED: 'Opanowane',
};

export function Sidebar({ deals, todayDeals, selectedId, getEntry, onSelect, query, onQueryChange, difficulties, onToggleDifficulty, onAdmin, onPanel }: Props) {
  const { user, logout } = useAuth();
  // Rekomendacje domyślnie rozwinięte — to one mówią, co dziś ćwiczyć. Zwinięcie
  // oddaje ~80 px liście, gdy użytkownik przyszedł tu szukać, a nie powtarzać.
  // Stan lokalny (nie w `AppShell`): dotyczy wyłącznie wyglądu tego bloku.
  const [showToday, setShowToday] = useState(true);
  // Filtry obejmują wyłącznie listę poniżej: rekomendacje i liczniki w stopce liczą
  // się z pełnego zbioru, żeby wpisana fraza ani wybrany poziom nie chowały tego, co
  // jest na dziś do powtórki, ani nie majstrowały przy statystykach (D1).
  const visible = filterDeals(deals, query, difficulties);
  const trimmedQuery = query.trim();
  const filtered = trimmedQuery.length > 0 || difficulties.length > 0;
  // Puls na kropce znaczy „jest w dzisiejszej kolejce", a nie „zaległe": `isReviewDue`
  // jest prawdziwe dla każdego rozdania NEW, więc migała cała lista naraz.
  const plannedIds = new Set(todayDeals.map(d => d.id));

  // Grupowanie PO filtrowaniu — kategoria bez trafień znika razem z nagłówkiem.
  const byCategory = visible.reduce<Record<string, Deal[]>>((acc, d) => {
    (acc[d.category] ??= []).push(d);
    return acc;
  }, {});

  return (
    // Szuflada sięga krawędzi ekranu (fixed inset-y-0), więc bierze na siebie
    // górne i lewe wcięcie bezpieczne — na desktopie oba wychodzą 0.
    <div
      className="w-64 bg-brand-panel border-r border-brand-line flex flex-col h-full overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)' }}
    >
      {/* Brand header */}
      <div className="px-4 py-3 flex items-center gap-2.5 border-b border-brand-line">
        <LoopMark size={34} />
        <div className="min-w-0">
          <div className="font-display font-bold text-[16px] leading-none tracking-[-0.02em]">
            <span className="text-brand-text">Bridge</span><span className="text-brand-accent-soft">Loop</span>
          </div>
          <div className="text-brand-dim text-[10px] mt-1">System SRS</div>
        </div>
      </div>

      {/* User bar */}
      {user && (
        <div className="px-3 py-2.5 border-b border-brand-line">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-[26px] h-[26px] rounded-full bg-brand-soft flex items-center justify-center flex-shrink-0 text-brand-accent-soft text-xs font-semibold uppercase">
              {user.username.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="text-brand-text text-xs font-medium truncate">{user.username}</div>
              <div className="text-brand-dim text-[10px] leading-none">{user.isAdmin ? 'Administrator' : 'Użytkownik'}</div>
            </div>
          </div>
          <div className="flex items-center gap-[5px]">
            {onPanel && (
              <button
                onClick={onPanel}
                className="flex flex-1 items-center justify-center gap-1 text-[10px] font-semibold px-1 py-[5px] rounded-[7px] bg-brand-soft text-brand-accent-soft border border-brand-line hover:bg-brand-line/60 transition-colors"
              >
                <Icon name="user" size={11} />
                Mój panel
              </button>
            )}
            {user.isAdmin && onAdmin && (
              <button
                onClick={onAdmin}
                className="flex flex-1 items-center justify-center gap-1 text-[10px] font-semibold px-1 py-[5px] rounded-[7px] bg-brand-soft text-brand-accent-2 border border-brand-line hover:bg-brand-line/60 transition-colors"
              >
                <Icon name="shield" size={11} />
                Admin
              </button>
            )}
            {/* Sama ikona: „Wyloguj" zjadało trzecią część rzędu przy foncie 10 px.
                Bez etykiety obowiązkowe aria-label i tooltip. */}
            <button
              onClick={logout}
              aria-label="Wyloguj"
              title="Wyloguj"
              className="flex flex-shrink-0 items-center justify-center w-7 py-[5px] rounded-[7px] bg-[rgba(224,82,77,.12)] text-[#e0524d] border border-[rgba(224,82,77,.3)] hover:bg-[rgba(224,82,77,.2)] transition-colors"
            >
              <Icon name="logout" size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Due today — zwijane. Po zwinięciu zostaje sam nagłówek z licznikiem, więc
          „ile jest na dziś" widać nadal; znika tylko lista trzech pozycji. */}
      {todayDeals.length > 0 && (
        <div className="mx-3 my-2 px-3 py-2 bg-brand-soft rounded-[9px]">
          <button
            onClick={() => setShowToday(v => !v)}
            aria-expanded={showToday}
            title={showToday ? 'Zwiń rekomendacje' : 'Rozwiń rekomendacje'}
            // `py-1 -my-1`: sam wiersz nagłówka ma 15 px wysokości, czyli za mało na
            // kciuka. Padding powiększa cel dotyku do ~23 px, a ujemny margines zdejmuje
            // go z układu, więc blok wygląda dokładnie tak jak przedtem.
            className="w-full flex items-center gap-1.5 py-1 -my-1 text-brand-accent-2 text-[10px] font-semibold uppercase tracking-wider hover:text-brand-accent-2/80 transition-colors"
          >
            <span className="flex-1 min-w-0 text-left truncate">★ Rekomendowane na dziś ({todayDeals.length})</span>
            <Icon
              name="chevron-down"
              size={13}
              className={`flex-shrink-0 transition-transform duration-150 ${showToday ? '' : '-rotate-90'}`}
            />
          </button>
          {showToday && (
            <div className="mt-1.5">
              {todayDeals.slice(0, 3).map(d => (
                <button
                  key={d.id}
                  onClick={() => onSelect(d.id)}
                  className={`w-full text-left text-xs py-1 px-2 rounded-[7px] transition-colors mb-0.5 ${
                    selectedId === d.id ? 'bg-brand-line/60 text-brand-text' : 'text-brand-text/90 hover:bg-brand-line/40'
                  }`}
                >
                  {d.title}
                </button>
              ))}
              {todayDeals.length > 3 && (
                <div className="text-brand-dim text-[10px] mt-1 pl-2">+{todayDeals.length - 3} więcej…</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Wyszukiwarka i filtr trudności — zawsze widoczne i POZA kontenerem
          przewijania, więc zostają na miejscu, gdy lista jedzie pod nimi. Bez
          autofocusa: na telefonie podnosiłby klawiaturę przy każdym otwarciu
          szuflady (D8). */}
      <div className="px-3 pt-2 pb-1.5 flex-shrink-0 space-y-1.5">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-dim pointer-events-none">
            <Icon name="search" size={13} />
          </span>
          <input
            type="text"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onQueryChange(''); }}
            placeholder="Szukaj rozdania…"
            aria-label="Szukaj rozdania"
            className="w-full bg-brand-soft border border-brand-line rounded-[7px] text-brand-text placeholder:text-brand-dim text-xs pl-[30px] pr-7 py-1.5 outline-none focus:border-brand-accent/60 transition-colors"
          />
          {query && (
            <button
              onClick={() => onQueryChange('')}
              aria-label="Wyczyść wyszukiwanie"
              title="Wyczyść"
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-brand-dim hover:text-brand-text transition-colors"
            >
              <Icon name="close" size={12} />
            </button>
          )}
        </div>

        <DifficultyFilter selected={difficulties} onToggle={onToggleDifficulty} />
      </div>

      {/* Deal list by category */}
      <div className="flex-1 overflow-y-auto py-2">
        {visible.length === 0 && filtered && (
          <div className="px-4 py-3 text-brand-dim text-[11px] leading-relaxed">
            {/* Komunikat nazywa ten filtr, który faktycznie działa — inaczej przy
                aktywnych chipach i pustej frazie panel milczał na temat przyczyny. */}
            {trimmedQuery && difficulties.length > 0
              ? <>Brak rozdań pasujących do „{trimmedQuery}” w wybranej trudności.</>
              : trimmedQuery
                ? <>Brak rozdań pasujących do „{trimmedQuery}”.</>
                : <>Brak rozdań o wybranej trudności.</>}
          </div>
        )}
        {Object.entries(byCategory).map(([cat, catDeals]) => (
          <div key={cat}>
            <div className="px-4 py-1.5 text-brand-dim text-[10px] font-semibold uppercase tracking-wider">
              {cat}
            </div>
            {catDeals.map(deal => {
              const entry = getEntry(deal.id);
              const planned = plannedIds.has(deal.id);
              const isSelected = selectedId === deal.id;

              return (
                <button
                  key={deal.id}
                  onClick={() => onSelect(deal.id)}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors border-l-2 ${
                    isSelected ? 'bg-brand-soft border-brand-accent' : 'border-transparent hover:bg-brand-soft/60'
                  }`}
                >
                  {/* SRS dot */}
                  <div className="mt-1 flex flex-col items-center gap-0.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[entry.status]} ${planned ? 'animate-pulse' : ''}`} />
                  </div>

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium leading-snug truncate ${isSelected ? 'text-brand-text' : 'text-brand-text/85'}`}>
                      {deal.title}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px]" style={{ color: DIFF_COLOR[deal.difficulty] ?? '#8a97ad' }}>{deal.difficulty}</span>
                      <span className="text-brand-dim text-[10px]">·</span>
                      <span className="text-[10px] text-brand-dim">{STATUS_LABEL[entry.status]}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Stats footer */}
      <div className="px-3 py-2 border-t border-brand-line">
        <div className="grid grid-cols-3 gap-1 text-center">
          {(['NEW', 'LEARNING', 'MASTERED'] as const).map(s => (
            <div key={s}>
              <div className={`text-sm font-bold font-display ${STATUS_DOT[s].replace('bg-', 'text-')}`}>
                {deals.filter(d => getEntry(d.id).status === s).length}
              </div>
              <div className="text-brand-dim text-[9px]">{STATUS_LABEL[s].slice(0, 3)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

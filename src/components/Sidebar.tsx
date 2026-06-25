import type { Deal, SRSEntry, SRSStatus } from '../types';
import { isReviewDue } from '../hooks/useSRS';
import { useAuth } from '../auth/AuthContext';
import { LoopMark } from './LoopMark';

interface Props {
  deals: Deal[];
  selectedId: string | null;
  getEntry: (id: string) => SRSEntry;
  onSelect: (id: string) => void;
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

// Difficulty scale within the brand palette: green → amber → orange → red.
const DIFF_COLOR: Record<string, string> = {
  Easy: '#34d399',   // brand-accent-soft
  Medium: '#fbbf24', // brand-accent-2 (amber)
  Hard: '#df8a2e',   // diamond orange
  Expert: '#e0524d', // brand-danger (red)
};

export function Sidebar({ deals, selectedId, getEntry, onSelect, onAdmin, onPanel }: Props) {
  const { user, logout } = useAuth();
  const dueToday = deals.filter(d => isReviewDue(getEntry(d.id)));

  const byCategory = deals.reduce<Record<string, Deal[]>>((acc, d) => {
    (acc[d.category] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="w-64 bg-brand-panel border-r border-brand-line flex flex-col h-full overflow-hidden">
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
                className="flex-1 text-[10px] font-semibold px-1 py-[5px] rounded-[7px] bg-brand-soft text-brand-accent-soft border border-brand-line hover:bg-brand-line/60 transition-colors"
              >
                Mój panel
              </button>
            )}
            {user.isAdmin && onAdmin && (
              <button
                onClick={onAdmin}
                className="flex-1 text-[10px] font-semibold px-1 py-[5px] rounded-[7px] bg-brand-soft text-brand-accent-2 border border-brand-line hover:bg-brand-line/60 transition-colors"
              >
                Admin
              </button>
            )}
            <button
              onClick={logout}
              className="flex-1 text-[10px] font-semibold px-1 py-[5px] rounded-[7px] bg-[rgba(224,82,77,.12)] text-[#e0524d] border border-[rgba(224,82,77,.3)] hover:bg-[rgba(224,82,77,.2)] transition-colors"
            >
              Wyloguj
            </button>
          </div>
        </div>
      )}

      {/* Due today */}
      {dueToday.length > 0 && (
        <div className="mx-3 my-2 px-3 py-2 bg-brand-soft rounded-[9px]">
          <div className="text-brand-accent-2 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
            ★ Rekomendowane na dziś ({dueToday.length})
          </div>
          {dueToday.slice(0, 3).map(d => (
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
          {dueToday.length > 3 && (
            <div className="text-brand-dim text-[10px] mt-1 pl-2">+{dueToday.length - 3} więcej…</div>
          )}
        </div>
      )}

      {/* Deal list by category */}
      <div className="flex-1 overflow-y-auto py-2">
        {Object.entries(byCategory).map(([cat, catDeals]) => (
          <div key={cat}>
            <div className="px-4 py-1.5 text-brand-dim text-[10px] font-semibold uppercase tracking-wider">
              {cat}
            </div>
            {catDeals.map(deal => {
              const entry = getEntry(deal.id);
              const due = isReviewDue(entry);
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
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[entry.status]} ${due && entry.status !== 'MASTERED' ? 'animate-pulse' : ''}`} />
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

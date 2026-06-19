import type { Deal, SRSEntry, SRSStatus } from '../types';
import { isReviewDue } from '../hooks/useSRS';

interface Props {
  deals: Deal[];
  selectedId: string | null;
  getEntry: (id: string) => SRSEntry;
  onSelect: (id: string) => void;
}

const STATUS_DOT: Record<SRSStatus, string> = {
  NEW: 'bg-slate-500',
  LEARNING: 'bg-red-500',
  REVIEW: 'bg-yellow-400',
  MASTERED: 'bg-emerald-500',
};

const STATUS_LABEL: Record<SRSStatus, string> = {
  NEW: 'Nowe',
  LEARNING: 'Nauka',
  REVIEW: 'Powtórka',
  MASTERED: 'Opanowane',
};

const DIFF_BADGE: Record<string, string> = {
  Easy: 'text-emerald-400',
  Medium: 'text-yellow-400',
  Hard: 'text-red-400',
};

export function Sidebar({ deals, selectedId, getEntry, onSelect }: Props) {
  const dueToday = deals.filter(d => {
    const e = getEntry(d.id);
    return isReviewDue(e);
  });

  const byCategory = deals.reduce<Record<string, Deal[]>>((acc, d) => {
    (acc[d.category] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <h1 className="text-white font-bold text-sm tracking-wide">🃏 Trenażer Brydżowy</h1>
        <p className="text-slate-400 text-xs mt-0.5">System SRS</p>
      </div>

      {/* Due today */}
      {dueToday.length > 0 && (
        <div className="px-3 py-2 bg-yellow-900/20 border-b border-yellow-800/40">
          <div className="text-yellow-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
            📅 Rekomendowane na dziś ({dueToday.length})
          </div>
          {dueToday.slice(0, 3).map(d => (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className={`w-full text-left text-xs py-1 px-2 rounded transition-colors mb-0.5 ${
                selectedId === d.id
                  ? 'bg-yellow-700/50 text-yellow-200'
                  : 'text-yellow-300 hover:bg-yellow-800/30'
              }`}
            >
              {d.title}
            </button>
          ))}
          {dueToday.length > 3 && (
            <div className="text-yellow-600 text-[10px] mt-1 pl-2">+{dueToday.length - 3} więcej...</div>
          )}
        </div>
      )}

      {/* Deal list by category */}
      <div className="flex-1 overflow-y-auto py-2">
        {Object.entries(byCategory).map(([cat, catDeals]) => (
          <div key={cat}>
            <div className="px-4 py-1.5 text-slate-500 text-[10px] font-semibold uppercase tracking-wider">
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
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors ${
                    isSelected
                      ? 'bg-slate-700 border-l-2 border-blue-400'
                      : 'hover:bg-slate-800 border-l-2 border-transparent'
                  }`}
                >
                  {/* SRS dot */}
                  <div className="mt-1 flex flex-col items-center gap-0.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[entry.status]} ${due && entry.status !== 'MASTERED' ? 'animate-pulse' : ''}`} />
                  </div>

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium leading-snug truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                      {deal.title}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] ${DIFF_BADGE[deal.difficulty]}`}>{deal.difficulty}</span>
                      <span className="text-slate-600 text-[10px]">·</span>
                      <span className={`text-[10px] ${entry.status === 'MASTERED' ? 'text-emerald-500' : 'text-slate-500'}`}>
                        {STATUS_LABEL[entry.status]}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Stats footer */}
      <div className="px-3 py-2 border-t border-slate-700 bg-slate-800/30">
        <div className="grid grid-cols-3 gap-1 text-center">
          {(['NEW', 'LEARNING', 'MASTERED'] as const).map(s => (
            <div key={s}>
              <div className={`text-sm font-bold ${STATUS_DOT[s].replace('bg-', 'text-')}`}>
                {deals.filter(d => getEntry(d.id).status === s).length}
              </div>
              <div className="text-slate-600 text-[9px]">{STATUS_LABEL[s].slice(0, 3)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

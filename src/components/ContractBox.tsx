import type { Seat, Suit } from '../types';
import { SUIT_COLORS } from '../lib/suitColors';

interface Props {
  contract: string;
  declarer: Seat;
  trickScores: { NS: number; EW: number };
  vulnerability: string;
}

const DECLARER_NAMES: Record<Seat, string> = { N: 'Północ', S: 'Południe', E: 'Wschód', W: 'Zachód' };

const SUIT_SYM: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

function ContractDisplay({ contract }: { contract: string }) {
  const match = contract.match(/^(\d)(S|H|D|C|NT)$/);
  if (!match) return <span className="text-brand-text">{contract}</span>;
  const [, level, suit] = match;
  if (suit === 'NT') return <span className="text-brand-text">{level}BA</span>;
  return (
    <span>
      <span className="text-brand-text">{level}</span>
      <span style={{ color: SUIT_COLORS.panel[suit as Suit] }}>{SUIT_SYM[suit]}</span>
    </span>
  );
}

export function ContractBox({ contract, declarer, trickScores }: Props) {
  return (
    <div className="bg-brand-panel border border-brand-accent rounded-[12px] px-4 py-3 text-center min-w-[140px] max-w-[150px]">
      <div className="text-brand-dim font-mono font-bold text-[8px] uppercase tracking-wider mb-1">Kontrakt</div>
      <div className="font-display font-bold text-[22px] leading-none">
        <ContractDisplay contract={contract} /> <span className="text-brand-accent-soft">{declarer}</span>
      </div>
      <div className="text-brand-dim text-[9px] mt-1.5">{DECLARER_NAMES[declarer]}</div>
      <div className="border-t border-brand-line mt-2 pt-2 flex gap-1.5">
        {(['NS', 'EW'] as const).map(side => (
          <div key={side} className="flex-1 bg-brand-soft rounded-[6px] p-[5px] text-center">
            <div className="text-brand-dim font-bold text-[8px] uppercase tracking-[0.1em]">{side}</div>
            <div className="text-brand-text font-display font-bold text-[16px] leading-tight">{trickScores[side]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

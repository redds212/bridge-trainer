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
  if (!match) return <span className="text-white">{contract}</span>;
  const [, level, suit] = match;
  if (suit === 'NT') return <span className="text-white">{level}BA</span>;
  return (
    <span>
      <span className="text-white">{level}</span>
      <span style={{ color: SUIT_COLORS.panel[suit as Suit] }}>{SUIT_SYM[suit]}</span>
    </span>
  );
}

export function ContractBox({ contract, declarer, trickScores, vulnerability }: Props) {
  return (
    <div className="bg-sky-900/90 border border-sky-600 rounded-lg px-3 py-2 text-center min-w-[110px]">
      <div className="text-sky-300 text-[10px] font-semibold uppercase tracking-wider mb-1">Kontrakt</div>
      <div className="text-lg font-bold">
        <ContractDisplay contract={contract} /> {declarer}
      </div>
      <div className="text-sky-400 text-[10px] mt-1">{DECLARER_NAMES[declarer]}</div>
      <div className="border-t border-sky-700 mt-2 pt-1 grid grid-cols-2 gap-1 text-[10px]">
        <div className="text-center">
          <div className="text-sky-400">NS</div>
          <div className="text-white font-bold">{trickScores.NS}</div>
        </div>
        <div className="text-center border-l border-sky-700">
          <div className="text-sky-400">EW</div>
          <div className="text-white font-bold">{trickScores.EW}</div>
        </div>
      </div>
    </div>
  );
}

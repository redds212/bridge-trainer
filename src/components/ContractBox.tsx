import type { Seat } from '../types';

interface Props {
  contract: string;
  declarer: Seat;
  trickScores: { NS: number; EW: number };
  vulnerability: string;
}

const DECLARER_NAMES: Record<Seat, string> = { N: 'Północ', S: 'Południe', E: 'Wschód', W: 'Zachód' };

function formatContract(contract: string): string {
  return contract
    .replace('NT', 'SA')
    .replace('S', '♠').replace('H', '♥').replace('D', '♦').replace('C', '♣')
    .replace('SA', 'SA'); // restore SA after suit replacements
}

export function ContractBox({ contract, declarer, trickScores, vulnerability }: Props) {
  const contractStr = contract.replace('NT', 'SA');
  const hasRed = contractStr.includes('♥') || contractStr.includes('♦');

  return (
    <div className="bg-sky-900/90 border border-sky-600 rounded-lg px-3 py-2 text-center min-w-[110px]">
      <div className="text-sky-300 text-[10px] font-semibold uppercase tracking-wider mb-1">Kontrakt</div>
      <div className={`text-lg font-bold ${hasRed ? 'text-red-400' : 'text-white'}`}>
        {contractStr} {declarer}
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

import type { Seat } from '../types';
import { PlayingCard } from './PlayingCard';

interface Props {
  visibleTrick: Partial<Record<Seat, string>>;
  leader: Seat | null;
}

export function TrickDisplay({ visibleTrick, leader }: Props) {
  const positions: Record<Seat, string> = {
    N: 'col-start-2 row-start-1 justify-self-center',
    S: 'col-start-2 row-start-3 justify-self-center',
    W: 'col-start-1 row-start-2 justify-self-center',
    E: 'col-start-3 row-start-2 justify-self-center',
  };

  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-0.5 w-28 h-28">
      {(['N', 'W', 'E', 'S'] as Seat[]).map(seat => {
        const card = visibleTrick[seat];
        return (
          <div key={seat} className={`flex items-center justify-center ${positions[seat]}`}>
            {card ? (
              <PlayingCard code={card} animated />
            ) : (
              leader === seat ? (
                <div className="w-10 h-14 rounded-lg border-2 border-dashed border-yellow-400/60 flex items-center justify-center">
                  <span className="text-yellow-400/60 text-xs">?</span>
                </div>
              ) : null
            )}
          </div>
        );
      })}
    </div>
  );
}

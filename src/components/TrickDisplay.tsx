import type { Seat } from '../types';
import { PlayingCard } from './PlayingCard';

interface Props {
  visibleTrick: Partial<Record<Seat, string>>;
  leader: Seat | null;
  /** Miejsce na zagraniu w momencie decyzji — dostaje ten sam „?", co wyjście w animacji. */
  pendingSeat?: Seat | null;
}

export function TrickDisplay({ visibleTrick, leader, pendingSeat }: Props) {
  // W animacji „?" zapowiada wyjście; w momencie decyzji nazywa miejsce, z którego
  // gracz ma zagrać. Punkt decyzji w środku lewy czyni to potrzebnym: przy jednej
  // czy dwóch kartach na filcu puste pole w krzyżu jest zbyt cichą wskazówką.
  const placeholderSeat = pendingSeat ?? leader;
  const positions: Record<Seat, string> = {
    N: 'col-start-2 row-start-1 justify-self-center',
    S: 'col-start-2 row-start-3 justify-self-center',
    W: 'col-start-1 row-start-2 justify-self-center',
    E: 'col-start-3 row-start-2 justify-self-center',
  };

  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-px w-[98px] h-[98px]">
      {(['N', 'W', 'E', 'S'] as Seat[]).map(seat => {
        const card = visibleTrick[seat];
        return (
          <div key={seat} className={`flex items-center justify-center ${positions[seat]}`}>
            {card ? (
              <PlayingCard code={card} animated />
            ) : (
              placeholderSeat === seat ? (
                <div className="w-8 h-11 rounded-md border-2 border-dashed border-yellow-400/60 flex items-center justify-center">
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

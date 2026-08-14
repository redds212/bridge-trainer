import type { Difficulty } from '../types';
import { DIFFICULTIES, DIFF_COLOR, DIFF_SHORT, DIFF_NAME_PL } from '../lib/difficulty';

interface Props {
  /** Wybrane poziomy; pusto = bez filtru (patrz `filterDeals`). */
  selected: readonly Difficulty[];
  onToggle: (difficulty: Difficulty) => void;
}

/**
 * Filtr trudności: cztery chipy w jednym rzędzie, wielokrotny wybór. Kolory są te
 * same, co przy etykietach wierszy listy poniżej, więc chip czyta się z tego samego
 * klucza, co lista — bez legendy.
 *
 * Bez widocznego napisu „Trudność": w panelu szerokim na 256 px etykieta zjadłaby
 * jedną czwartą rzędu, a wtedy chipy przestałyby się mieścić w jednej linii. Nazwa
 * poziomu siedzi w `title` i `aria-label` każdego chipa.
 */
export function DifficultyFilter({ selected, onToggle }: Props) {
  return (
    <div role="group" aria-label="Filtr trudności" className="flex gap-1">
      {DIFFICULTIES.map(d => {
        const active = selected.includes(d);
        const color = DIFF_COLOR[d];
        const name = `${DIFF_NAME_PL[d]} (${d})`;

        return (
          <button
            key={d}
            type="button"
            onClick={() => onToggle(d)}
            aria-pressed={active}
            aria-label={name}
            title={active ? `${name} — kliknij, aby wyłączyć` : name}
            className="flex-1 rounded-[7px] border py-[7px] text-[11px] font-bold leading-none transition-colors"
            style={
              active
                // O stanie mówi wypełnienie i obwódka, nie jasność litery: przygaszona
                // czerwień „X" schodziła na dole skali do 2,2:1 kontrastu wobec tła,
                // czyli poniżej progu czytelności. Litera zostaje w pełnym kolorze
                // poziomu — tym samym, co etykieta wiersza listy niżej.
                ? { color, backgroundColor: `${color}33`, borderColor: `${color}8c` }
                : { color, backgroundColor: '#1b2740', borderColor: 'rgba(255,255,255,0.09)' }
            }
          >
            {DIFF_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}

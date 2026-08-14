import type { Difficulty } from '../types';

/**
 * Skala trudności w jednym miejscu, bo kolor musi być IDENTYCZNY na chipie filtra
 * i na etykiecie wiersza tuż pod nim. Gdyby się rozjechały, zielone „E" i zielone
 * „Easy" przestałyby być tą samą rzeczą — filtr trzeba by czytać zamiast rozpoznawać.
 */

/** Kolejność rosnąca — taka sama na chipach, jak w edytorze rozdania. */
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert'] as const;

/** Zieleń → bursztyn → pomarańcz → czerwień, w granicach palety marki. */
export const DIFF_COLOR: Record<Difficulty, string> = {
  Easy: '#34d399',   // brand-accent-soft
  Medium: '#fbbf24', // brand-accent-2 (amber)
  Hard: '#df8a2e',   // diamond orange
  Expert: '#e0524d', // brand-danger (red)
};

/**
 * Jedna litera na chip: cztery poziomy mają się zmieścić w jednym rzędzie panelu
 * szerokiego na 256 px, obok siebie i bez zawijania. Pełna nazwa jedzie w `title`
 * i `aria-label`, więc skrót nie jest jedynym źródłem informacji.
 */
export const DIFF_SHORT: Record<Difficulty, string> = {
  Easy: 'E',
  Medium: 'M',
  Hard: 'H',
  Expert: 'X',
};

/** Polska nazwa do tooltipa — wiersze listy pokazują wariant angielski z danych. */
export const DIFF_NAME_PL: Record<Difficulty, string> = {
  Easy: 'Łatwe',
  Medium: 'Średnie',
  Hard: 'Trudne',
  Expert: 'Eksperckie',
};

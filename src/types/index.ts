export type Seat = 'N' | 'S' | 'E' | 'W';
export type Suit = 'S' | 'H' | 'D' | 'C';
export type SRSStatus = 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type GamePhase = 'intro' | 'decision' | 'revealed' | 'rated';

export interface HandCards {
  S: string;
  H: string;
  D: string;
  C: string;
}

export type HiddenHand = { hidden: true };

export type HandData = HandCards | HiddenHand;

export interface TrickStep {
  trick: number;
  leader: Seat;
  cards: Partial<Record<Seat, string>>;
  winner?: Seat;
}

export interface Solution {
  text: string;
  revealAllCards: Partial<Record<Seat, HandCards>>;
  continuationTricks?: TrickStep[];
}

export interface Deal {
  id: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  contract: string;
  declarer: Seat;
  dealer: Seat;
  vulnerability: string;
  bidding: string[][];
  initialHands: Record<Seat, HandData>;
  introSequence: TrickStep[];
  decisionPrompt: string;
  solution: Solution;
}

export interface SRSEntry {
  status: SRSStatus;
  intervalStep: 0 | 1 | 2 | 3;
  nextReviewDate: string | null;
  lastSeen: string | null;
}

export type SRSStore = Record<string, SRSEntry>;

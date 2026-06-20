export type Seat = 'N' | 'S' | 'E' | 'W';
export type Suit = 'S' | 'H' | 'D' | 'C';
export type SRSStatus = 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED';
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';
export type GamePhase = 'intro' | 'decision' | 'revealed' | 'rated';
export type UserRole = 'admin' | 'user';

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
  /** Number of consecutive correct first-try answers (0–4). 4 = mastered. */
  consecutiveCorrect: 0 | 1 | 2 | 3 | 4;
  /** Current interval in days (I). */
  interval: number;
  /** Next review day as local "YYYY-MM-DD" key, or null when mastered/new. */
  nextReviewDate: string | null;
  /** ISO timestamp of last attempt. */
  lastSeen: string | null;
  /** Marked when a deal was missed again inside the session buffer. */
  flagDifficult?: boolean;
}

export type SRSStore = Record<string, SRSEntry>;

export type LearningMode = 'maintenance' | 'balanced' | 'intensive';

export interface UserSettings {
  /** X — total deals per day. */
  dailyTarget: number;
  mode: LearningMode;
}

export type AttemptPhase = 'main' | 'buffer' | 'free';

export interface Attempt {
  dealId: string;
  /** ISO timestamp. */
  ts: string;
  correct: boolean;
  phase: AttemptPhase;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

// Hand-written schema types mirroring supabase/migrations/0001_init.sql.
// Gives compile-time safety on column names for our Supabase queries.
import type { Seat, HandData, TrickStep, Solution, AccountStatus, LearningMode, SRSStatus } from '../types';

// NOTE: these are `type` aliases (not interfaces) so they satisfy
// supabase-js's `Row extends Record<string, unknown>` constraint.
export type DealRow = {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  contract: string;
  declarer: Seat;
  dealer: Seat;
  vulnerability: string;
  bidding: string[][];
  initial_hands: Record<Seat, HandData>;
  intro_sequence: TrickStep[];
  decision_prompt: string;
  solution: Solution;
  is_base: boolean;
  archived: boolean;
  created_by: string | null;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  username: string | null;
  is_admin: boolean;
  status: AccountStatus;
  daily_target: number;
  mode: LearningMode;
  created_at: string;
};

export type SrsProgressRow = {
  user_id: string;
  deal_id: string;
  status: SRSStatus;
  consecutive_correct: number;
  interval: number;
  next_review_date: string | null;
  last_seen: string | null;
  flag_difficult: boolean;
};

export type AttemptRow = {
  id: number;
  user_id: string;
  deal_id: string;
  correct: boolean;
  phase: 'main' | 'buffer' | 'free';
  ts: string;
};

type Insert<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

type Empty = Record<string, never>;

export interface Database {
  public: {
    Tables: {
      deals: {
        Row: DealRow;
        Insert: Insert<DealRow, 'is_base' | 'archived' | 'created_by' | 'created_at'>;
        Update: Partial<DealRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Insert<ProfileRow, 'username' | 'is_admin' | 'status' | 'daily_target' | 'mode' | 'created_at'>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      srs_progress: {
        Row: SrsProgressRow;
        Insert: Insert<SrsProgressRow, 'status' | 'consecutive_correct' | 'interval' | 'next_review_date' | 'last_seen' | 'flag_difficult'>;
        Update: Partial<SrsProgressRow>;
        Relationships: [];
      };
      attempts: {
        Row: AttemptRow;
        Insert: Insert<AttemptRow, 'id' | 'ts'>;
        Update: Partial<AttemptRow>;
        Relationships: [];
      };
    };
    Views: Empty;
    Functions: {
      update_my_settings: {
        Args: { p_daily_target: number; p_mode: string };
        Returns: undefined;
      };
    };
    Enums: Empty;
    CompositeTypes: Empty;
  };
}

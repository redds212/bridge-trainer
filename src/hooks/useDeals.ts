import { useState, useEffect, useCallback } from 'react';
import type { Deal, Difficulty } from '../types';
import type { DealRow } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';

export interface DealRecord extends Deal {
  isBase: boolean;
  archived: boolean;
}

interface OpResult { error?: string }

function rowToRecord(r: DealRow): DealRecord {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    difficulty: r.difficulty as Difficulty,
    contract: r.contract,
    declarer: r.declarer,
    dealer: r.dealer,
    vulnerability: r.vulnerability,
    bidding: r.bidding,
    initialHands: r.initial_hands,
    introSequence: r.intro_sequence,
    decisionPrompt: r.decision_prompt,
    solution: r.solution,
    isBase: r.is_base,
    archived: r.archived,
  };
}

/** Column payload (snake_case) shared by insert/update. */
function dealColumns(d: Deal) {
  return {
    title: d.title,
    category: d.category,
    difficulty: d.difficulty,
    contract: d.contract,
    declarer: d.declarer,
    dealer: d.dealer,
    vulnerability: d.vulnerability,
    bidding: d.bidding,
    initial_hands: d.initialHands,
    intro_sequence: d.introSequence,
    decision_prompt: d.decisionPrompt,
    solution: d.solution,
  };
}

export function useDeals() {
  const { user } = useAuth();
  const [records, setRecords] = useState<DealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .order('is_base', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) {
      setError(error.message);
      setRecords([]);
    } else {
      setError(null);
      setRecords((data ?? []).map(rowToRecord));
    }
    setLoading(false);
  }, []);

  // Refetch whenever auth identity / approval status changes (RLS gates the rows).
  useEffect(() => { reload(); }, [user?.id, user?.status, reload]);

  const addDeal = useCallback(async (deal: Deal): Promise<OpResult> => {
    const id = `deal-${crypto.randomUUID()}`;
    const { error } = await supabase
      .from('deals')
      .insert({ id, ...dealColumns(deal), is_base: false, archived: false, created_by: user?.id ?? null });
    if (error) return { error: error.message };
    await reload();
    return {};
  }, [user?.id, reload]);

  const updateDeal = useCallback(async (id: string, deal: Deal): Promise<OpResult> => {
    const { error } = await supabase.from('deals').update(dealColumns(deal)).eq('id', id);
    if (error) return { error: error.message };
    await reload();
    return {};
  }, [reload]);

  const setArchived = useCallback(async (id: string, archived: boolean): Promise<OpResult> => {
    const { error } = await supabase.from('deals').update({ archived }).eq('id', id);
    if (error) return { error: error.message };
    await reload();
    return {};
  }, [reload]);

  const archiveDeal = useCallback((id: string) => setArchived(id, true), [setArchived]);
  const restoreDeal = useCallback((id: string) => setArchived(id, false), [setArchived]);

  // Active (non-archived) deals power the trainer / sidebar / panel.
  const deals: Deal[] = records.filter(r => !r.archived);

  return {
    deals,
    allDeals: records,
    loading,
    error,
    reload,
    addDeal,
    updateDeal,
    archiveDeal,
    restoreDeal,
  };
}

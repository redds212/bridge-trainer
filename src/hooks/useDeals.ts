import { useState, useEffect, useCallback } from 'react';
import type { Deal, Difficulty } from '../types';
import type { DealRow } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { dealSignature } from '../lib/dealSignature';

export interface DealRecord extends Deal {
  isBase: boolean;
  archived: boolean;
  createdAt: string;
  /** Sygnatura zapisana w bazie; NULL dla wierszy sprzed backfillu lub niekompletnych. */
  cardSignature: string | null;
}

interface OpResult { error?: string }

export interface BulkAddResult {
  ok: number;
  failures: { title: string; error: string }[];
}

export interface BackfillResult {
  /** Wiersze, którym dopisano sygnaturę. */
  updated: number;
  /** Wiersze bez kompletu 52 kart — trwale zwolnione z kontroli duplikatów. */
  exempt: number;
  error?: string;
}

/** Czytelny komunikat zamiast surowego naruszenia unikalnego indeksu z Postgresa. */
function friendlyError(message: string): string {
  return message.includes('deals_card_signature_key')
    ? 'rozdanie o tym rozkładzie kart już istnieje w bazie'
    : message;
}

function rowToRecord(r: DealRow, tagIds: string[]): DealRecord {
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
    createdAt: r.created_at,
    sourceId: r.source_id,
    sourceDetails: r.source_details ?? '',
    tagIds,
    bidAlerts: r.bid_alerts ?? [],
    cardSignature: r.card_signature ?? null,
  };
}

/**
 * Column payload (snake_case) shared by insert/update.
 * Celowo BEZ `card_signature` — sygnaturę dopisuje tylko ścieżka insertu, żeby
 * edycja rozdania (np. poprawka błędnie wydrukowanej karty) nie zmieniła jego
 * tożsamości. Patrz docs/DEDUP_PLAN.md.
 */
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
    source_id: d.sourceId ?? null,
    source_details: d.sourceDetails?.trim() ? d.sourceDetails.trim() : null,
    bid_alerts: d.bidAlerts && d.bidAlerts.length ? d.bidAlerts : null,
  };
}

/** Replace a deal's motif links with the given tag ids. */
async function syncDealTags(dealId: string, tagIds: string[] | undefined): Promise<string | null> {
  const { error: delErr } = await supabase.from('deal_tags').delete().eq('deal_id', dealId);
  if (delErr) return delErr.message;
  if (tagIds && tagIds.length) {
    const { error: insErr } = await supabase.from('deal_tags').insert(tagIds.map(tag_id => ({ deal_id: dealId, tag_id })));
    if (insErr) return insErr.message;
  }
  return null;
}

export function useDeals() {
  const { user } = useAuth();
  const [records, setRecords] = useState<DealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const [dealsRes, linksRes] = await Promise.all([
      supabase.from('deals').select('*').order('is_base', { ascending: false }).order('created_at', { ascending: true }),
      supabase.from('deal_tags').select('deal_id, tag_id'),
    ]);
    if (dealsRes.error) {
      setError(dealsRes.error.message);
      setRecords([]);
    } else {
      setError(null);
      const tagsByDeal = new Map<string, string[]>();
      for (const link of linksRes.data ?? []) {
        const arr = tagsByDeal.get(link.deal_id) ?? [];
        arr.push(link.tag_id);
        tagsByDeal.set(link.deal_id, arr);
      }
      setRecords((dealsRes.data ?? []).map(r => rowToRecord(r, tagsByDeal.get(r.id) ?? [])));
    }
    setLoading(false);
  }, []);

  // Refetch whenever auth identity / approval status changes (RLS gates the rows).
  useEffect(() => { reload(); }, [user?.id, user?.status, reload]);

  const addDeal = useCallback(async (deal: Deal): Promise<OpResult> => {
    const id = `deal-${crypto.randomUUID()}`;
    const { error } = await supabase
      .from('deals')
      .insert({
        id,
        ...dealColumns(deal),
        card_signature: dealSignature(deal),
        is_base: false,
        archived: false,
        created_by: user?.id ?? null,
      });
    if (error) return { error: friendlyError(error.message) };
    const tagErr = await syncDealTags(id, deal.tagIds);
    if (tagErr) return { error: tagErr };
    await reload();
    return {};
  }, [user?.id, reload]);

  /**
   * Wsadowy import. Jeden `insert` na porcję zamiast jednego wywołania (i jednego
   * przeładowania listy) na rozdanie — przy 150 planszach to różnica między
   * kilkoma sekundami a kilkoma minutami.
   *
   * Porcja odrzucona przez bazę jest ponawiana wiersz po wierszu, żeby wskazać
   * winowajcę zamiast wywalić cały wsad. Motywów nie synchronizujemy: eksport
   * usuwa `tagIds`/`sourceId` jako lokalne dla bazy, więc import ich nie niesie.
   */
  const addDeals = useCallback(async (deals: Deal[]): Promise<BulkAddResult> => {
    const rows = deals.map(d => ({
      id: `deal-${crypto.randomUUID()}`,
      ...dealColumns(d),
      card_signature: dealSignature(d),
      is_base: false,
      archived: false,
      created_by: user?.id ?? null,
    }));

    let ok = 0;
    const failures: BulkAddResult['failures'] = [];
    const CHUNK = 50;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from('deals').insert(chunk);
      if (!error) { ok += chunk.length; continue; }

      for (let j = 0; j < chunk.length; j++) {
        const { error: rowErr } = await supabase.from('deals').insert(chunk[j]);
        if (rowErr) failures.push({ title: deals[i + j].title, error: friendlyError(rowErr.message) });
        else ok++;
      }
    }

    await reload();
    return { ok, failures };
  }, [user?.id, reload]);

  /**
   * Jednorazowy backfill: dopisuje sygnatury wierszom sprzed wprowadzenia kolumny.
   * Musi się wykonać PRZED założeniem unikalnego indeksu (0007) — bez tego rozdania
   * już zaimportowane zostają z NULL, są zwolnione z indeksu i można je zaimportować
   * po raz drugi.
   */
  const backfillSignatures = useCallback(async (): Promise<BackfillResult> => {
    const pending = records.filter(r => r.cardSignature === null);
    const signable = pending
      .map(r => ({ id: r.id, sig: dealSignature(r) }))
      .filter((x): x is { id: string; sig: string } => x.sig !== null);

    let updated = 0;
    const CHUNK = 10;
    for (let i = 0; i < signable.length; i += CHUNK) {
      const results = await Promise.all(
        signable.slice(i, i + CHUNK).map(x =>
          supabase.from('deals').update({ card_signature: x.sig }).eq('id', x.id),
        ),
      );
      const failed = results.find(r => r.error);
      if (failed?.error) {
        await reload();
        return { updated, exempt: pending.length - signable.length, error: friendlyError(failed.error.message) };
      }
      updated += results.length;
    }

    await reload();
    return { updated, exempt: pending.length - signable.length };
  }, [records, reload]);

  const updateDeal = useCallback(async (id: string, deal: Deal): Promise<OpResult> => {
    const { error } = await supabase.from('deals').update(dealColumns(deal)).eq('id', id);
    if (error) return { error: friendlyError(error.message) };
    const tagErr = await syncDealTags(id, deal.tagIds);
    if (tagErr) return { error: tagErr };
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

  // Permanent removal (cascades to srs_progress). Irreversible.
  const deleteDeal = useCallback(async (id: string): Promise<OpResult> => {
    const { error } = await supabase.from('deals').delete().eq('id', id);
    if (error) return { error: error.message };
    await reload();
    return {};
  }, [reload]);

  // Active (non-archived) deals power the trainer / sidebar / panel.
  const deals: Deal[] = records.filter(r => !r.archived);

  return {
    deals,
    allDeals: records,
    loading,
    error,
    reload,
    addDeal,
    addDeals,
    backfillSignatures,
    updateDeal,
    archiveDeal,
    restoreDeal,
    deleteDeal,
  };
}

import { useState, useEffect, useCallback } from 'react';
import type { DealReportRow, ReportStatus } from '../lib/database.types';
import { supabase } from '../lib/supabase';

export interface DealReport {
  id: number;
  dealId: string;
  dealTitle: string;
  reporter: string;
  message: string;
  status: ReportStatus;
  createdAt: string;
}

interface OpResult { error?: string }

function toReport(r: DealReportRow): DealReport {
  return {
    id: r.id,
    dealId: r.deal_id,
    dealTitle: r.deal_title,
    reporter: r.reporter_label || '(konto usunięte)',
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
  };
}

/** Admin-only: zgłoszenia błędów w rozdaniach (dostęp pilnowany przez RLS). */
export function useDealReports() {
  const [reports, setReports] = useState<DealReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('deal_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
      setReports([]);
    } else {
      setError(null);
      setReports((data ?? []).map(toReport));
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const setStatus = useCallback(async (id: number, status: ReportStatus): Promise<OpResult> => {
    const { error } = await supabase.from('deal_reports').update({ status }).eq('id', id);
    if (error) return { error: error.message };
    await reload();
    return {};
  }, [reload]);

  const remove = useCallback(async (id: number): Promise<OpResult> => {
    const { error } = await supabase.from('deal_reports').delete().eq('id', id);
    if (error) return { error: error.message };
    await reload();
    return {};
  }, [reload]);

  const newCount = reports.filter(r => r.status === 'new').length;

  return { reports, loading, error, newCount, reload, setStatus, remove };
}

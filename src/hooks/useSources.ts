import { useState, useEffect, useCallback } from 'react';
import type { Source, SourceType } from '../types';
import { supabase } from '../lib/supabase';

interface NewSource {
  name: string;
  sourceType: SourceType;
  sourceUrl?: string | null;
}

/** Reużywalne źródła (książki, strony, turnieje). Lista + tworzenie. */
export function useSources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sources')
      .select('id, name, source_type, source_url')
      .order('name', { ascending: true });
    if (error) console.error('Sources load failed:', error.message);
    else setSources((data ?? []).map(r => ({ id: r.id, name: r.name, sourceType: r.source_type, sourceUrl: r.source_url })));
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const createSource = useCallback(async (input: NewSource): Promise<Source | { error: string }> => {
    const name = input.name.trim();
    if (!name) return { error: 'Podaj nazwę źródła.' };
    const { data, error } = await supabase
      .from('sources')
      .insert({ name, source_type: input.sourceType, source_url: input.sourceUrl?.trim() || null })
      .select('id, name, source_type, source_url')
      .single();
    if (error || !data) return { error: error?.message ?? 'Nie udało się zapisać źródła.' };
    const src: Source = { id: data.id, name: data.name, sourceType: data.source_type, sourceUrl: data.source_url };
    setSources(prev => [...prev, src].sort((a, b) => a.name.localeCompare(b.name, 'pl')));
    return src;
  }, []);

  return { sources, loading, createSource, reload };
}

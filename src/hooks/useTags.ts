import { useState, useEffect, useCallback } from 'react';
import type { Tag } from '../types';
import { supabase } from '../lib/supabase';

/** Motywy techniczne (tagi). Lista + tworzenie nowych „w locie". */
export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('tags').select('id, name').order('name', { ascending: true });
    if (error) console.error('Tags load failed:', error.message);
    else setTags((data ?? []).map(r => ({ id: r.id, name: r.name })));
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  /** Create a tag (or return the existing one with the same name). */
  const createTag = useCallback(async (name: string): Promise<Tag | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = tags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const { data, error } = await supabase.from('tags').insert({ name: trimmed }).select('id, name').single();
    if (error || !data) {
      // Unique-violation race: someone created it — refetch and resolve by name.
      await reload();
      const { data: found } = await supabase.from('tags').select('id, name').eq('name', trimmed).maybeSingle();
      return found ? { id: found.id, name: found.name } : null;
    }
    const tag = { id: data.id, name: data.name };
    setTags(prev => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name, 'pl')));
    return tag;
  }, [tags, reload]);

  return { tags, loading, createTag, reload };
}

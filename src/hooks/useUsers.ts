import { useState, useEffect, useCallback } from 'react';
import type { AccountStatus } from '../types';
import { supabase } from '../lib/supabase';

export interface AdminUser {
  id: string;
  username: string | null;
  isAdmin: boolean;
  status: AccountStatus;
  createdAt: string;
}

interface OpResult { error?: string }

/** Admin-only: list and manage user accounts (gated server-side by RLS). */
export function useUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, is_admin, status, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
      setUsers([]);
    } else {
      setError(null);
      setUsers((data ?? []).map(r => ({
        id: r.id,
        username: r.username,
        isAdmin: r.is_admin,
        status: r.status,
        createdAt: r.created_at,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const setStatus = useCallback(async (id: string, status: AccountStatus): Promise<OpResult> => {
    const { error } = await supabase.from('profiles').update({ status }).eq('id', id);
    if (error) return { error: error.message };
    await reload();
    return {};
  }, [reload]);

  const approve = useCallback((id: string) => setStatus(id, 'approved'), [setStatus]);
  const revoke = useCallback((id: string) => setStatus(id, 'pending'), [setStatus]);

  const setAdmin = useCallback(async (id: string, value: boolean): Promise<OpResult> => {
    const { error } = await supabase.from('profiles').update({ is_admin: value }).eq('id', id);
    if (error) return { error: error.message };
    await reload();
    return {};
  }, [reload]);

  // Permanent account deletion via the admin-only Edge Function (service role).
  const deleteUser = useCallback(async (id: string): Promise<OpResult> => {
    const { data, error } = await supabase.functions.invoke('delete-user', { body: { targetUserId: id } });
    if (error) {
      let msg = error.message;
      const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
      if (ctx?.json) {
        try { const j = await ctx.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
      }
      return { error: msg };
    }
    if (data && (data as { error?: string }).error) return { error: (data as { error: string }).error };
    await reload();
    return {};
  }, [reload]);

  return { users, loading, error, reload, approve, revoke, setAdmin, deleteUser };
}

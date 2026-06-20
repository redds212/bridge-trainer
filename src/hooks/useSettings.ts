import { useState, useEffect, useCallback, useRef } from 'react';
import type { UserSettings, LearningMode } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';

export const DAILY_TARGET_MIN = 5;
export const DAILY_TARGET_MAX = 40;

function clampTarget(n: number): number {
  return Math.max(DAILY_TARGET_MIN, Math.min(DAILY_TARGET_MAX, Math.round(n)));
}

/**
 * SRS settings (daily target + mode) stored on the user's `profiles` row.
 * Initial values come from the authenticated profile; updates apply
 * optimistically and persist (debounced) via the update_my_settings RPC.
 */
export function useSettings(userId: string | null) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({
    dailyTarget: clampTarget(user?.dailyTarget ?? 10),
    mode: user?.mode ?? 'balanced',
  });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Re-sync from the profile on login / account switch.
  useEffect(() => {
    if (!user) return;
    const s: UserSettings = { dailyTarget: clampTarget(user.dailyTarget), mode: user.mode };
    setSettings(s);
    settingsRef.current = s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const update = useCallback((patch: Partial<UserSettings>) => {
    const next: UserSettings = {
      dailyTarget: patch.dailyTarget !== undefined ? clampTarget(patch.dailyTarget) : settingsRef.current.dailyTarget,
      mode: (patch.mode ?? settingsRef.current.mode) as LearningMode,
    };
    settingsRef.current = next;
    setSettings(next);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!userId) return;
      supabase.rpc('update_my_settings', { p_daily_target: next.dailyTarget, p_mode: next.mode })
        .then(({ error }) => { if (error) console.error('Settings save failed:', error.message); });
    }, 500);
  }, [userId]);

  return { settings, update };
}

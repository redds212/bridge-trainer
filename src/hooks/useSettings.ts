import { useState, useEffect, useCallback } from 'react';
import type { UserSettings, LearningMode } from '../types';

const DEFAULT_SETTINGS: UserSettings = {
  dailyTarget: 10, // suggested default
  mode: 'balanced',
};

export const DAILY_TARGET_MIN = 5;
export const DAILY_TARGET_MAX = 40;

function key(userId: string | null): string {
  return `bridge-settings-${userId ?? 'guest'}`;
}

function load(k: string): UserSettings {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      dailyTarget: clampTarget(parsed.dailyTarget ?? DEFAULT_SETTINGS.dailyTarget),
      mode: (['maintenance', 'balanced', 'intensive'] as LearningMode[]).includes(parsed.mode)
        ? parsed.mode
        : DEFAULT_SETTINGS.mode,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function clampTarget(n: number): number {
  return Math.max(DAILY_TARGET_MIN, Math.min(DAILY_TARGET_MAX, Math.round(n)));
}

export function useSettings(userId: string | null) {
  const [settings, setSettings] = useState<UserSettings>(() => load(key(userId)));

  useEffect(() => {
    setSettings(load(key(userId)));
  }, [userId]);

  const update = useCallback((patch: Partial<UserSettings>) => {
    setSettings(prev => {
      const next: UserSettings = {
        dailyTarget: patch.dailyTarget !== undefined ? clampTarget(patch.dailyTarget) : prev.dailyTarget,
        mode: patch.mode ?? prev.mode,
      };
      localStorage.setItem(key(userId), JSON.stringify(next));
      return next;
    });
  }, [userId]);

  return { settings, update };
}

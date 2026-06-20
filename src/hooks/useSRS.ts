import { useState, useCallback, useEffect } from 'react';
import type { SRSStore, SRSEntry } from '../types';
import { getDefaultEntry, normalizeEntry, applyAnswer, finalizeBuffer, isReviewDue } from '../lib/srs';

// Re-export so existing imports (`from '../hooks/useSRS'`) keep working.
export { getDefaultEntry, isReviewDue };

function storageKey(userId: string | null): string {
  return userId ? `bridge-srs-${userId}` : 'bridge-srs-guest';
}

function loadStore(key: string): SRSStore {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveStore(key: string, store: SRSStore) {
  localStorage.setItem(key, JSON.stringify(store));
}

export function useSRS(userId: string | null) {
  const [store, setStore] = useState<SRSStore>(() => loadStore(storageKey(userId)));

  useEffect(() => {
    setStore(loadStore(storageKey(userId)));
  }, [userId]);

  const getEntry = useCallback(
    (id: string): SRSEntry => normalizeEntry(store[id]),
    [store]
  );

  const commit = useCallback((id: string, next: SRSEntry) => {
    const key = storageKey(userId);
    setStore(prev => {
      const updated = { ...prev, [id]: next };
      saveStore(key, updated);
      return updated;
    });
  }, [userId]);

  /** First-try answer in the main session (or free play). */
  const applyResult = useCallback((id: string, correct: boolean) => {
    setStore(prev => {
      const next = applyAnswer(normalizeEntry(prev[id]), correct);
      const updated = { ...prev, [id]: next };
      saveStore(storageKey(userId), updated);
      return updated;
    });
  }, [userId]);

  /** Finalize after a session-buffer retry (always returns tomorrow). */
  const finalizeBufferResult = useCallback((id: string, retrySucceeded: boolean) => {
    setStore(prev => {
      const next = finalizeBuffer(normalizeEntry(prev[id]), retrySucceeded);
      const updated = { ...prev, [id]: next };
      saveStore(storageKey(userId), updated);
      return updated;
    });
  }, [userId]);

  const resetEntry = useCallback((id: string) => {
    commit(id, getDefaultEntry());
  }, [commit]);

  return { getEntry, applyResult, finalizeBufferResult, resetEntry, store };
}

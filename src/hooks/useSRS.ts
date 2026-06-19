import { useState, useCallback } from 'react';
import type { SRSStore, SRSEntry } from '../types';

const STORAGE_KEY = 'bridge-srs-store';

function loadStore(): SRSStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStore(store: SRSStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getDefaultEntry(): SRSEntry {
  return { status: 'NEW', intervalStep: 0, nextReviewDate: null, lastSeen: null };
}

export function isReviewDue(entry: SRSEntry): boolean {
  if (entry.status === 'MASTERED') return false;
  if (!entry.nextReviewDate) return entry.status === 'NEW';
  return new Date(entry.nextReviewDate) <= new Date();
}

export function useSRS() {
  const [store, setStore] = useState<SRSStore>(loadStore);

  const getEntry = useCallback(
    (id: string): SRSEntry => store[id] ?? getDefaultEntry(),
    [store]
  );

  const applyResult = useCallback((id: string, correct: boolean) => {
    setStore(prev => {
      const current = prev[id] ?? getDefaultEntry();
      const now = new Date();
      let next: SRSEntry;

      if (!correct) {
        next = {
          status: 'LEARNING',
          intervalStep: 1,
          nextReviewDate: addDays(now, 3).toISOString(),
          lastSeen: now.toISOString(),
        };
      } else {
        const step = current.intervalStep;
        if (step === 0 || step === 1) {
          next = {
            status: 'REVIEW',
            intervalStep: 2,
            nextReviewDate: addDays(now, 7).toISOString(),
            lastSeen: now.toISOString(),
          };
        } else if (step === 2) {
          next = {
            status: 'REVIEW',
            intervalStep: 3,
            nextReviewDate: addDays(now, 21).toISOString(),
            lastSeen: now.toISOString(),
          };
        } else {
          next = {
            status: 'MASTERED',
            intervalStep: 3,
            nextReviewDate: null,
            lastSeen: now.toISOString(),
          };
        }
      }

      const updated = { ...prev, [id]: next };
      saveStore(updated);
      return updated;
    });
  }, []);

  const resetEntry = useCallback((id: string) => {
    setStore(prev => {
      const updated = { ...prev, [id]: getDefaultEntry() };
      saveStore(updated);
      return updated;
    });
  }, []);

  return { getEntry, applyResult, resetEntry, store };
}

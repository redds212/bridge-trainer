import { useState, useMemo } from 'react';
import type { Deal } from '../types';
import dealsMock from '../data/dealsMock.json';

const CUSTOM_KEY = 'bridge-custom-deals';
const HIDDEN_KEY = 'bridge-hidden-deals';

function loadCustomDeals(): Deal[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]'); }
  catch { return []; }
}

function loadHiddenIds(): string[] {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]'); }
  catch { return []; }
}

export function useDeals() {
  const [customDeals, setCustomDeals] = useState<Deal[]>(loadCustomDeals);
  const [hiddenIds, setHiddenIds] = useState<string[]>(loadHiddenIds);

  const deals = useMemo(() => {
    const base = (dealsMock as Deal[]).filter(d => !hiddenIds.includes(d.id));
    return [...base, ...customDeals];
  }, [customDeals, hiddenIds]);

  const addDeal = (deal: Deal) => {
    setCustomDeals(prev => {
      const next = [...prev, deal];
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
  };

  const deleteDeal = (id: string) => {
    if (customDeals.some(d => d.id === id)) {
      setCustomDeals(prev => {
        const next = prev.filter(d => d.id !== id);
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
        return next;
      });
    } else {
      setHiddenIds(prev => {
        const next = [...prev, id];
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
        return next;
      });
    }
  };

  const restoreDeal = (id: string) => {
    setHiddenIds(prev => {
      const next = prev.filter(h => h !== id);
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      return next;
    });
  };

  const updateDeal = (id: string, updated: Deal) => {
    setCustomDeals(prev => {
      const next = prev.map(d => d.id === id ? { ...updated, id } : d);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
  };

  return {
    deals,
    baseDeals: dealsMock as Deal[],
    customDeals,
    hiddenIds,
    addDeal,
    updateDeal,
    deleteDeal,
    restoreDeal,
  };
}

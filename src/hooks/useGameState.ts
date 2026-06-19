import { useState, useCallback } from 'react';
import type { Deal, GamePhase, HandData, HandCards, TrickStep } from '../types';

export interface GameState {
  phase: GamePhase;
  currentStep: number;
  visibleTrick: Partial<Record<string, string>>;
  currentTrickLeader: string | null;
  tricks: TrickStep[];
  hands: Deal['initialHands'];
  trickScores: { NS: number; EW: number };
}

function initialState(deal: Deal): GameState {
  return {
    phase: 'intro',
    currentStep: 0,
    visibleTrick: {},
    currentTrickLeader: null,
    tricks: [],
    hands: deal.initialHands,
    trickScores: { NS: 0, EW: 0 },
  };
}

export function useGameState(deal: Deal | null) {
  const [state, setState] = useState<GameState | null>(
    deal ? initialState(deal) : null
  );

  const reset = useCallback((d: Deal) => {
    setState(initialState(d));
  }, []);

  const next = useCallback(() => {
    if (!deal || !state) return;
    const { phase, currentStep } = state;
    if (phase !== 'intro') return;

    const seq = deal.introSequence;
    const stepData = seq[currentStep];
    if (!stepData) {
      setState(s => s ? { ...s, phase: 'decision' } : s);
      return;
    }

    const cards = stepData.cards ?? {};
    const seats = Object.keys(cards) as Array<keyof typeof cards>;

    // If this step has all 4 seats, it's a completed trick; add to tricks
    const isCompleteTrick = seats.length === 4;
    const newTrick = { ...state.visibleTrick, ...cards };
    const newStep = currentStep + 1;
    const isLast = newStep >= seq.length;

    setState(s => {
      if (!s) return s;
      const tricks = isCompleteTrick ? [...s.tricks, stepData] : s.tricks;
      const scores = isCompleteTrick && stepData.winner
        ? {
            NS: s.trickScores.NS + (['N', 'S'].includes(stepData.winner) ? 1 : 0),
            EW: s.trickScores.EW + (['E', 'W'].includes(stepData.winner) ? 1 : 0),
          }
        : s.trickScores;

      return {
        ...s,
        currentStep: newStep,
        visibleTrick: isCompleteTrick ? cards : newTrick,
        currentTrickLeader: stepData.leader,
        tricks,
        trickScores: scores,
        phase: isLast ? 'decision' : 'intro',
      };
    });
  }, [deal, state]);

  const prev = useCallback(() => {
    if (!deal || !state || state.currentStep === 0) return;
    const prevStep = state.currentStep - 1;
    const seq = deal.introSequence;

    setState(s => {
      if (!s) return s;
      const cards = prevStep > 0 ? seq[prevStep - 1]?.cards ?? {} : {};
      return {
        ...s,
        currentStep: prevStep,
        visibleTrick: cards,
        phase: 'intro',
      };
    });
  }, [deal, state]);

  const rewind = useCallback(() => {
    if (!deal) return;
    setState(initialState(deal));
  }, [deal]);

  const revealSolution = useCallback(() => {
    if (!deal || !state) return;
    setState(s => {
      if (!s) return s;
      const revealed = deal.solution.revealAllCards;
      const newHands: Deal['initialHands'] = { ...s.hands };
      (Object.keys(revealed) as Array<keyof typeof revealed>).forEach(seat => {
        const cards = revealed[seat];
        if (cards) newHands[seat] = cards as HandCards;
      });
      return { ...s, phase: 'revealed', hands: newHands };
    });
  }, [deal, state]);

  const setPhase = useCallback((phase: GamePhase) => {
    setState(s => s ? { ...s, phase } : s);
  }, []);

  return { state, next, prev, rewind, revealSolution, setPhase, reset };
}

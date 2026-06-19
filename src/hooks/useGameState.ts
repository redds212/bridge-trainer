import { useState, useCallback, useRef } from 'react';
import type { Deal, GamePhase, HandCards, Seat, TrickStep } from '../types';

export interface GameState {
  phase: GamePhase;
  currentStep: number;
  visibleTrick: Partial<Record<Seat, string>>;
  currentTrickLeader: Seat | null;
  tricks: TrickStep[];
  hands: Deal['initialHands'];
  trickScores: { NS: number; EW: number };
  isAnimating: boolean;
}

const CLOCKWISE: Seat[] = ['N', 'E', 'S', 'W'];
const CARD_DELAY_MS = 200;

function clockwiseOrder(leader: Seat): Seat[] {
  const i = CLOCKWISE.indexOf(leader);
  return [...CLOCKWISE.slice(i), ...CLOCKWISE.slice(0, i)];
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
    isAnimating: false,
  };
}

export function useGameState(deal: Deal | null) {
  const [state, setState] = useState<GameState | null>(
    deal ? initialState(deal) : null
  );
  const timerIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cancelTimers = useCallback(() => {
    timerIds.current.forEach(clearTimeout);
    timerIds.current = [];
  }, []);

  const reset = useCallback((d: Deal) => {
    cancelTimers();
    setState(initialState(d));
  }, [cancelTimers]);

  const next = useCallback(() => {
    if (!deal || !state) return;
    const { phase, currentStep, isAnimating } = state;
    if (phase !== 'intro' || isAnimating) return;

    const seq = deal.introSequence;
    const stepData = seq[currentStep];
    if (!stepData) {
      setState(s => s ? { ...s, phase: 'decision' } : s);
      return;
    }

    const cards = stepData.cards ?? {};
    const leader = stepData.leader as Seat;
    // Cards in clockwise order starting from leader, filtered to those present in this step
    const ordered = clockwiseOrder(leader).filter(s => s in cards);

    const newStep = currentStep + 1;
    const isLast = newStep >= seq.length;
    const isCompleteTrick = ordered.length === 4;

    // Clear center and lock NEXT during animation
    setState(s => s ? { ...s, isAnimating: true, visibleTrick: {}, currentTrickLeader: leader } : s);

    cancelTimers();
    ordered.forEach((seat, i) => {
      const isLastCard = i === ordered.length - 1;
      const id = setTimeout(() => {
        setState(s => {
          if (!s) return s;
          const newTrick = { ...s.visibleTrick, [seat]: cards[seat] };
          if (isLastCard) {
            const tricks = isCompleteTrick ? [...s.tricks, stepData] : s.tricks;
            const scores = isCompleteTrick && stepData.winner
              ? {
                  NS: s.trickScores.NS + (['N', 'S'].includes(stepData.winner) ? 1 : 0),
                  EW: s.trickScores.EW + (['E', 'W'].includes(stepData.winner) ? 1 : 0),
                }
              : s.trickScores;
            return {
              ...s,
              visibleTrick: newTrick,
              currentStep: newStep,
              tricks,
              trickScores: scores,
              phase: isLast ? 'decision' : 'intro',
              isAnimating: false,
            };
          }
          return { ...s, visibleTrick: newTrick };
        });
      }, (i + 1) * CARD_DELAY_MS);
      timerIds.current.push(id);
    });
  }, [deal, state, cancelTimers]);

  const prev = useCallback(() => {
    if (!deal || !state || state.currentStep === 0 || state.isAnimating) return;
    cancelTimers();
    const prevStep = state.currentStep - 1;
    const seq = deal.introSequence;
    setState(s => {
      if (!s) return s;
      const prevCards = prevStep > 0 ? seq[prevStep - 1]?.cards ?? {} : {};
      return { ...s, currentStep: prevStep, visibleTrick: prevCards, phase: 'intro', isAnimating: false };
    });
  }, [deal, state, cancelTimers]);

  const rewind = useCallback(() => {
    if (!deal) return;
    cancelTimers();
    setState(initialState(deal));
  }, [deal, cancelTimers]);

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

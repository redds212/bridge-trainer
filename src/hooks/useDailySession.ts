import { useState, useCallback, useMemo } from 'react';
import type { Deal, SRSStore, UserSettings, AttemptPhase } from '../types';
import { generateDailySession, type DailySession } from '../lib/session';

interface Runtime {
  session: DailySession;
  index: number;        // pointer into main slots
  buffer: string[];     // dealIds missed in the main pass
  inBuffer: boolean;
  bufferIndex: number;
  token: number;        // bumps on every answer to force a deal reload
}

interface Args {
  deals: Deal[];
  store: SRSStore;
  settings: UserSettings;
  applyResult: (id: string, correct: boolean) => void;
  finalizeBufferResult: (id: string, retrySucceeded: boolean) => void;
  recordHistory: (id: string, correct: boolean, phase: AttemptPhase) => void;
}

export interface SessionProgress {
  inBuffer: boolean;
  mainDone: number;
  mainTotal: number;
  bufferDone: number;
  bufferTotal: number;
}

export function useDailySession(args: Args) {
  const { deals, store, settings, applyResult, finalizeBufferResult, recordHistory } = args;
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [completed, setCompleted] = useState<DailySession | null>(null);

  const start = useCallback(() => {
    const session = generateDailySession(deals, store, settings);
    if (!session.slots.length) {
      setCompleted(session); // nothing to do — surface an empty summary
      setRuntime(null);
      return session;
    }
    setCompleted(null);
    setRuntime({ session, index: 0, buffer: [], inBuffer: false, bufferIndex: 0, token: 1 });
    return session;
  }, [deals, store, settings]);

  const cancel = useCallback(() => {
    setRuntime(null);
    setCompleted(null);
  }, []);

  const dismissCompleted = useCallback(() => setCompleted(null), []);

  const currentDealId = useMemo(() => {
    if (!runtime) return null;
    return runtime.inBuffer
      ? runtime.buffer[runtime.bufferIndex] ?? null
      : runtime.session.slots[runtime.index]?.dealId ?? null;
  }, [runtime]);

  /** handleUserAnswer — Sections 3 & 4 of the SRS spec. */
  const answer = useCallback((correct: boolean) => {
    if (!runtime) return;

    if (!runtime.inBuffer) {
      const id = runtime.session.slots[runtime.index]?.dealId;
      if (!id) return;
      recordHistory(id, correct, 'main');
      if (correct) {
        applyResult(id, true); // success scaling now
      }
      // A miss is NOT finalized here — it is deferred to the session buffer.
      const nextBuffer = correct ? runtime.buffer : [...runtime.buffer, id];
      const nextIndex = runtime.index + 1;

      if (nextIndex >= runtime.session.slots.length) {
        if (nextBuffer.length) {
          setRuntime({ ...runtime, index: nextIndex, buffer: nextBuffer, inBuffer: true, bufferIndex: 0, token: runtime.token + 1 });
        } else {
          setCompleted(runtime.session);
          setRuntime(null);
        }
      } else {
        setRuntime({ ...runtime, index: nextIndex, buffer: nextBuffer, token: runtime.token + 1 });
      }
      return;
    }

    // Session buffer pass — regardless of result the deal returns tomorrow.
    const id = runtime.buffer[runtime.bufferIndex];
    if (!id) return;
    recordHistory(id, correct, 'buffer');
    finalizeBufferResult(id, correct);
    const nextBufferIndex = runtime.bufferIndex + 1;
    if (nextBufferIndex >= runtime.buffer.length) {
      setCompleted(runtime.session);
      setRuntime(null);
    } else {
      setRuntime({ ...runtime, bufferIndex: nextBufferIndex, token: runtime.token + 1 });
    }
  }, [runtime, recordHistory, applyResult, finalizeBufferResult]);

  const progress: SessionProgress | null = runtime
    ? {
        inBuffer: runtime.inBuffer,
        mainDone: runtime.inBuffer ? runtime.session.slots.length : runtime.index,
        mainTotal: runtime.session.slots.length,
        bufferDone: runtime.bufferIndex,
        bufferTotal: runtime.buffer.length,
      }
    : null;

  return {
    active: runtime !== null,
    currentDealId,
    currentKind: runtime && !runtime.inBuffer ? runtime.session.slots[runtime.index]?.kind ?? null : null,
    progress,
    sessionToken: runtime?.token ?? 0,
    completed,
    start,
    answer,
    cancel,
    dismissCompleted,
  };
}

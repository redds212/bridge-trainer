import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { flushOutbox, getOutboxState, setOutboxPaused, subscribeOutbox } from '../lib/outbox';

/** Co tyle ponawiamy wysyłkę, gdy coś czeka — iPhone nie zawsze zgłasza powrót sieci. */
const RETRY_MS = 120_000;

/**
 * Stan kolejki zapisów dla nagłówka i okazje do wysyłki (O6): powrót sieci, powrót do
 * aplikacji, co dwie minuty przy otwartej aplikacji. W trybie offline z logowania
 * (`offline`) nie wysyłamy nic — o powrocie sieci rozstrzyga wtedy odświeżenie profilu,
 * które sprawdza też, czy konto nadal ma dostęp (O4).
 */
export function useOutbox(userId: string | null, offline: boolean) {
  const state = useSyncExternalStore(subscribeOutbox, getOutboxState);

  useEffect(() => {
    setOutboxPaused(offline);
  }, [offline]);

  const flush = useCallback(async () => {
    if (userId) await flushOutbox(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId || offline) return;
    const run = () => { void flushOutbox(userId); };
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    run();
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => { if (getOutboxState().pending > 0) onVisible(); }, RETRY_MS);
    return () => {
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [userId, offline]);

  return { ...state, flush };
}

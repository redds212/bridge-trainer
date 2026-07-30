import { useState } from 'react';
import type { Deal } from '../types';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { Icon } from './Icon';

const MAX_MESSAGE = 800;

/**
 * Zgłaszanie błędu w rozdaniu — zapis do tabeli `deal_reports`, przeglądany
 * w panelu admina. Wcześniejsza wersja składała `mailto:`, co wymagało od
 * użytkownika własnego klienta pocztowego i ręcznego wysłania; zgłoszenie
 * przepadało, jeśli klient się nie otworzył.
 *
 * Tytuł rozdania i podpis zgłaszającego kopiujemy do wiersza, zamiast liczyć na
 * złączenia: zgłoszenie ma pozostać czytelne po edycji rozdania i po usunięciu konta.
 */
type Phase = 'form' | 'sending' | 'sent';

export function ReportDealButton({ deal }: { deal: Deal }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<string | null>(null);

  const ready = message.trim().length > 0 && phase === 'form';

  const close = () => {
    setOpen(false);
    setMessage('');
    setPhase('form');
    setError(null);
  };

  const send = async () => {
    if (!user) return;
    setPhase('sending');
    setError(null);
    const { error: err } = await supabase.from('deal_reports').insert({
      deal_id: deal.id,
      deal_title: deal.title,
      user_id: user.id,
      reporter_label: `${user.username} (${user.email})`,
      message: message.trim(),
    });
    if (err) {
      setPhase('form');
      setError(err.message.toLowerCase().includes('fetch')
        ? 'Brak połączenia — spróbuj ponownie, gdy wróci sieć.'
        : err.message);
      return;
    }
    setPhase('sent');
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Zgłoś błąd w rozdaniu"
        title="Zgłoś błąd w rozdaniu"
        className="flex h-8 w-8 items-center justify-center rounded-[7px] border border-brand-line bg-brand-panel/80 text-brand-dim transition-colors hover:text-brand-text"
      >
        <Icon name="flag" size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div
            className="slide-up w-full max-w-sm rounded-2xl border border-brand-line bg-brand-panel p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {phase === 'sent' ? (
              <div className="text-center">
                <div className="mb-3 text-4xl">✅</div>
                <h2 className="mb-1 font-display text-lg font-bold text-brand-text">Zgłoszenie wysłane</h2>
                <p className="mb-5 text-xs text-brand-dim">
                  Trafiło do administratora razem z informacją, którego rozdania dotyczy. Dzięki!
                </p>
                <button
                  onClick={close}
                  className="h-11 w-full rounded-[9px] bg-brand-accent font-display text-sm font-bold text-brand-btn-text transition-colors hover:bg-brand-accent-soft"
                >
                  Zamknij
                </button>
              </div>
            ) : (
              <>
                <h2 className="mb-1 font-display text-lg font-bold text-brand-text">Zgłoś błąd w rozdaniu</h2>
                <p className="mb-3 truncate text-xs text-brand-dim">{deal.title}</p>

                <textarea
                  value={message}
                  onChange={e => { setMessage(e.target.value); setError(null); }}
                  maxLength={MAX_MESSAGE}
                  rows={4}
                  autoFocus
                  disabled={phase === 'sending'}
                  placeholder="Co jest nie tak? Np. zła odzywka w licytacji, brakująca karta, błąd w rozwiązaniu."
                  className="w-full resize-none rounded-[9px] border border-brand-line bg-brand-bg p-3 text-sm text-brand-text placeholder:text-brand-dim/70 focus:border-brand-accent focus:outline-none disabled:opacity-60"
                />
                <div className="mb-3 mt-1 text-right text-[10px] text-brand-dim">
                  {message.length}/{MAX_MESSAGE}
                </div>

                {error && (
                  <p className="mb-3 rounded-[9px] border border-red-800 bg-red-900/40 p-2.5 text-[11px] leading-relaxed text-red-300">
                    {error}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={close}
                    className="h-11 flex-1 rounded-[9px] border border-brand-line bg-brand-soft text-sm font-medium text-brand-text transition-colors hover:bg-brand-line/60"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={send}
                    disabled={!ready}
                    className="h-11 flex-1 rounded-[9px] bg-brand-accent font-display text-sm font-bold text-brand-btn-text transition-colors hover:bg-brand-accent-soft disabled:cursor-not-allowed disabled:bg-brand-soft disabled:text-brand-dim"
                  >
                    {phase === 'sending' ? 'Wysyłam…' : 'Wyślij'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

import { useState } from 'react';
import type { Deal } from '../types';
import { useAuth } from '../auth/AuthContext';
import { Icon } from './Icon';

const REPORT_ADDRESS = 'kontakt@bridgeloop.pl';
const MAX_MESSAGE = 800;

/**
 * Zgłaszanie błędu w rozdaniu przez `mailto:` — bez tabeli w bazie i bez panelu
 * admina. Świadomy kompromis: zgłoszenia lądują w skrzynce, nie w aplikacji.
 *
 * `mailto:` NIE wysyła wiadomości. Otwiera klienta pocztowego z gotowym szkicem,
 * a użytkownik musi go u siebie wysłać. Na komputerze bez skonfigurowanego klienta
 * nie stanie się nic — dlatego obok jest kopiowanie treści do schowka i adres
 * wypisany wprost.
 */
function buildBody(deal: Deal, message: string, who: string): string {
  return [
    message.trim(),
    '',
    '---',
    'Dane techniczne (nie usuwaj — pomagają odnaleźć rozdanie):',
    `Rozdanie: ${deal.title}`,
    `ID: ${deal.id}`,
    `Kontrakt: ${deal.contract} ${deal.declarer}, rozdaje ${deal.dealer}, założenia ${deal.vulnerability}`,
    `Kategoria: ${deal.category} · ${deal.difficulty}`,
    `Zgłasza: ${who}`,
    `Data: ${new Date().toLocaleString('pl-PL')}`,
  ].join('\n');
}

export function ReportDealButton({ deal }: { deal: Deal }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const who = user ? `${user.username} (${user.email})` : 'niezalogowany';
  const subject = `[BridgeLoop] Błąd w rozdaniu: ${deal.title}`;
  const body = buildBody(deal, message, who);
  const href = `mailto:${REPORT_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const ready = message.trim().length > 0;

  const close = () => { setOpen(false); setMessage(''); setCopied(false); };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Do: ${REPORT_ADDRESS}\nTemat: ${subject}\n\n${body}`);
      setCopied(true);
    } catch {
      setCopied(false); // np. brak uprawnień do schowka — zostaje ręczne zaznaczenie
    }
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
            <h2 className="mb-1 font-display text-lg font-bold text-brand-text">Zgłoś błąd w rozdaniu</h2>
            <p className="mb-3 truncate text-xs text-brand-dim">{deal.title}</p>

            <textarea
              value={message}
              onChange={e => { setMessage(e.target.value); setCopied(false); }}
              maxLength={MAX_MESSAGE}
              rows={4}
              autoFocus
              placeholder="Co jest nie tak? Np. zła odzywka w licytacji, brakująca karta, błąd w rozwiązaniu."
              className="w-full resize-none rounded-[9px] border border-brand-line bg-brand-bg p-3 text-sm text-brand-text placeholder:text-brand-dim/70 focus:border-brand-accent focus:outline-none"
            />
            <div className="mb-3 mt-1 text-right text-[10px] text-brand-dim">
              {message.length}/{MAX_MESSAGE}
            </div>

            <p className="mb-4 rounded-[9px] bg-brand-soft p-2.5 text-[11px] leading-relaxed text-brand-dim">
              Przycisk otworzy Twój program pocztowy z gotową wiadomością — trzeba ją jeszcze
              u siebie wysłać. Jeśli nic się nie otworzy, skopiuj treść i wyślij ręcznie na{' '}
              <span className="text-brand-text">{REPORT_ADDRESS}</span>.
            </p>

            <div className="flex gap-2">
              <button
                onClick={close}
                className="h-11 flex-1 rounded-[9px] border border-brand-line bg-brand-soft text-sm font-medium text-brand-text transition-colors hover:bg-brand-line/60"
              >
                Anuluj
              </button>
              {ready ? (
                <a
                  href={href}
                  onClick={close}
                  className="flex h-11 flex-1 items-center justify-center rounded-[9px] bg-brand-accent font-display text-sm font-bold text-brand-btn-text transition-colors hover:bg-brand-accent-soft"
                >
                  Otwórz e-mail
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="flex h-11 flex-1 cursor-not-allowed items-center justify-center rounded-[9px] bg-brand-soft text-sm font-medium text-brand-dim opacity-60"
                >
                  Otwórz e-mail
                </span>
              )}
            </div>

            <button
              onClick={copy}
              disabled={!ready}
              className="mt-2 w-full py-2 text-xs text-brand-dim transition-colors hover:text-brand-text disabled:opacity-40"
            >
              {copied ? '✓ Skopiowano do schowka' : 'Skopiuj treść zgłoszenia'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

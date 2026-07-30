import { useState, useRef, useLayoutEffect, type ReactNode } from 'react';
import type { Deal, Seat, Suit, HandCards } from '../types';
import type { GameState } from '../hooks/useGameState';
import { HandDisplay } from './HandDisplay';
import { TrickDisplay } from './TrickDisplay';
import { BiddingTable } from './BiddingTable';
import { ContractBox } from './ContractBox';
import { SUIT_COLORS } from '../lib/suitColors';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

// Count cards in a rank string, treating "10" as a single card.
function countRanks(s: string): number {
  let n = 0, i = 0;
  while (i < s.length) {
    if (s[i] === '1' && s[i + 1] === '0') { n += 1; i += 2; }
    else { n += 1; i += 1; }
  }
  return n;
}

// Suits where all 13 cards are already visible (shown hands + played cards):
// opponents can hold no more, so hidden-hand "?" placeholders for them are dropped.
function buildExhaustedSuits(state: GameState, playedBySeat: Partial<Record<Seat, string[]>>): Set<Suit> {
  const exhausted = new Set<Suit>();
  const seats: Seat[] = ['N', 'E', 'S', 'W'];
  for (const suit of SUITS) {
    let visible = 0;
    for (const seat of seats) {
      const hand = state.hands[seat];
      if (hand && (hand as { hidden?: true }).hidden !== true) {
        visible += countRanks((hand as HandCards)[suit] ?? '');
      } else {
        visible += (playedBySeat[seat] ?? []).filter(c => c[0] === suit).length;
      }
    }
    if (visible >= 13) exhausted.add(suit);
  }
  return exhausted;
}

function buildPlayedBySeat(state: GameState): Partial<Record<Seat, string[]>> {
  const sets: Partial<Record<Seat, Set<string>>> = {};
  const add = (seat: string, card: string) => {
    (sets[seat as Seat] ??= new Set()).add(card);
  };
  for (const trick of state.tricks) {
    for (const [seat, card] of Object.entries(trick.cards)) {
      if (card) add(seat, card);
    }
  }
  for (const [seat, card] of Object.entries(state.visibleTrick)) {
    if (card) add(seat, card);
  }
  const result: Partial<Record<Seat, string[]>> = {};
  for (const [seat, set] of Object.entries(sets)) {
    result[seat as Seat] = [...set];
  }
  return result;
}

function buildKnownVoids(state: GameState): Partial<Record<Seat, Set<string>>> {
  const voids: Partial<Record<Seat, Set<string>>> = {};
  const addVoid = (seat: Seat, suit: string) => {
    (voids[seat] ??= new Set()).add(suit);
  };
  const checkTrick = (leader: Seat | null, cards: Partial<Record<Seat, string>>) => {
    if (!leader) return;
    const ledCard = cards[leader];
    if (!ledCard) return;
    const ledSuit = ledCard[0];
    for (const [seat, card] of Object.entries(cards) as [Seat, string][]) {
      if (seat === leader || !card) continue;
      if (card[0] !== ledSuit) addVoid(seat, ledSuit);
    }
  };
  for (const trick of state.tricks) {
    checkTrick(trick.leader as Seat, trick.cards as Partial<Record<Seat, string>>);
  }
  checkTrick(state.currentTrickLeader, state.visibleTrick);
  return voids;
}

/**
 * Skaluje diagram tak, żeby zawsze mieścił się w kontenerze — jeden układ krzyża
 * dla telefonu i desktopu zamiast dwóch osobnych. Rozmiar treści mierzymy przed
 * transformacją (`offsetWidth` nie widzi `scale`), więc pomiar nie zapętla się z
 * ResizeObserverem. Skala nigdy nie przekracza 1: na dużym ekranie diagram ma
 * swoje naturalne, projektowe rozmiary.
 */
function ScaledBoard({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return;

    const measure = () => {
      const cw = content.offsetWidth;
      const ch = content.offsetHeight;
      if (!cw || !ch) return;
      // Podłoga skali. Gdy kontener chwilowo ma 0 px wysokości (obrót ekranu,
      // rozwinięcie panelu decyzji), iloraz wychodził 0 i nie przechodził przez
      // strażnik `next > 0` — diagram zostawał w poprzedniej, za dużej skali i był
      // przycinany. Mikroskopijny stół jest złym stanem przejściowym, ale obcięte
      // ręce N/S to zły stan trwały.
      const raw = Math.min(box.clientWidth / cw, box.clientHeight / ch, 1);
      const next = Math.max(raw, 0.05);
      setScale(prev => (Math.abs(prev - next) < 0.005 ? prev : next));
    };

    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(content);
    measure();
    return () => ro.disconnect();
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden p-1.5 md:p-4 md:pt-16">
      <div ref={boxRef} className="flex h-full w-full items-center justify-center">
        <div
          ref={contentRef}
          className="flex-shrink-0 origin-center"
          style={{ transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

const SUIT_SYM: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

function ContractChip({ contract, declarer }: { contract: string; declarer: Seat }) {
  const match = contract.match(/^(\d)(S|H|D|C|NT)$/);
  return (
    <span className="flex items-center gap-1 rounded-[7px] border border-brand-accent/50 bg-brand-soft px-2 py-1 text-[12px] font-display font-bold leading-none">
      {match ? (
        <span className="text-brand-text">
          {match[1]}
          {match[2] === 'NT'
            ? 'BA'
            : <span style={{ color: SUIT_COLORS.panel[match[2] as Suit] }}>{SUIT_SYM[match[2]]}</span>}
        </span>
      ) : (
        <span className="text-brand-text">{contract}</span>
      )}
      <span className="text-brand-accent-soft">{declarer}</span>
    </span>
  );
}

interface Props {
  deal: Deal;
  state: GameState;
  /** Licznik trybu na czas — na telefonie w pasku chipów, na desktopie nad filcem. */
  timer?: ReactNode;
  /** Zgłaszanie błędu — wstrzykiwane z zewnątrz, żeby stół nie zależał od auth. */
  report?: ReactNode;
}

export function BridgeTable({ deal, state, timer, report }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const playedBySeat = buildPlayedBySeat(state);
  const knownVoids = buildKnownVoids(state);
  const exhaustedSuits = buildExhaustedSuits(state, playedBySeat);

  const hand = (seat: Seat) => (
    <HandDisplay
      seat={seat}
      hand={state.hands[seat]}
      seatPlayed={playedBySeat[seat]}
      knownVoids={knownVoids[seat]}
      exhaustedSuits={exhaustedSuits}
    />
  );

  return (
    <div className="flex h-full w-full min-h-0 flex-col">
      {/* Mobile: pasek chipów zamiast paneli — kontrakt, lewy, licytacja na żądanie. */}
      <div className="mb-1.5 flex flex-shrink-0 items-center gap-1.5 md:hidden">
        <ContractChip contract={deal.contract} declarer={deal.declarer} />
        <span className="rounded-[7px] border border-brand-line bg-brand-soft px-2 py-1 font-mono text-[12px] leading-none text-brand-text">
          NS {state.trickScores.NS} <span className="text-brand-dim">·</span> EW {state.trickScores.EW}
        </span>
        {timer}
        {/* Ten sam chip otwiera i zamyka arkusz — pasek chipów jest nad filcem, więc
            zostaje klikalny, kiedy arkusz przykrywa stół. */}
        <button
          onClick={() => setSheetOpen(open => !open)}
          aria-expanded={sheetOpen}
          className="ml-auto flex h-9 items-center gap-1 rounded-[7px] border border-brand-line bg-brand-soft px-3 text-[12px] leading-none text-brand-accent-soft"
        >
          Licytacja
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="3" strokeLinecap="round"
            className={sheetOpen ? 'rotate-180' : ''}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-brand-line bg-brand-felt shadow-2xl">
        {/* Felt texture overlay */}
        <div className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
        />

        {/* Desktop: kategoria + trudność w rogu */}
        <div className="absolute left-3 top-3 z-10 hidden items-center gap-1 md:flex">
          <span className="rounded border border-brand-line bg-brand-panel/80 px-1.5 py-0.5 text-[10px] text-brand-dim">
            {deal.category}
          </span>
          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
            deal.difficulty === 'Easy' ? 'bg-emerald-900/60 text-emerald-400 border-emerald-700' :
            deal.difficulty === 'Medium' ? 'bg-yellow-900/60 text-yellow-400 border-yellow-700' :
            deal.difficulty === 'Hard' ? 'bg-red-900/60 text-red-400 border-red-700' :
            'bg-violet-900/60 text-violet-400 border-violet-700'
          }`}>
            {deal.difficulty}
          </span>
        </div>

        {/* Desktop: licznik nad środkiem filcu */}
        {timer && (
          <div className="absolute left-1/2 top-2 z-10 hidden -translate-x-1/2 md:block">{timer}</div>
        )}

        {/* Desktop: licytacja i kontrakt na stałe w rogach */}
        <div className="absolute right-3 top-3 z-10 hidden w-64 md:block">
          <BiddingTable bidding={deal.bidding} dealer={deal.dealer} bidAlerts={deal.bidAlerts} />
        </div>

        {/* Lewy dolny róg filcu — jedyny narożnik wolny na obu układach (prawy dolny
            zajmuje ContractBox na desktopie). Pod arkuszem licytacji (z-20). */}
        {report && <div className="absolute bottom-2 left-2 z-10">{report}</div>}

        <div className="absolute bottom-3 right-3 z-10 hidden md:block">
          <ContractBox
            contract={deal.contract}
            declarer={deal.declarer}
            trickScores={state.trickScores}
            vulnerability={deal.vulnerability}
          />
        </div>

        {/* Krzyż N/W/E/S — jeden układ, skalowany do dostępnego miejsca */}
        <ScaledBoard>
          <div className="flex flex-col items-center gap-1.5">
            {hand('N')}
            <div className="flex items-center gap-1.5">
              {hand('W')}
              <div className="flex h-[106px] w-[106px] flex-shrink-0 items-center justify-center rounded-xl border border-brand-line bg-black/20 shadow-inner">
                <TrickDisplay
                  visibleTrick={state.visibleTrick as Partial<Record<Seat, string>>}
                  leader={state.currentTrickLeader as Seat | null}
                />
              </div>
              {hand('E')}
            </div>
            {hand('S')}
          </div>
        </ScaledBoard>

        {/* Mobile: arkusz z licytacją — otwierany z chipa, zasłania stół tylko na żądanie */}
        {sheetOpen && (
          <div className="absolute inset-0 z-20 flex flex-col justify-end md:hidden" onClick={() => setSheetOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div
              className="slide-up relative max-h-[80%] overflow-y-auto rounded-t-xl border-t border-brand-line bg-brand-panel p-3"
              onClick={e => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-8 rounded-full bg-white/20" />
              <BiddingTable bidding={deal.bidding} dealer={deal.dealer} bidAlerts={deal.bidAlerts} />
              <div className="mt-3 flex items-center justify-between border-t border-brand-line pt-3 text-[12px]">
                <span className="text-brand-dim">{deal.category} · {deal.difficulty}</span>
                <span className="text-brand-text">
                  {deal.contract} {deal.declarer} · {deal.vulnerability}
                </span>
              </div>
              <button
                onClick={() => setSheetOpen(false)}
                className="mt-3 w-full rounded-[9px] border border-brand-line bg-brand-soft py-2.5 text-[13px] text-brand-text"
              >
                Zamknij
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

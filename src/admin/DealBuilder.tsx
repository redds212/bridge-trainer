import { useState, useMemo } from 'react';
import type { Seat, Suit, Deal, HandCards, HandData, TrickStep } from '../types';
import { validateDeal, type DealValidation } from '../lib/validateDeal';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const SUIT_SYM: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_COL: Record<Suit, string> = { S: 'text-slate-900', H: 'text-red-600', D: 'text-red-600', C: 'text-slate-900' };
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const ALL_SEATS: Seat[] = ['N', 'E', 'S', 'W'];
const CW: Record<Seat, Seat> = { N: 'E', E: 'S', S: 'W', W: 'N' };
const CONTRACT_SUITS = ['C', 'D', 'H', 'S', 'NT'] as const;
type ContractSuit = (typeof CONTRACT_SUITS)[number];

const SEAT_LABEL: Record<Seat, string> = { N: 'Północ', E: 'Wschód', S: 'Południe', W: 'Zachód' };
const SEAT_BG: Record<Seat, string> = { N: 'bg-blue-600', E: 'bg-emerald-600', S: 'bg-amber-600', W: 'bg-purple-600' };
const SEAT_BG_SOFT: Record<Seat, string> = { N: 'bg-blue-900/40', E: 'bg-emerald-900/40', S: 'bg-amber-900/40', W: 'bg-purple-900/40' };
const SEAT_TEXT: Record<Seat, string> = { N: 'text-blue-400', E: 'text-emerald-400', S: 'text-amber-400', W: 'text-purple-400' };
const SEAT_BORDER: Record<Seat, string> = { N: 'border-blue-500', E: 'border-emerald-500', S: 'border-amber-500', W: 'border-purple-500' };

function playOrder(leader: Seat): Seat[] {
  const o: Seat[] = [leader];
  let c = CW[leader];
  while (c !== leader) { o.push(c); c = CW[c]; }
  return o;
}

function trumpFromContract(contract: string): Suit | null {
  const s = contract.replace(/^\d/, '').toUpperCase();
  if (!s || s === 'NT') return null;
  const suit = s[0] as Suit;
  return SUITS.includes(suit) ? suit : null;
}

function calcWinner(cards: Partial<Record<Seat, string>>, leader: Seat, trump: Suit | null): Seat {
  const ledSuit = (cards[leader] ?? '')[0] as Suit | undefined;
  let winner = leader;
  let bestScore = -1;
  let bestIsTrump = false;
  for (const seat of ALL_SEATS) {
    const card = cards[seat];
    if (!card) continue;
    const suit = card[0] as Suit;
    const rank = card.slice(1);
    const score = RANKS.length - 1 - RANKS.indexOf(rank);
    const isTrump = trump !== null && suit === trump;
    if (isTrump && !bestIsTrump) {
      winner = seat; bestScore = score; bestIsTrump = true;
    } else if (isTrump && bestIsTrump && score > bestScore) {
      winner = seat; bestScore = score;
    } else if (!isTrump && !bestIsTrump && suit === ledSuit && score > bestScore) {
      winner = seat; bestScore = score;
    }
  }
  return winner;
}

function cardsToHandCards(codes: string[]): HandCards {
  const bySuit: Record<Suit, string[]> = { S: [], H: [], D: [], C: [] };
  for (const code of codes) bySuit[code[0] as Suit].push(code.slice(1));
  const result: HandCards = { S: '', H: '', D: '', C: '' };
  for (const suit of SUITS) {
    bySuit[suit].sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b));
    result[suit] = bySuit[suit].join('');
  }
  return result;
}

// ── Bidding legality ───────────────────────────────────────────

const SUIT_IDX: Record<string, number> = { C: 0, D: 1, H: 2, S: 3, NT: 4 };
const bidRank = (bid: string) => (parseInt(bid[0]) - 1) * 5 + (SUIT_IDX[bid.slice(1)] ?? 0);

interface BiddingMeta { disabled: Set<string>; ended: boolean }

function getBiddingState(bidding: string[]): BiddingMeta {
  let lastRank = -1;
  let lastCallMakerPos = -1; // 0-3 relative to dealer
  let lastCallType: 'bid' | 'x' | 'xx' | null = null;
  let consecutivePasses = 0;
  let hasOpening = false;

  for (let i = 0; i < bidding.length; i++) {
    const bid = bidding[i];
    if (bid === 'P') {
      consecutivePasses++;
    } else {
      consecutivePasses = 0;
      lastCallMakerPos = i % 4;
      if (bid === 'X') { lastCallType = 'x'; }
      else if (bid === 'XX') { lastCallType = 'xx'; }
      else { lastRank = bidRank(bid); lastCallType = 'bid'; hasOpening = true; }
    }
  }

  // 3 consecutive passes after an opening = end; 4 passes before any bid = pass-out
  const ended = hasOpening ? consecutivePasses >= 3 : consecutivePasses >= 4;
  const disabled = new Set<string>();

  if (ended) {
    ['P', 'X', 'XX'].forEach(b => disabled.add(b));
    for (let l = 1; l <= 7; l++) for (const s of Object.keys(SUIT_IDX)) disabled.add(`${l}${s}`);
    return { disabled, ended };
  }

  const curPos = bidding.length % 4;
  const sameSide = (a: number, b: number) => a % 2 === b % 2;

  // Suit/NT bids must be strictly higher than current highest bid
  for (let l = 1; l <= 7; l++)
    for (const s of Object.keys(SUIT_IDX))
      if (bidRank(`${l}${s}`) <= lastRank) disabled.add(`${l}${s}`);

  // X: only after a suit bid by the opposing side
  if (lastCallType !== 'bid' || lastCallMakerPos === -1 || sameSide(lastCallMakerPos, curPos))
    disabled.add('X');

  // XX: only after an X by the opposing side
  if (lastCallType !== 'x' || lastCallMakerPos === -1 || sameSide(lastCallMakerPos, curPos))
    disabled.add('XX');

  return { disabled, ended };
}

function formatBid(bid: string): string {
  if (bid === 'P' || bid === 'X' || bid === 'XX') return bid;
  const suit = bid.slice(1);
  return `${bid[0]}${suit === 'NT' ? 'BA' : SUIT_SYM[suit as Suit] ?? suit}`;
}

// ── Deal → State converter (for edit mode) ─────────────────────

function parseRankStr(s: string): string[] {
  const ranks: string[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === '1' && s[i + 1] === '0') { ranks.push('10'); i += 2; }
    else { ranks.push(s[i]); i++; }
  }
  return ranks;
}

function handToCards(hand: HandData, revealed?: HandCards): string[] {
  if ((hand as any).hidden) {
    if (!revealed) return [];
    return SUITS.flatMap(suit => parseRankStr(revealed[suit] ?? '').map(r => `${suit}${r}`));
  }
  const hc = hand as HandCards;
  return SUITS.flatMap(suit => parseRankStr(hc[suit] ?? '').map(r => `${suit}${r}`));
}

function dealToSt(deal: Deal): St {
  const m = deal.contract.match(/^(\d)(S|H|D|C|NT)$/);
  const contractLevel = (m?.[1] ?? '4') as St['contractLevel'];
  const contractSuit = (m?.[2] ?? 'H') as ContractSuit;

  const hands: Record<Seat, string[]> = { N: [], E: [], S: [], W: [] };
  const hiddenSeats = new Set<Seat>();

  for (const seat of ALL_SEATS) {
    const raw = deal.initialHands[seat];
    if ((raw as any).hidden) {
      hiddenSeats.add(seat);
      hands[seat] = handToCards(raw, deal.solution?.revealAllCards?.[seat]);
    } else {
      hands[seat] = handToCards(raw);
    }
  }

  const tricks: DraftTrick[] = deal.introSequence.map(step => ({
    leader: step.leader,
    cards: step.cards,
    winner: step.winner,
    isDecision: !step.winner,
  }));

  return {
    title: deal.title,
    category: deal.category as St['category'],
    difficulty: deal.difficulty as St['difficulty'],
    contractLevel,
    contractSuit,
    declarer: deal.declarer,
    dealer: deal.dealer,
    vulnerability: deal.vulnerability,
    hands,
    hiddenSeats,
    bidding: deal.bidding.flat(),
    tricks,
    decisionPrompt: deal.decisionPrompt ?? '',
    solutionText: deal.solution?.text ?? '',
  };
}

// ── Auto-fill 4th hand ─────────────────────────────────────────

function autoFillFourth(hands: Record<Seat, string[]>): Record<Seat, string[]> {
  const full = ALL_SEATS.filter(s => hands[s].length === 13);
  if (full.length !== 3) return hands;
  const partial = ALL_SEATS.find(s => hands[s].length < 13);
  if (!partial) return hands;
  const assigned = new Set(Object.values(hands).flat());
  const remaining = SUITS.flatMap(suit => RANKS.map(rank => `${suit}${rank}`)).filter(c => !assigned.has(c));
  if (remaining.length === 0) return hands;
  return { ...hands, [partial]: remaining };
}

// ── State types ────────────────────────────────────────────────

interface DraftTrick {
  leader: Seat;
  cards: Partial<Record<Seat, string>>;
  winner?: Seat;
  isDecision: boolean;
}

interface St {
  title: string;
  category: 'Rozgrywający' | 'Obrona';
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  contractLevel: '1' | '2' | '3' | '4' | '5' | '6' | '7';
  contractSuit: ContractSuit;
  declarer: Seat;
  dealer: Seat;
  vulnerability: string;
  hands: Record<Seat, string[]>;
  hiddenSeats: Set<Seat>;
  bidding: string[];
  tricks: DraftTrick[];
  decisionPrompt: string;
  solutionText: string;
}

const mkInitial = (): St => ({
  title: '',
  category: 'Rozgrywający',
  difficulty: 'Medium',
  contractLevel: '4',
  contractSuit: 'H',
  declarer: 'S',
  dealer: 'N',
  vulnerability: 'None',
  hands: { N: [], E: [], S: [], W: [] },
  hiddenSeats: new Set<Seat>(['E', 'W']),
  bidding: [],
  tricks: [],
  decisionPrompt: '',
  solutionText: '',
});

interface Props {
  initialData?: Deal;
  isEdit?: boolean;
  onSave: (deal: Deal) => Promise<{ error?: string }>;
  onCancel: () => void;
}

export function DealBuilder({ initialData, isEdit, onSave, onCancel }: Props) {
  const [st, setSt] = useState<St>(() => initialData ? dealToSt(initialData) : mkInitial());
  const [activeSeat, setActiveSeat] = useState<Seat>('N');
  const [activeTrick, setActiveTrick] = useState<DraftTrick | null>(null);
  const [trickSeat, setTrickSeat] = useState<Seat | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<DealValidation | null>(null);
  const [ack, setAck] = useState(false);

  const contract = `${st.contractLevel}${st.contractSuit}`;
  const contractSuitSym = st.contractSuit === 'NT' ? 'BA' : SUIT_SYM[st.contractSuit as Suit];

  // ── derived ────────────────────────────────────────────────
  const allPlayedCards = useMemo(() => {
    const s = new Set<string>();
    for (const t of st.tricks) for (const c of Object.values(t.cards)) if (c) s.add(c);
    return s;
  }, [st.tricks]);

  const activePlayedCards = useMemo(() => {
    if (!activeTrick) return new Set<string>();
    return new Set(Object.values(activeTrick.cards).filter(Boolean) as string[]);
  }, [activeTrick]);

  const biddingState = useMemo(() => getBiddingState(st.bidding), [st.bidding]);

  const cardOwner = (code: string): Seat | null =>
    ALL_SEATS.find(s => st.hands[s].includes(code)) ?? null;

  const remaining = (seat: Seat) =>
    st.hands[seat].filter(c => !allPlayedCards.has(c) && !activePlayedCards.has(c));

  // Must-follow-suit: non-leader must play led suit if they hold it
  const validForTrick = (seat: Seat, avail: string[]): string[] => {
    if (!activeTrick || seat === activeTrick.leader) return avail;
    const leaderCard = activeTrick.cards[activeTrick.leader];
    if (!leaderCard) return avail;
    const ledSuit = leaderCard[0];
    const hasSuit = avail.some(c => c[0] === ledSuit);
    return hasSuit ? avail.filter(c => c[0] === ledSuit) : avail;
  };

  // ── card assignment ────────────────────────────────────────
  const toggleCard = (code: string) => {
    if (allPlayedCards.has(code)) return;
    const owner = cardOwner(code);
    if (owner && owner !== activeSeat) return; // can't take from another player
    setSt(prev => {
      let hands = { ...prev.hands };
      if (owner === activeSeat) {
        hands[activeSeat] = hands[activeSeat].filter(c => c !== code);
      } else {
        if (prev.hands[activeSeat].length >= 13) return prev; // max 13
        hands[activeSeat] = [...hands[activeSeat], code];
      }
      hands = autoFillFourth(hands);
      return { ...prev, hands };
    });
  };

  const toggleHidden = (seat: Seat) =>
    setSt(prev => {
      const hs = new Set(prev.hiddenSeats);
      hs.has(seat) ? hs.delete(seat) : hs.add(seat);
      return { ...prev, hiddenSeats: hs };
    });

  // ── trick builder ──────────────────────────────────────────
  const startTrick = () => {
    const last = st.tricks[st.tricks.length - 1];
    const leader: Seat = last?.winner ?? CW[st.declarer];
    setActiveTrick({ leader, cards: {}, isDecision: false });
    setTrickSeat(leader);
  };

  const setLeader = (seat: Seat) => {
    setActiveTrick({ leader: seat, cards: {}, isDecision: false });
    setTrickSeat(seat);
  };

  const playCard = (seat: Seat, code: string) => {
    if (!activeTrick || trickSeat !== seat) return;
    const order = playOrder(activeTrick.leader);
    const newCards = { ...activeTrick.cards, [seat]: code };
    const idx = order.indexOf(seat);
    const next = idx < order.length - 1 ? order[idx + 1] : null;
    if (!next) {
      const trump = trumpFromContract(contract);
      setActiveTrick({ ...activeTrick, cards: newCards, winner: calcWinner(newCards, activeTrick.leader, trump) });
      setTrickSeat(null);
    } else {
      setActiveTrick({ ...activeTrick, cards: newCards });
      setTrickSeat(next);
    }
  };

  const completeTrick = () => {
    if (!activeTrick?.winner) return;
    setSt(prev => ({ ...prev, tricks: [...prev.tricks, activeTrick] }));
    setActiveTrick(null); setTrickSeat(null);
  };

  const markDecision = () => {
    if (!activeTrick?.cards[activeTrick.leader]) return;
    const partialCards: Partial<Record<Seat, string>> = { [activeTrick.leader]: activeTrick.cards[activeTrick.leader]! };
    setSt(prev => ({ ...prev, tricks: [...prev.tricks, { ...activeTrick, cards: partialCards, isDecision: true, winner: undefined }] }));
    setActiveTrick(null); setTrickSeat(null);
  };

  const removeTrick = () => setSt(prev => ({ ...prev, tricks: prev.tricks.slice(0, -1) }));
  const cancelTrick = () => { setActiveTrick(null); setTrickSeat(null); };

  // ── bidding ────────────────────────────────────────────────
  const addBid = (bid: string) => {
    if (biddingState.disabled.has(bid)) return;
    setSt(prev => ({ ...prev, bidding: [...prev.bidding, bid] }));
  };
  const removeBid = () => setSt(prev => ({ ...prev, bidding: prev.bidding.slice(0, -1) }));

  // ── save ───────────────────────────────────────────────────
  const save = async () => {
    setError('');
    if (!st.title.trim()) { setError('Wpisz tytuł rozdania.'); return; }
    const initialHands: Record<Seat, any> = {} as any;
    const revealAllCards: Partial<Record<Seat, HandCards>> = {};
    for (const seat of ALL_SEATS) {
      if (st.hiddenSeats.has(seat)) {
        initialHands[seat] = { hidden: true };
        if (st.hands[seat].length > 0) revealAllCards[seat] = cardsToHandCards(st.hands[seat]);
      } else {
        initialHands[seat] = cardsToHandCards(st.hands[seat]);
      }
    }
    const introSequence: TrickStep[] = st.tricks.map((t, i) => ({
      trick: i + 1, leader: t.leader, cards: t.cards,
      ...(t.winner ? { winner: t.winner } : {}),
    }));
    const bidding: string[][] = [];
    for (let i = 0; i < st.bidding.length; i += 4) bidding.push(st.bidding.slice(i, i + 4));

    const dealObj: Deal = {
      id: (isEdit && initialData?.id) ? initialData.id : `deal-custom-${Date.now()}`,
      title: st.title.trim(),
      category: st.category,
      difficulty: st.difficulty,
      contract,
      declarer: st.declarer,
      dealer: st.dealer,
      vulnerability: st.vulnerability,
      bidding,
      initialHands,
      introSequence,
      decisionPrompt: st.decisionPrompt.trim(),
      solution: { text: st.solutionText.trim(), revealAllCards },
    };

    // Validate beyond the live input constraints. Errors block; warnings need
    // one extra confirming click ("Zapisz mimo ostrzeżeń").
    const v = validateDeal(dealObj);
    if (v.errors.length) { setIssues(v); setAck(false); return; }
    if (v.warnings.length && !ack) { setIssues(v); setAck(true); return; }
    setIssues(null);

    setSaving(true);
    const res = await onSave(dealObj);
    // On success the parent unmounts this builder; only handle the error path.
    if (res?.error) { setError('Błąd zapisu: ' + res.error); setSaving(false); }
  };

  const totalCards = Object.values(st.hands).reduce((s, h) => s + h.length, 0);
  const hasDecision = st.tricks.length > 0 && st.tricks[st.tricks.length - 1].isDecision;

  // ── render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm transition-colors">← Anuluj</button>
        <h1 className="text-white font-bold">{isEdit ? 'Edytuj Rozdanie' : 'Nowe Rozdanie'}</h1>
        <span className="text-slate-500 text-xs">{totalCards}/52 kart przypisanych</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-8 pb-24">

          {/* ── 1. METADATA ── */}
          <Section title="Podstawowe informacje">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Tytuł rozdania</Label>
                <input value={st.title} onChange={e => setSt(p => ({ ...p, title: e.target.value }))}
                  placeholder="np. Impas podwójny w kierach"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <Label>Kategoria</Label>
                <div className="flex gap-2">
                  {(['Rozgrywający', 'Obrona'] as const).map(cat => (
                    <Toggle key={cat} active={st.category === cat} onClick={() => setSt(p => ({ ...p, category: cat }))}
                      activeClass="bg-blue-700 border-blue-500 text-white">{cat}</Toggle>
                  ))}
                </div>
              </div>

              <div>
                <Label>Trudność</Label>
                <div className="flex gap-2">
                  {(['Easy', 'Medium', 'Hard', 'Expert'] as const).map(d => (
                    <Toggle key={d} active={st.difficulty === d} onClick={() => setSt(p => ({ ...p, difficulty: d }))}
                      activeClass={
                        d === 'Easy' ? 'bg-emerald-800 border-emerald-600 text-emerald-200' :
                        d === 'Medium' ? 'bg-yellow-800 border-yellow-600 text-yellow-200' :
                        d === 'Hard' ? 'bg-red-800 border-red-600 text-red-200' :
                        'bg-violet-800 border-violet-600 text-violet-200'
                      }>{d}</Toggle>
                  ))}
                </div>
              </div>

              {/* Contract picker */}
              <div>
                <Label>Kontrakt</Label>
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    {(['1','2','3','4','5','6','7'] as const).map(l => (
                      <button key={l} onClick={() => setSt(p => ({ ...p, contractLevel: l }))}
                        className={`w-9 py-1.5 rounded text-sm font-bold border transition-colors ${
                          st.contractLevel === l
                            ? 'bg-slate-500 border-slate-400 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}>{l}</button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    {CONTRACT_SUITS.map(s => {
                      const red = s === 'H' || s === 'D';
                      const sym = s === 'NT' ? 'BA' : SUIT_SYM[s as Suit];
                      return (
                        <button key={s} onClick={() => setSt(p => ({ ...p, contractSuit: s }))}
                          className={`flex-1 py-1.5 rounded text-sm font-bold border transition-colors ${
                            st.contractSuit === s
                              ? red ? 'bg-red-800 border-red-600 text-white' : 'bg-slate-600 border-slate-400 text-white'
                              : red ? 'bg-slate-800 border-slate-700 text-red-400 hover:text-red-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                          }`}>{sym}</button>
                      );
                    })}
                  </div>
                  <div className="text-sm text-slate-400 pt-0.5">
                    Wybrany kontrakt: <span className="font-bold text-white">{st.contractLevel}{contractSuitSym}</span>
                  </div>
                </div>
              </div>

              <div>
                <Label>Rozgrywający</Label>
                <SeatPicker value={st.declarer} onChange={v => setSt(p => ({ ...p, declarer: v }))} />
              </div>

              <div>
                <Label>Otwierający (dealer)</Label>
                <SeatPicker value={st.dealer} onChange={v => setSt(p => ({ ...p, dealer: v }))} plain />
              </div>

              <div>
                <Label>Założenia (vulnerability)</Label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { v: 'None', l: 'Obie przed' }, { v: 'NS', l: 'NS po' },
                    { v: 'EW', l: 'EW po' }, { v: 'Both', l: 'Obie po' },
                  ].map(({ v, l }) => (
                    <Toggle key={v} active={st.vulnerability === v} onClick={() => setSt(p => ({ ...p, vulnerability: v }))}
                      activeClass="bg-red-900/70 border-red-600 text-red-200">{l}</Toggle>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ── 2. HANDS ── */}
          <Section title="Ręce graczy — przypisz karty">
            <div className="flex gap-2 mb-4">
              {ALL_SEATS.map(seat => (
                <button key={seat} onClick={() => setActiveSeat(seat)}
                  className={`flex-1 py-2 px-2 rounded-lg text-sm font-bold border transition-colors ${
                    activeSeat === seat ? `${SEAT_BG[seat]} border-transparent text-white` : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white'
                  }`}>
                  <div>{seat} — {SEAT_LABEL[seat]}</div>
                  <div className="text-[11px] font-normal opacity-70 mt-0.5">
                    {st.hands[seat].length}/13 · {st.hiddenSeats.has(seat) ? '🙈 ukryta' : '👁 widoczna'}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 mb-3">
              <span className={`text-sm font-semibold ${SEAT_TEXT[activeSeat]}`}>{activeSeat} — {SEAT_LABEL[activeSeat]}</span>
              <button onClick={() => toggleHidden(activeSeat)}
                className={`text-xs px-3 py-1 rounded border transition-colors ${
                  st.hiddenSeats.has(activeSeat) ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-blue-900/50 border-blue-700 text-blue-300 hover:bg-blue-900/70'
                }`}>
                {st.hiddenSeats.has(activeSeat) ? '🙈 Ukryta — kliknij aby pokazać' : '👁 Widoczna — kliknij aby ukryć'}
              </button>
              {st.hands[activeSeat].length === 13 && <span className="text-xs text-emerald-400 font-medium">✓ kompletna</span>}
              <span className="ml-auto text-xs text-slate-500">{st.hands[activeSeat].length}/13</span>
            </div>

            {/* 52-card grid */}
            <div className="space-y-1.5 bg-slate-800/40 rounded-xl p-3 border border-slate-700">
              {SUITS.map(suit => (
                <div key={suit} className="flex items-center gap-1">
                  <span className={`w-5 text-center text-base font-bold select-none ${SUIT_COL[suit]} bg-white rounded px-0.5`}>
                    {SUIT_SYM[suit]}
                  </span>
                  {RANKS.map(rank => {
                    const code = `${suit}${rank}`;
                    const owner = cardOwner(code);
                    const played = allPlayedCards.has(code);
                    const mine = owner === activeSeat;
                    const other = owner && owner !== activeSeat;
                    const atLimit = !owner && st.hands[activeSeat].length >= 13;
                    const isDisabled = played || !!other || atLimit;
                    return (
                      <button key={code} disabled={isDisabled} onClick={() => toggleCard(code)}
                        title={
                          other ? `Należy do ${owner} — odznacz w zakładce ${owner}` :
                          atLimit ? `${activeSeat} ma już 13 kart` :
                          played ? 'Zagrana w lewie' : code
                        }
                        className={`relative w-9 h-8 rounded text-xs font-mono font-bold border transition-all ${
                          played
                            ? 'opacity-20 cursor-not-allowed bg-slate-800 border-slate-700 text-slate-500'
                            : mine
                            ? `${SEAT_BG[activeSeat]} border-transparent text-white shadow`
                            : other
                            ? `${SEAT_BG_SOFT[owner!]} ${SEAT_TEXT[owner!]} border-slate-700 opacity-60 cursor-not-allowed`
                            : atLimit
                            ? 'bg-slate-800 border-slate-800 text-slate-600 cursor-not-allowed'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                        }`}>
                        {rank}
                        {other && <span className="absolute bottom-0 right-0 text-[7px] leading-none px-0.5">{owner}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-2 flex gap-4 text-xs">
              {ALL_SEATS.map(seat => (
                <span key={seat} className={`flex gap-1 items-center ${SEAT_TEXT[seat]}`}>
                  <b>{seat}</b>{st.hands[seat].length}
                  {st.hands[seat].length === 13 && <span className="text-emerald-400">✓</span>}
                </span>
              ))}
              <span className="ml-auto text-slate-500">{totalCards}/52</span>
            </div>
          </Section>

          {/* ── 3. BIDDING ── */}
          <Section title="Licytacja">
            {st.bidding.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1 bg-slate-800/40 rounded-lg p-2 border border-slate-700 min-h-[2rem]">
                {st.bidding.map((bid, i) => (
                  <span key={i} className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                    bid === 'P' ? 'bg-slate-700 text-slate-400' :
                    bid === 'X' ? 'bg-red-900/70 text-red-300' :
                    bid === 'XX' ? 'bg-blue-900/70 text-blue-300' :
                    (bid.includes('H') || bid.includes('D')) ? 'bg-slate-700 text-red-400' :
                    'bg-slate-700 text-white'
                  }`}>{formatBid(bid)}</span>
                ))}
              </div>
            )}

            {biddingState.ended ? (
              <div className="text-sm text-emerald-400/80 italic bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2 flex items-center gap-3">
                <span>✓ Licytacja zakończona</span>
                <button onClick={removeBid} disabled={!st.bidding.length}
                  className="text-xs px-2 py-0.5 bg-slate-800 border border-slate-600 text-slate-400 rounded hover:text-white disabled:opacity-30 transition-colors">
                  ⌫ Cofnij ostatnią
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  {(['P', 'X', 'XX'] as const).map(bid => {
                    const dis = biddingState.disabled.has(bid);
                    const cls = bid === 'P' ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' :
                      bid === 'X' ? 'bg-red-900/50 border-red-800 text-red-300 hover:bg-red-900/70' :
                      'bg-blue-900/50 border-blue-800 text-blue-300 hover:bg-blue-900/70';
                    return (
                      <button key={bid} onClick={() => addBid(bid)} disabled={dis}
                        className={`px-4 py-1.5 rounded text-sm font-bold border transition-colors ${
                          dis ? 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed' : cls
                        }`}>
                        {bid === 'P' ? 'Pas' : bid}
                      </button>
                    );
                  })}
                  <button onClick={removeBid} disabled={!st.bidding.length}
                    className="ml-auto px-3 py-1.5 rounded text-sm border bg-slate-800 border-slate-600 text-slate-400 hover:text-white disabled:opacity-30 transition-colors">
                    ⌫ Usuń
                  </button>
                </div>
                {[1, 2, 3, 4, 5, 6, 7].map(level => (
                  <div key={level} className="flex gap-1.5">
                    {CONTRACT_SUITS.map(s => {
                      const bid = `${level}${s}`;
                      const red = s === 'H' || s === 'D';
                      const dis = biddingState.disabled.has(bid);
                      const sym = s === 'NT' ? 'BA' : SUIT_SYM[s as Suit];
                      return (
                        <button key={bid} onClick={() => addBid(bid)} disabled={dis}
                          className={`flex-1 py-1.5 rounded text-sm font-bold border transition-colors ${
                            dis
                              ? 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed'
                              : `border-slate-700 bg-slate-800 hover:bg-slate-700 hover:border-slate-500 ${red ? 'text-red-400' : s === 'NT' ? 'text-slate-200' : 'text-slate-100'}`
                          }`}>
                          {level}{sym}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── 4. INTRO TRICKS ── */}
          <Section title="Sekwencja wstępna — lewy przed decyzją">
            {st.tricks.length > 0 && (
              <div className="mb-4 space-y-1.5">
                {st.tricks.map((t, i) => (
                  <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 border text-xs ${
                    t.isDecision ? 'bg-yellow-900/20 border-yellow-700/40' : 'bg-slate-800/50 border-slate-700/40'
                  }`}>
                    <span className="text-slate-500 w-5">#{i + 1}</span>
                    <span className={`font-bold ${SEAT_TEXT[t.leader]}`}>{t.leader}</span>
                    {playOrder(t.leader).filter(seat => t.cards[seat]).map(seat => (
                      <span key={seat}>
                        <span className={`text-[10px] ${SEAT_TEXT[seat]}`}>{seat}</span>
                        <span className="font-mono text-slate-200 ml-0.5">{t.cards[seat]}</span>
                      </span>
                    ))}
                    {t.winner && <span className="ml-auto text-emerald-400">→ {t.winner}</span>}
                    {t.isDecision && <span className="ml-auto text-yellow-400">⚡ punkt decyzji</span>}
                  </div>
                ))}
                <button onClick={removeTrick} className="text-xs text-red-400 hover:text-red-300 transition-colors mt-1">
                  ✕ Usuń ostatnią lewę
                </button>
              </div>
            )}

            {activeTrick ? (
              <div className="bg-slate-800/70 rounded-xl border border-slate-600 p-4 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-slate-300">Lewa #{st.tricks.length + 1}</span>
                  <span className="text-xs text-slate-500">Prowadzi:</span>
                  {!Object.values(activeTrick.cards).some(Boolean)
                    ? ALL_SEATS.map(seat => (
                      <button key={seat} onClick={() => setLeader(seat)}
                        className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                          activeTrick.leader === seat ? `${SEAT_BG[seat]} border-transparent text-white` : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                        }`}>{seat}</button>
                    ))
                    : <span className={`text-sm font-bold ${SEAT_TEXT[activeTrick.leader]}`}>
                        {activeTrick.leader} — {SEAT_LABEL[activeTrick.leader]}
                      </span>
                  }
                  {activeTrick.cards[activeTrick.leader] && (
                    <span className="text-xs text-slate-500">
                      kolor: <span className="font-bold">{SUIT_SYM[activeTrick.cards[activeTrick.leader]![0] as Suit]}</span>
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {playOrder(activeTrick.leader).map((seat, idx) => {
                    const isActive = trickSeat === seat;
                    const done = activeTrick.cards[seat] !== undefined;
                    const avail = remaining(seat);
                    const leaderCard = activeTrick.cards[activeTrick.leader];
                    const ledSuit = leaderCard ? leaderCard[0] as Suit : null;
                    const hasSuit = ledSuit ? avail.some(c => c[0] === ledSuit) : false;
                    const valid = validForTrick(seat, avail);
                    return (
                      <div key={seat} className={`rounded-lg border p-3 transition-all ${
                        isActive ? `${SEAT_BORDER[seat]} ${SEAT_BG_SOFT[seat]}` :
                        done ? 'border-slate-700/30 opacity-60' : 'border-slate-800 opacity-30'
                      }`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-xs font-bold ${SEAT_TEXT[seat]}`}>{idx + 1}. {seat} — {SEAT_LABEL[seat]}</span>
                          {done && <span className="font-mono text-white text-sm ml-2">{activeTrick.cards[seat]}</span>}
                          {st.hiddenSeats.has(seat) && <span className="text-xs text-slate-500">🙈</span>}
                          {isActive && avail.length === 0 && (
                            <span className="text-xs text-red-400 ml-2">Brak kart — przypisz rękę!</span>
                          )}
                        </div>
                        {isActive && avail.length > 0 && (
                          <>
                            {ledSuit && seat !== activeTrick.leader && (
                              <div className="text-xs mb-1.5">
                                {hasSuit
                                  ? <span className="text-yellow-400">⚠ Trzeba do koloru: {SUIT_SYM[ledSuit]}</span>
                                  : <span className="text-slate-400">Brak {SUIT_SYM[ledSuit]} — zagraj dowolną kartę</span>
                                }
                              </div>
                            )}
                            <div className="space-y-1">
                              {SUITS.map(suit => {
                                const sc = valid.filter(c => c[0] === suit)
                                  .sort((a, b) => RANKS.indexOf(a.slice(1)) - RANKS.indexOf(b.slice(1)));
                                if (!sc.length) return null;
                                return (
                                  <div key={suit} className="flex items-center gap-1">
                                    <span className={`text-xs w-4 font-bold ${SUIT_COL[suit]} bg-white rounded px-0.5 text-center`}>{SUIT_SYM[suit]}</span>
                                    {sc.map(code => (
                                      <button key={code} onClick={() => playCard(seat, code)}
                                        className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-400 rounded text-xs font-mono text-white transition-colors">
                                        {code.slice(1)}
                                      </button>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-1 flex-wrap">
                  {activeTrick.winner && (
                    <button onClick={completeTrick}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors">
                      ✓ Dodaj lewę — wygrywa {activeTrick.winner}
                    </button>
                  )}
                  {activeTrick.cards[activeTrick.leader] && (
                    <button onClick={markDecision}
                      className="px-4 py-2 bg-yellow-800/70 hover:bg-yellow-700/70 text-yellow-100 rounded-lg text-sm font-semibold border border-yellow-700 transition-colors">
                      ⚡ Ustaw tu punkt decyzji
                    </button>
                  )}
                  <button onClick={cancelTrick}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors ml-auto">
                    Anuluj
                  </button>
                </div>
              </div>
            ) : hasDecision ? (
              <p className="text-sm text-yellow-400/70 italic">Punkt decyzji ustawiony — wypełnij sekcję poniżej.</p>
            ) : (
              <button onClick={startTrick}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-colors">
                + Dodaj lewę
              </button>
            )}
          </Section>

          {/* ── 5. DECISION & SOLUTION ── */}
          <Section title="Pytanie decyzyjne i rozwiązanie">
            <div className="space-y-4">
              <div>
                <Label>Pytanie dla gracza (decisionPrompt)</Label>
                <textarea value={st.decisionPrompt} onChange={e => setSt(p => ({ ...p, decisionPrompt: e.target.value }))}
                  rows={4} placeholder="Co powinieneś zagrać w tej sytuacji? Opisz kontekst i zadaj pytanie..."
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 resize-y" />
              </div>
              <div>
                <Label>Rozwiązanie (solution.text)</Label>
                <textarea value={st.solutionText} onChange={e => setSt(p => ({ ...p, solutionText: e.target.value }))}
                  rows={4} placeholder="Prawidłową zagrywką jest... Wyjaśnienie dlaczego to zadziała..."
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 resize-y" />
              </div>
            </div>
          </Section>

        </div>
      </div>

      {issues && (issues.errors.length > 0 || issues.warnings.length > 0) && (
        <div className="bg-slate-900 border-t border-slate-700 px-6 py-2 max-h-32 overflow-y-auto space-y-1 flex-shrink-0">
          {issues.errors.map((e, i) => (
            <div key={`e${i}`} className="text-red-400 text-xs">✗ {e}</div>
          ))}
          {issues.warnings.map((w, i) => (
            <div key={`w${i}`} className="text-amber-400 text-xs">⚠ {w}</div>
          ))}
          {issues.errors.length === 0 && issues.warnings.length > 0 && (
            <div className="text-slate-400 text-[11px] pt-0.5">Możesz zapisać mimo ostrzeżeń lub poprawić rozdanie.</div>
          )}
        </div>
      )}

      <div className="bg-slate-900 border-t border-slate-700 px-6 py-3 flex items-center gap-4 flex-shrink-0">
        {error && <span className="text-red-400 text-sm">{error}</span>}
        <div className="ml-auto flex gap-3">
          <button onClick={onCancel} disabled={saving} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors disabled:opacity-50">Anuluj</button>
          <button onClick={save} disabled={saving} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50">
            {saving ? 'Zapisywanie…' : (ack && issues && issues.errors.length === 0 && issues.warnings.length > 0 ? 'Zapisz mimo ostrzeżeń' : 'Zapisz rozdanie')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-slate-300 font-semibold mb-4 text-xs uppercase tracking-widest border-b border-slate-700 pb-2">{title}</h2>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-slate-400 mb-1.5">{children}</div>;
}

function Toggle({ active, onClick, activeClass, children }: {
  active: boolean; onClick: () => void; activeClass: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded text-sm border transition-colors ${active ? activeClass : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white'}`}>
      {children}
    </button>
  );
}

function SeatPicker({ value, onChange, plain }: { value: Seat; onChange: (s: Seat) => void; plain?: boolean }) {
  return (
    <div className="flex gap-2">
      {ALL_SEATS.map(seat => (
        <button key={seat} onClick={() => onChange(seat)}
          className={`w-10 py-1.5 rounded text-sm font-bold border transition-colors ${
            value === seat
              ? plain ? 'bg-slate-600 border-slate-500 text-white' : `${SEAT_BG[seat]} border-transparent text-white`
              : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white'
          }`}>{seat}</button>
      ))}
    </div>
  );
}

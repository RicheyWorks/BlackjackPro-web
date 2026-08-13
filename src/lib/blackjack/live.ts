import type { Card, HandState, Outcome, Phase, Rank, Suit } from "./types";
import { RANKS, SUITS } from "./types";
import { cloneHand, emptyHand } from "./hand";
import { asInt, clampMoney, TABLE_MAX } from "./money";
import { sanitizeTape } from "./tape";
import type { Plus3Kind, Plus3Result } from "./plus3";
import { PLUS3_LABEL } from "./plus3";

const PHASES: Phase[] = ["INSURANCE", "PLAYER"];
const PLUS3_KINDS: Plus3Kind[] = [
  "SUITED_TRIPS",
  "STRAIGHT_FLUSH",
  "TRIPS",
  "STRAIGHT",
  "FLUSH",
];

export interface LiveShoe {
  cards: Card[];
  cutIndex: number;
  nextId: number;
}

export interface LiveCount {
  running: number;
  seenLow: number;
  seenMid: number;
  seenHigh: number;
  seen: number[];
}

export interface LiveRound {
  phase: Phase;
  activeHand: number;
  insuranceBet: number;
  dealer: HandState;
  hands: HandState[];
  shoe: LiveShoe;
  roundWagered: number;
  roundReturned: number;
  plus3Last: Plus3Result | null;
  count: LiveCount;
}

export function parseCard(raw: unknown): Card | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Number.isSafeInteger(o.id) || (o.id as number) < 1) return null;
  if (!RANKS.includes(o.rank as Rank)) return null;
  if (!SUITS.includes(o.suit as Suit)) return null;
  return { id: o.id as number, rank: o.rank as Rank, suit: o.suit as Suit };
}

function parseHand(raw: unknown): HandState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.cards) || o.cards.length > 21) return null;
  const cards: Card[] = [];
  for (const c of o.cards) {
    const parsed = parseCard(c);
    if (!parsed) return null;
    cards.push(parsed);
  }
  return {
    cards,
    bet: asInt(o.bet, 0, TABLE_MAX * 2),
    doubled: o.doubled === true,
    surrendered: o.surrendered === true,
    fromSplit: o.fromSplit === true,
    splitAce: o.splitAce === true,
    stood: o.stood === true,
  };
}

function parsePlus3Last(raw: unknown): Plus3Result | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = PLUS3_KINDS.includes(o.kind as Plus3Kind) ? (o.kind as Plus3Kind) : null;
  const stake = asInt(o.stake, 0, TABLE_MAX);
  const returned = asInt(o.returned, 0, TABLE_MAX * 101);
  return {
    stake,
    returned,
    kind,
    label: kind ? PLUS3_LABEL[kind] : "no win",
  };
}

function parseCount(raw: unknown): LiveCount {
  const empty: LiveCount = { running: 0, seenLow: 0, seenMid: 0, seenHigh: 0, seen: [] };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const seen = Array.isArray(o.seen)
    ? o.seen.filter((id): id is number => Number.isSafeInteger(id) && id > 0).slice(0, 400)
    : [];
  const running = typeof o.running === "number" && Number.isSafeInteger(o.running) ? o.running : 0;
  return {
    running: Math.max(-400, Math.min(400, running)),
    seenLow: asInt(o.seenLow, 0, 400),
    seenMid: asInt(o.seenMid, 0, 400),
    seenHigh: asInt(o.seenHigh, 0, 400),
    seen,
  };
}

export function parseLive(raw: unknown): LiveRound | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!PHASES.includes(o.phase as Phase)) return null;
  if (!o.shoe || typeof o.shoe !== "object") return null;
  const shoeIn = o.shoe as Record<string, unknown>;
  if (!Array.isArray(shoeIn.cards) || shoeIn.cards.length > 312) return null;
  const cards: Card[] = [];
  for (const c of shoeIn.cards) {
    const parsed = parseCard(c);
    if (!parsed) return null;
    cards.push(parsed);
  }
  if (!Array.isArray(o.hands) || o.hands.length < 1 || o.hands.length > 4) return null;
  const hands: HandState[] = [];
  for (const h of o.hands) {
    const parsed = parseHand(h);
    if (!parsed) return null;
    hands.push(parsed);
  }
  const dealer = parseHand(o.dealer);
  if (!dealer || dealer.cards.length < 1) return null;
  if (hands.some((h) => h.cards.length < 2)) return null;
  const activeHand = asInt(o.activeHand, 0, 3);
  if (activeHand >= hands.length) return null;
  return {
    phase: o.phase as Phase,
    activeHand,
    insuranceBet: asInt(o.insuranceBet, 0, TABLE_MAX),
    dealer,
    hands,
    shoe: {
      cards,
      cutIndex: asInt(shoeIn.cutIndex, 0, 312),
      nextId: asInt(shoeIn.nextId, 1, 1_000_000) || 1,
    },
    roundWagered: asInt(o.roundWagered, 0, TABLE_MAX * 8),
    roundReturned: asInt(o.roundReturned, 0, TABLE_MAX * 8),
    plus3Last: parsePlus3Last(o.plus3Last),
    count: parseCount(o.count),
  };
}

export function snapshotLive(
  phase: Phase,
  activeHand: number,
  insuranceBet: number,
  dealer: HandState,
  hands: HandState[],
  shoe: LiveShoe,
  roundWagered: number,
  roundReturned: number,
  plus3Last: Plus3Result | null,
  count: LiveCount,
): LiveRound | null {
  if (phase !== "PLAYER" && phase !== "INSURANCE") return null;
  return {
    phase,
    activeHand,
    insuranceBet: clampMoney(insuranceBet, TABLE_MAX),
    dealer: cloneHand(dealer),
    hands: hands.map(cloneHand),
    shoe: {
      cards: shoe.cards.map((c) => ({ ...c })),
      cutIndex: shoe.cutIndex,
      nextId: shoe.nextId,
    },
    roundWagered: clampMoney(roundWagered, TABLE_MAX * 8),
    roundReturned: clampMoney(roundReturned, TABLE_MAX * 8),
    plus3Last,
    count: {
      running: count.running,
      seenLow: count.seenLow,
      seenMid: count.seenMid,
      seenHigh: count.seenHigh,
      seen: count.seen.slice(0, 400),
    },
  };
}

export function emptyLiveHand(): HandState {
  return emptyHand();
}

/** Outcomes are never restored mid-hand; kept here for write-path allowlisting. */
export function liveOutcomes(_raw: unknown): Outcome[] {
  return sanitizeTape([]) as unknown as Outcome[];
}

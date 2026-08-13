import type { Card, Phase } from "./types";
import { rankValue } from "./types";

/** Hi-Lo: 2–6 = +1, 7–9 = 0, 10–A = −1. */
export function hiloValue(card: Card): number {
  const v = rankValue(card.rank);
  if (v >= 2 && v <= 6) return 1;
  if (v >= 10 || card.rank === "A") return -1;
  return 0;
}

export class HiLoCounter {
  running = 0;
  seenLow = 0;
  seenMid = 0;
  seenHigh = 0;

  see(card: Card): void {
    const v = hiloValue(card);
    this.running += v;
    if (v > 0) this.seenLow += 1;
    else if (v < 0) this.seenHigh += 1;
    else this.seenMid += 1;
  }

  reset(): void {
    this.running = 0;
    this.seenLow = 0;
    this.seenMid = 0;
    this.seenHigh = 0;
  }

  trueCount(remaining: number): number {
    const decks = Math.max(remaining / 52, 0.25);
    return this.running / decks;
  }
}

export interface ShoeMix {
  low: { left: number; total: number };
  mid: { left: number; total: number };
  high: { left: number; total: number };
}

/** 2–6 / 7–9 / 10–A still in the shoe, from what the player has seen. */
export function shoeMix(decks: number, counter: HiLoCounter): ShoeMix {
  const d = Math.max(1, decks);
  const low = d * 5 * 4;
  const mid = d * 3 * 4;
  const high = d * 5 * 4;
  return {
    low: { left: Math.max(0, low - counter.seenLow), total: low },
    mid: { left: Math.max(0, mid - counter.seenMid), total: mid },
    high: { left: Math.max(0, high - counter.seenHigh), total: high },
  };
}

/**
 * Count every card the player can see. Idempotent via `seen` (card ids).
 * The hole stays out of the running count while it is face-down.
 */
export function syncVisibleCount(
  counter: HiLoCounter,
  seen: Set<number>,
  snap: {
    phase: Phase;
    hands: { cards: Card[] }[];
    dealer: { cards: Card[] };
  },
): void {
  const hideHole = snap.phase === "PLAYER" || snap.phase === "INSURANCE";
  const note = (card: Card | undefined) => {
    if (!card || seen.has(card.id)) return;
    seen.add(card.id);
    counter.see(card);
  };
  for (const hand of snap.hands) {
    for (const card of hand.cards) note(card);
  }
  if (hideHole) {
    note(snap.dealer.cards[0]);
    return;
  }
  for (const card of snap.dealer.cards) note(card);
}

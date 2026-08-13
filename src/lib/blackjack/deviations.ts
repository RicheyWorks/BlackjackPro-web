import type { Card, HandState } from "./types";
import { rankValue } from "./types";
import { handValue, isPair, isSoft } from "./hand";
import { basicAdvice, type Advice, type AdviceOptions } from "./strategy";
import { TABLE_MAX, TABLE_MIN } from "./money";

/** Same ramp as RicheyWorks HiLoCounter.chooseBet — $5 units. */
export const COUNT_UNIT = 5;

export function chooseCountBet(trueCount: number, cash: number, pending = 0): number {
  const tray = cash + pending;
  if (tray < TABLE_MIN) return 0;
  let units = 1;
  if (trueCount >= 4) units = 8;
  else if (trueCount >= 3) units = 4;
  else if (trueCount >= 2) units = 2;
  return Math.min(tray, TABLE_MAX, Math.max(TABLE_MIN, units * COUNT_UNIT));
}

export function takeInsuranceAt(trueCount: number): boolean {
  return Math.floor(trueCount) >= 3;
}

export interface Coach {
  action: Advice;
  deviate: boolean;
  note: string | null;
}

function upcard(dealer: Card): number {
  if (dealer.rank === "A") return 11;
  return Math.min(10, rankValue(dealer.rank));
}

function legal(action: Advice, opts: AdviceOptions): boolean {
  if (action === "SPLIT") return opts.allowSplit ?? true;
  if (action === "DOUBLE") return opts.allowDouble ?? true;
  if (action === "SURRENDER") return opts.allowSurrender ?? true;
  return true;
}

/**
 * Illustrious 18 + Fab 4 (late surrender extras). Returns a deviation
 * only when the floored true count crosses the published index.
 */
export function illustrious18(
  hand: HandState,
  dealerUp: Card,
  tcFloor: number,
  opts: AdviceOptions = {},
): Advice | null {
  const cards = hand.cards;
  if (cards.length < 2) return null;
  const up = upcard(dealerUp);
  const total = handValue(cards);
  const two = cards.length === 2;
  const pairTens =
    two && isPair(cards) && rankValue(cards[0]!.rank) === 10 && !isSoft(cards);
  const allowS = opts.allowSurrender ?? true;
  const allowD = opts.allowDouble ?? true;
  const allowP = opts.allowSplit ?? true;

  if (allowS && two && !hand.fromSplit) {
    if (total === 14 && up === 10 && tcFloor >= 3) return "SURRENDER";
    if (total === 15 && up === 9 && tcFloor >= 2) return "SURRENDER";
    if (total === 15 && up === 11 && !(opts.h17 ?? false) && tcFloor >= 1) {
      return "SURRENDER";
    }
  }

  if (pairTens && allowP) {
    if (up === 5 && tcFloor >= 5) return "SPLIT";
    if (up === 6 && tcFloor >= 4) return "SPLIT";
  }

  if (two && allowD && !isSoft(cards) && !isPair(cards)) {
    if (total === 10 && up === 10 && tcFloor >= 4) return "DOUBLE";
    if (total === 10 && up === 11 && tcFloor >= 4) return "DOUBLE";
    if (total === 9 && up === 2 && tcFloor >= 1) return "DOUBLE";
    if (total === 9 && up === 7 && tcFloor >= 3) return "DOUBLE";
  }

  if (!isSoft(cards) && !pairTens) {
    if (total === 16 && up === 10 && tcFloor >= 0 && !(allowS && two)) return "STAND";
    if (total === 15 && up === 10 && tcFloor >= 4 && !(allowS && two)) return "STAND";
    if (total === 16 && up === 9 && tcFloor >= 5 && !(allowS && two)) return "STAND";
    if (total === 12 && up === 3 && tcFloor >= 2) return "STAND";
    if (total === 12 && up === 2 && tcFloor >= 3) return "STAND";
    if (total === 13 && up === 2 && tcFloor <= -2) return "HIT";
    if (total === 12 && up === 4 && tcFloor <= -1) return "HIT";
    if (total === 12 && up === 5 && tcFloor <= -3) return "HIT";
    if (total === 12 && up === 6 && tcFloor <= -2) return "HIT";
    if (total === 13 && up === 3 && tcFloor <= -3) return "HIT";
  }

  return null;
}

export function coachAdvice(
  hand: HandState,
  dealerUp: Card,
  trueCount: number,
  opts: AdviceOptions = {},
): Coach {
  const basic = basicAdvice(hand, dealerUp, opts);
  const floor = Math.floor(trueCount);
  const raw = illustrious18(hand, dealerUp, floor, opts);
  if (raw && legal(raw, opts) && raw !== basic) {
    return {
      action: raw,
      deviate: true,
      note: `TC ${floor >= 0 ? "+" : ""}${floor}`,
    };
  }
  return { action: basic, deviate: false, note: null };
}

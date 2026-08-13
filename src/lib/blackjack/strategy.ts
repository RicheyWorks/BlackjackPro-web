import type { Card, HandState } from "./types";
import { handValue, isPair, isSoft } from "./hand";

export type Advice = "HIT" | "STAND" | "DOUBLE" | "SPLIT" | "SURRENDER";

export interface AdviceOptions {
  /** Dealer hits soft 17 — a few cells differ from the S17 chart. */
  h17?: boolean;
  allowSplit?: boolean;
  allowDouble?: boolean;
  allowSurrender?: boolean;
}

function upcard(dealer: Card): number {
  if (dealer.rank === "A") return 11;
  return Math.min(10, handValue([dealer]));
}

/**
 * Multi-deck, DAS, late surrender. Defaults to S17 (the table's house).
 * Illegal actions are never returned when the matching allow* flag is false,
 * so the hint always names something the player can actually do.
 */
export function basicAdvice(
  hand: HandState,
  dealerUp: Card,
  opts: AdviceOptions = {},
): Advice {
  const cards = hand.cards;
  const up = upcard(dealerUp);
  const total = handValue(cards);
  const pair = (opts.allowSplit ?? true) && isPair(cards) && cards.length === 2;
  const soft = isSoft(cards) && cards.length >= 2;
  const two = cards.length === 2;
  const allowDouble = opts.allowDouble ?? true;
  const allowSurrender = opts.allowSurrender ?? true;
  const h17 = opts.h17 ?? false;

  if (pair && cards[0]) {
    const r = cards[0].rank;
    if (r === "A" || r === "8") return "SPLIT";
    if (r === "10" || r === "J" || r === "Q" || r === "K") return "STAND";
    if (r === "9") return up === 7 || up >= 10 ? "STAND" : "SPLIT";
    if (r === "7") return up <= 7 ? "SPLIT" : "HIT";
    if (r === "6") return up <= 6 ? "SPLIT" : "HIT";
    if (r === "5") return up <= 9 && two && allowDouble ? "DOUBLE" : "HIT";
    if (r === "4") return up === 5 || up === 6 ? "SPLIT" : "HIT";
    if (r === "3" || r === "2") return up <= 7 ? "SPLIT" : "HIT";
  }

  if (soft) {
    if (total >= 20) return "STAND";
    // S17: always stand on A,8. H17: double vs 6 only.
    if (total === 19) {
      return h17 && up === 6 && two && allowDouble ? "DOUBLE" : "STAND";
    }
    if (total === 18) {
      if (up >= 9) return "HIT";
      if (two && allowDouble && ((up >= 3 && up <= 6) || (h17 && up === 2))) {
        return "DOUBLE";
      }
      return "STAND";
    }
    if (total === 17) return up >= 3 && up <= 6 && two && allowDouble ? "DOUBLE" : "HIT";
    if (total === 16 || total === 15) {
      return up >= 4 && up <= 6 && two && allowDouble ? "DOUBLE" : "HIT";
    }
    if (total === 14 || total === 13) {
      return up >= 5 && up <= 6 && two && allowDouble ? "DOUBLE" : "HIT";
    }
    return "HIT";
  }

  if (allowSurrender && two && total === 16 && up >= 9) return "SURRENDER";
  if (allowSurrender && two && total === 15 && (up === 10 || (h17 && up === 11))) {
    return "SURRENDER";
  }
  if (allowSurrender && h17 && two && total === 17 && up === 11) return "SURRENDER";

  if (total >= 17) return "STAND";
  if (total === 16) return up <= 6 ? "STAND" : "HIT";
  if (total === 15) return up <= 6 ? "STAND" : "HIT";
  if (total === 14 || total === 13) return up <= 6 ? "STAND" : "HIT";
  if (total === 12) return up >= 4 && up <= 6 ? "STAND" : "HIT";
  if (total === 11) return two && allowDouble ? "DOUBLE" : "HIT";
  if (total === 10) return two && allowDouble && up <= 9 ? "DOUBLE" : "HIT";
  if (total === 9) return two && allowDouble && up >= 3 && up <= 6 ? "DOUBLE" : "HIT";
  return "HIT";
}

export function adviceLabel(a: Advice): string {
  switch (a) {
    case "HIT":
      return "Hit";
    case "STAND":
      return "Stand";
    case "DOUBLE":
      return "Double";
    case "SPLIT":
      return "Split";
    case "SURRENDER":
      return "Surrender";
  }
}

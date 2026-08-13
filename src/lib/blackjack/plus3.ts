import type { Card, Rank } from "./types";

/** Same pay table as RicheyWorks/BlackJackPro TwentyOnePlusThree. */
export type Plus3Kind =
  | "SUITED_TRIPS"
  | "STRAIGHT_FLUSH"
  | "TRIPS"
  | "STRAIGHT"
  | "FLUSH";

export interface Plus3Result {
  stake: number;
  returned: number;
  kind: Plus3Kind | null;
  label: string;
}

export const PLUS3_PAY: Record<Plus3Kind, number> = {
  SUITED_TRIPS: 100,
  STRAIGHT_FLUSH: 40,
  TRIPS: 30,
  STRAIGHT: 10,
  FLUSH: 5,
};

export const PLUS3_LABEL: Record<Plus3Kind, string> = {
  SUITED_TRIPS: "Suited trips",
  STRAIGHT_FLUSH: "Straight flush",
  TRIPS: "Three of a kind",
  STRAIGHT: "Straight",
  FLUSH: "Flush",
};

const RANK_INDEX: Record<Rank, number> = {
  "2": 0,
  "3": 1,
  "4": 2,
  "5": 3,
  "6": 4,
  "7": 5,
  "8": 6,
  "9": 7,
  "10": 8,
  J: 9,
  Q: 10,
  K: 11,
  A: 12,
};

export function evaluatePlus3(a: Card, b: Card, up: Card): Plus3Kind | null {
  const suited = a.suit === b.suit && b.suit === up.suit;
  const trips = a.rank === b.rank && b.rank === up.rank;
  const straight = isStraight(a, b, up);
  if (trips && suited) return "SUITED_TRIPS";
  if (straight && suited) return "STRAIGHT_FLUSH";
  if (trips) return "TRIPS";
  if (straight) return "STRAIGHT";
  if (suited) return "FLUSH";
  return null;
}

function isStraight(a: Card, b: Card, c: Card): boolean {
  const r = [RANK_INDEX[a.rank], RANK_INDEX[b.rank], RANK_INDEX[c.rank]].sort((x, y) => x - y);
  return (r[2]! - r[1]! === 1 && r[1]! - r[0]! === 1) || (r[0] === 0 && r[1] === 1 && r[2] === 12);
}

/** Total returned to the player (0 = lost). Includes the stake on a win. */
export function plus3Payout(kind: Plus3Kind | null, bet: number): number {
  if (!kind || !Number.isSafeInteger(bet) || bet <= 0) return 0;
  return bet + bet * PLUS3_PAY[kind];
}

export function settlePlus3(player: Card[], dealerUp: Card | undefined, bet: number): Plus3Result {
  if (bet <= 0 || !dealerUp || player.length < 2) {
    return { stake: bet, returned: 0, kind: null, label: "no eval" };
  }
  const kind = evaluatePlus3(player[0]!, player[1]!, dealerUp);
  const returned = plus3Payout(kind, bet);
  return {
    stake: bet,
    returned,
    kind,
    label: kind ? PLUS3_LABEL[kind] : "no win",
  };
}

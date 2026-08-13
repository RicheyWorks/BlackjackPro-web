import type { Card, HandState, Rank } from "./types";
import { rankValue } from "./types";

export function emptyHand(): HandState {
  return {
    cards: [],
    bet: 0,
    doubled: false,
    surrendered: false,
    fromSplit: false,
    splitAce: false,
    stood: false,
  };
}

export function cloneHand(h: HandState): HandState {
  return { ...h, cards: [...h.cards] };
}

export function handValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += rankValue(c.rank);
    if (c.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function isSoft(cards: Card[]): boolean {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += rankValue(c.rank);
    if (c.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return aces > 0;
}

export function isBust(cards: Card[]): boolean {
  return handValue(cards) > 21;
}

export function isPair(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  return cards[0]!.rank === cards[1]!.rank;
}

export function isBlackjack(hand: HandState): boolean {
  return hand.cards.length === 2 && handValue(hand.cards) === 21 && !hand.fromSplit;
}

export function handLabel(cards: Card[]): string {
  if (cards.length === 0) return "";
  const v = handValue(cards);
  if (v > 21) return "Bust";
  if (isSoft(cards) && v < 21) return `Soft ${v}`;
  return String(v);
}

export function isTen(rank: Rank): boolean {
  return rankValue(rank) === 10;
}

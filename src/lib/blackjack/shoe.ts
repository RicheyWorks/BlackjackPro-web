import type { Card, Rank, Suit } from "./types";
import { RANKS, SUITS } from "./types";

export const MIN_CARDS_FOR_ROUND = 40;

function fisherYates(cards: Card[]): void {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = cards[i];
    cards[i] = cards[j]!;
    cards[j] = tmp!;
  }
}

export class Shoe {
  readonly decks: number;
  readonly penetration: number;
  private cards: Card[] = [];
  private cutIndex = 0;
  private nextId = 1;

  constructor(decks = 6, penetration = 0.75) {
    if (decks < 1) throw new Error("decks must be >= 1");
    if (penetration <= 0 || penetration > 1) {
      throw new Error("penetration must be in (0,1]");
    }
    this.decks = decks;
    this.penetration = penetration;
    this.reshuffle();
  }

  reshuffle(): void {
    this.cards = [];
    for (let d = 0; d < this.decks; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          this.cards.push({ id: this.nextId++, rank: rank as Rank, suit: suit as Suit });
        }
      }
    }
    fisherYates(this.cards);
    this.cutIndex = Math.floor(this.cards.length * (1 - this.penetration));
  }

  needsShuffle(): boolean {
    return this.cards.length <= Math.max(this.cutIndex, MIN_CARDS_FOR_ROUND);
  }

  deal(): Card {
    if (this.cards.length === 0) this.reshuffle();
    return this.cards.pop()!;
  }

  remaining(): number {
    return this.cards.length;
  }

  dealt(): number {
    return this.decks * 52 - this.cards.length;
  }
}

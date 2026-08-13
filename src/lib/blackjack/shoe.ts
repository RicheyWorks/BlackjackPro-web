import type { Card, Rank, Suit } from "./types";
import { RANKS, SUITS } from "./types";
import type { LiveShoe } from "./live";
import { parseCard } from "./live";

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
  private midRoundShuffle = false;

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
    if (this.cards.length === 0) {
      this.reshuffle();
      this.midRoundShuffle = true;
    }
    return this.cards.pop()!;
  }

  /** True once if the shoe emptied mid-round and was rebuilt. */
  consumeMidRoundShuffle(): boolean {
    const hit = this.midRoundShuffle;
    this.midRoundShuffle = false;
    return hit;
  }

  remaining(): number {
    return this.cards.length;
  }

  dealt(): number {
    return this.decks * 52 - this.cards.length;
  }

  snapshot(): LiveShoe {
    return {
      cards: this.cards.map((c) => ({ ...c })),
      cutIndex: this.cutIndex,
      nextId: this.nextId,
    };
  }

  load(data: LiveShoe): boolean {
    if (data.cards.length < 1 || data.cards.length > this.decks * 52) return false;
    const cards: Card[] = [];
    const ids = new Set<number>();
    for (const raw of data.cards) {
      const c = parseCard(raw);
      if (!c || ids.has(c.id)) return false;
      ids.add(c.id);
      cards.push(c);
    }
    this.cards = cards;
    this.cutIndex = Math.max(0, Math.min(data.cutIndex, this.decks * 52));
    this.nextId = Math.max(1, data.nextId);
    this.midRoundShuffle = false;
    return true;
  }
}

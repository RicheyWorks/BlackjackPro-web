import { createHash, createHmac, randomBytes } from "node:crypto";
import type { Card, Rank, Suit } from "@/lib/blackjack/types";
import { RANKS, SUITS } from "@/lib/blackjack/types";
import type { LiveShoe } from "@/lib/blackjack/live";

export function newSeed(): string {
  return randomBytes(32).toString("hex");
}

export function commitSeed(seed: string): string {
  return createHash("sha256").update(Buffer.from(seed, "hex")).digest("hex");
}

function hmacU32(seed: string, label: string): number {
  return createHmac("sha256", Buffer.from(seed, "hex")).update(label).digest().readUInt32BE(0);
}

/** Unbiased index in [0, modulo). */
export function hmacIndex(seed: string, draw: number, modulo: number): number {
  if (modulo <= 1) return 0;
  const max = 0x1_0000_0000;
  const limit = max - (max % modulo);
  for (let extra = 0; extra < 32; extra++) {
    const n = hmacU32(seed, `${draw}:${extra}`);
    if (n < limit) return n % modulo;
  }
  return hmacU32(seed, `${draw}:f`) % modulo;
}

export function buildShuffledShoe(decks: number, seed: string, penetration: number): LiveShoe {
  const cards: Card[] = [];
  let nextId = 1;
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: nextId++, rank: rank as Rank, suit: suit as Suit });
      }
    }
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = hmacIndex(seed, i, i + 1);
    const tmp = cards[i]!;
    cards[i] = cards[j]!;
    cards[j] = tmp;
  }
  return {
    cards,
    nextId,
    cutIndex: Math.floor(cards.length * (1 - penetration)),
  };
}

export function newHandId(): string {
  return randomBytes(16).toString("hex");
}

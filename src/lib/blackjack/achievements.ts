import type { EngineSnapshot, Outcome } from "./types";
import { handValue } from "./hand";
import type { Plus3Kind } from "./plus3";

export interface Achievement {
  id: string;
  title: string;
  detail: string;
}

export const CATALOG: Achievement[] = [
  { id: "first-win", title: "On the board", detail: "Win a hand" },
  { id: "natural", title: "Natural", detail: "Be paid 3:2 on a blackjack" },
  { id: "double-win", title: "Twice as sure", detail: "Win a doubled hand" },
  { id: "split-win", title: "Both sides", detail: "Split and win at least one" },
  { id: "insured", title: "Covered", detail: "Collect on insurance" },
  { id: "five-card", title: "Long count", detail: "Reach 21 on five or more cards" },
  { id: "plus3", title: "Three-card", detail: "Win a 21+3" },
  { id: "plus3-trips", title: "Painted trips", detail: "Hit suited trips on 21+3" },
  { id: "peak-2x", title: "Doubled bank", detail: "Reach twice the opening bankroll" },
  { id: "hands-25", title: "Regular", detail: "Play 25 hands" },
  { id: "hands-100", title: "Fixture", detail: "Play 100 hands" },
  { id: "push", title: "Even felt", detail: "Push a hand" },
];

export function unlocks(
  prev: Set<string>,
  snap: EngineSnapshot,
  extras: {
    insurancePaid: boolean;
    openedAt: number;
    plus3Win?: boolean;
    plus3Kind?: Plus3Kind | null;
  },
): Achievement[] {
  const found: Achievement[] = [];
  const has = (id: string) => prev.has(id);
  const add = (id: string) => {
    if (!has(id)) {
      const a = CATALOG.find((x) => x.id === id);
      if (a) found.push(a);
    }
  };

  const outcomes = snap.lastOutcomes;
  if (outcomes.some((o) => o === "WIN" || o === "BLACKJACK")) add("first-win");
  if (outcomes.includes("BLACKJACK")) add("natural");
  if (outcomes.includes("PUSH")) add("push");
  if (extras.insurancePaid) add("insured");
  if (extras.plus3Win) add("plus3");
  if (extras.plus3Kind === "SUITED_TRIPS") add("plus3-trips");
  if (snap.stats.hands >= 25) add("hands-25");
  if (snap.stats.hands >= 100) add("hands-100");
  if (snap.bankroll >= extras.openedAt * 2 && extras.openedAt > 0) add("peak-2x");

  snap.hands.forEach((h, i) => {
    const o: Outcome | undefined = outcomes[i];
    if (h.doubled && (o === "WIN" || o === "BLACKJACK")) add("double-win");
    if (h.fromSplit && (o === "WIN" || o === "BLACKJACK")) add("split-win");
    if (h.cards.length >= 5 && handValue(h.cards) === 21) add("five-card");
  });

  return found;
}

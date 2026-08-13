import type { Outcome } from "./types";

export type TapeMark = "BJ" | "W" | "L" | "P" | "S" | "X";

export const TAPE_MAX = 24;

const MARKS = new Set<TapeMark>(["BJ", "W", "L", "P", "S", "X"]);

export function markFromOutcome(o: Outcome): TapeMark {
  switch (o) {
    case "BLACKJACK":
      return "BJ";
    case "WIN":
      return "W";
    case "LOSS":
      return "L";
    case "PUSH":
      return "P";
    case "SURRENDER":
      return "S";
    case "BUST":
      return "X";
  }
}

export function appendTape(prev: TapeMark[], next: Outcome[]): TapeMark[] {
  return [...prev, ...next.map(markFromOutcome)].slice(-TAPE_MAX);
}

export function sanitizeTape(raw: unknown): TapeMark[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is TapeMark => typeof x === "string" && MARKS.has(x as TapeMark)).slice(-TAPE_MAX);
}

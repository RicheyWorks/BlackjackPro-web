import { parseHand } from "@/lib/blackjack/live";
import type { HandState } from "@/lib/blackjack/types";
import { redactDealer } from "./redact";

export function parseHandsJson(raw: string): HandState[] {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const out: HandState[] = [];
    for (const item of v) {
      const h = parseHand(item);
      if (!h) return [];
      out.push(h);
    }
    return out;
  } catch {
    return [];
  }
}

export function parseDealerJson(raw: string, status: string): HandState | null {
  try {
    const h = parseHand(JSON.parse(raw) as unknown);
    if (!h) return null;
    if (status !== "settled") return redactDealer(h, "PLAYER");
    return h;
  } catch {
    return null;
  }
}

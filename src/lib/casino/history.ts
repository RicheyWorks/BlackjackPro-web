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

const KNOWN_ACTIONS = new Set([
  "seat",
  "addChip",
  "clearBet",
  "rebet",
  "rebetDeal",
  "countBet",
  "deal",
  "hit",
  "stand",
  "double",
  "split",
  "surrender",
  "insure",
  "newSession",
]);

export function sanitizeAction(raw: string): string | null {
  return KNOWN_ACTIONS.has(raw) ? raw : null;
}

export function groupActions(
  rows: { hand_id: string | null; action: string }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.hand_id) continue;
    const action = sanitizeAction(row.action);
    if (!action) continue;
    const list = map.get(row.hand_id) ?? [];
    list.push(action);
    map.set(row.hand_id, list);
  }
  return map;
}

export function handProof(hand: {
  id: string;
  rulesPack: string;
  rulesHash: string;
  seedCommit: string;
  seedReveal: string | null;
  outcomes: string;
  wagered: number;
  returned: number;
  net: number;
}): string {
  return [
    `Blackjack Pro play-chip hand ${hand.id}`,
    `rules ${hand.rulesPack}`,
    `hash ${hand.rulesHash}`,
    `commit ${hand.seedCommit}`,
    hand.seedReveal ? `reveal ${hand.seedReveal}` : "reveal pending (shoe still live)",
    `outcomes ${hand.outcomes || "—"}`,
    `wagered ${hand.wagered} returned ${hand.returned} net ${hand.net}`,
  ].join("\n");
}

export function ledgerExport(input: {
  rulesPack: string | null;
  rulesHash: string | null;
  pit: { hands: number; wagered: number; returned: number; net: number; rtp: number | null; voids: number } | null;
  hands: Array<{
    id: string;
    startedAt: string;
    settledAt: string | null;
    status: string;
    outcomes: string;
    mainBet: number;
    plus3Bet: number;
    insuranceBet: number;
    wagered: number;
    returned: number;
    net: number;
    seedCommit: string;
    seedReveal: string | null;
    seedOk: boolean | null;
    rulesPack: string;
    rulesHash: string;
    actions: string[];
  }>;
  wallet: Array<{ amount: number; balanceAfter: number; kind: string; at: string }>;
}): string {
  return `${JSON.stringify(
    {
      product: "Blackjack Pro",
      playChips: true,
      licensed: false,
      exportedAt: new Date().toISOString(),
      rulesPack: input.rulesPack,
      rulesHash: input.rulesHash,
      pit: input.pit,
      hands: input.hands,
      wallet: input.wallet,
    },
    null,
    2,
  )}\n`;
}

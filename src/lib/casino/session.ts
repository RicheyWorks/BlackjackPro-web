import { Engine } from "@/lib/blackjack/engine";
import { createRules } from "@/lib/blackjack/rules";
import { HiLoCounter } from "@/lib/blackjack/hilo";
import { parseLive, type LiveRound, type LiveShoe } from "@/lib/blackjack/live";
import { asInt, clampMoney, TABLE_MAX } from "@/lib/blackjack/money";
import type { Plus3Result } from "@/lib/blackjack/plus3";
import { PLUS3_LABEL, type Plus3Kind } from "@/lib/blackjack/plus3";
import type { TapeMark } from "@/lib/blackjack/tape";
import { sanitizeTape } from "@/lib/blackjack/tape";
import type { SessionStats } from "@/lib/blackjack/types";
import { EMPTY_STATS } from "@/lib/blackjack/types";

const PLUS3_KINDS: Plus3Kind[] = [
  "SUITED_TRIPS",
  "STRAIGHT_FLUSH",
  "TRIPS",
  "STRAIGHT",
  "FLUSH",
];

export interface PitSession {
  engine: Engine;
  plus3Pending: number;
  plus3Last: Plus3Result | null;
  lastMainBet: number;
  lastPlus3Bet: number;
  plus3: { wagered: number; returned: number; wins: number };
  tape: TapeMark[];
  seed: string;
  seedCommit: string;
  prevSeedReveal: string | null;
  handId: string | null;
  counter: HiLoCounter;
  seen: Set<number>;
  version: number;
  sessionAnchor: number;
  sessionStartedAt: number;
  lastRealityAckAt: number;
}

export interface PitBlob {
  pendingBet: number;
  plus3Pending: number;
  plus3Last: Plus3Result | null;
  lastMainBet: number;
  lastPlus3Bet: number;
  plus3: { wagered: number; returned: number; wins: number };
  tape: TapeMark[];
  seed: string;
  seedCommit: string;
  prevSeedReveal: string | null;
  handId: string | null;
  live: LiveRound | null;
  shoe: LiveShoe;
  stats: SessionStats;
  soft17: boolean;
  running: number;
  seenLow: number;
  seenMid: number;
  seenHigh: number;
  seen: number[];
  sessionAnchor: number;
  sessionStartedAt: number;
  lastRealityAckAt: number;
}

function parsePlus3Last(raw: unknown): Plus3Result | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = PLUS3_KINDS.includes(o.kind as Plus3Kind) ? (o.kind as Plus3Kind) : null;
  return {
    stake: asInt(o.stake, 0, TABLE_MAX),
    returned: asInt(o.returned, 0, TABLE_MAX * 101),
    kind,
    label: kind ? PLUS3_LABEL[kind] : "no win",
  };
}

export function dumpSession(s: PitSession): PitBlob {
  const live = s.engine.captureLive(s.plus3Last, {
    running: s.counter.running,
    seenLow: s.counter.seenLow,
    seenMid: s.counter.seenMid,
    seenHigh: s.counter.seenHigh,
    seen: [...s.seen],
  });
  return {
    pendingBet: s.engine.pendingBet,
    plus3Pending: s.plus3Pending,
    plus3Last: s.plus3Last,
    lastMainBet: s.lastMainBet,
    lastPlus3Bet: s.lastPlus3Bet,
    plus3: { ...s.plus3 },
    tape: s.tape,
    seed: s.seed,
    seedCommit: s.seedCommit,
    prevSeedReveal: s.prevSeedReveal,
    handId: s.handId,
    live,
    shoe: s.engine.shoe.snapshot(),
    stats: { ...s.engine.stats },
    soft17: s.engine.rules.dealerHitsSoft17,
    running: s.counter.running,
    seenLow: s.counter.seenLow,
    seenMid: s.counter.seenMid,
    seenHigh: s.counter.seenHigh,
    seen: [...s.seen],
    sessionAnchor: s.sessionAnchor,
    sessionStartedAt: s.sessionStartedAt,
    lastRealityAckAt: s.lastRealityAckAt,
  };
}

export function parseBlob(raw: string, bankroll: number, version: number): PitSession | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o.seed !== "string" || !/^[0-9a-f]{64}$/.test(o.seed)) return null;
    if (typeof o.seedCommit !== "string" || !/^[0-9a-f]{64}$/.test(o.seedCommit)) return null;
    const soft17 = o.soft17 === true;
    const engine = new Engine(clampMoney(bankroll), createRules({ dealerHitsSoft17: soft17 }));
    engine.stats = { ...EMPTY_STATS, ...(typeof o.stats === "object" && o.stats ? o.stats : {}) };
    const shoe = o.shoe as LiveShoe | undefined;
    if (!shoe || !engine.shoe.load(shoe)) return null;
    const live = parseLive(o.live);
    if (live) {
      if (!engine.restoreLive(live)) return null;
    } else {
      const pending = asInt(o.pendingBet, 0, TABLE_MAX);
      engine.pendingBet = pending;
    }
    const counter = new HiLoCounter();
    counter.running = typeof o.running === "number" ? o.running : 0;
    counter.seenLow = asInt(o.seenLow, 0, 400);
    counter.seenMid = asInt(o.seenMid, 0, 400);
    counter.seenHigh = asInt(o.seenHigh, 0, 400);
    const seen = new Set<number>();
    if (Array.isArray(o.seen)) {
      for (const id of o.seen) if (Number.isSafeInteger(id)) seen.add(id as number);
    }
    return {
      engine,
      plus3Pending: asInt(o.plus3Pending, 0, TABLE_MAX),
      plus3Last: parsePlus3Last(o.plus3Last),
      lastMainBet: asInt(o.lastMainBet, 0, TABLE_MAX),
      lastPlus3Bet: asInt(o.lastPlus3Bet, 0, TABLE_MAX),
      plus3: {
        wagered: asInt((o.plus3 as { wagered?: number } | undefined)?.wagered, 0),
        returned: asInt((o.plus3 as { returned?: number } | undefined)?.returned, 0),
        wins: asInt((o.plus3 as { wins?: number } | undefined)?.wins, 0),
      },
      tape: sanitizeTape(o.tape),
      seed: o.seed,
      seedCommit: o.seedCommit,
      prevSeedReveal: typeof o.prevSeedReveal === "string" ? o.prevSeedReveal : null,
      handId: typeof o.handId === "string" ? o.handId : null,
      counter,
      seen,
      version,
      sessionAnchor: asInt(o.sessionAnchor, bankroll),
      sessionStartedAt: typeof o.sessionStartedAt === "number" ? o.sessionStartedAt : Date.now(),
      lastRealityAckAt: typeof o.lastRealityAckAt === "number" ? o.lastRealityAckAt : 0,
    };
  } catch {
    return null;
  }
}

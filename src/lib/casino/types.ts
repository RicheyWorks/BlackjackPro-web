import type { EngineSnapshot, Outcome, Phase, SessionStats } from "@/lib/blackjack/types";
import type { Plus3Result } from "@/lib/blackjack/plus3";
import type { ShoeMix } from "@/lib/blackjack/hilo";
import type { TapeMark } from "@/lib/blackjack/tape";

export type PitOp =
  | { op: "seat"; ageAttest: true }
  | { op: "sync" }
  | { op: "addChip"; n: number; rail: "main" | "plus3" }
  | { op: "clearBet" }
  | { op: "rebet" }
  | { op: "rebetDeal" }
  | { op: "countBet" }
  | { op: "deal" }
  | { op: "hit" }
  | { op: "stand" }
  | { op: "double" }
  | { op: "split" }
  | { op: "surrender" }
  | { op: "insure"; yes: boolean }
  | { op: "setSoft17"; v: boolean }
  | { op: "refill" }
  | { op: "newSession" }
  | { op: "setLossLimit"; amount: number }
  | { op: "cooloff"; hours: number }
  | { op: "selfExclude"; days: number }
  | { op: "ackReality" };

export type LedgerKind =
  | "grant"
  | "wager"
  | "plus3_wager"
  | "insurance"
  | "payout"
  | "plus3_payout"
  | "refund"
  | "even_money"
  | "void";

export interface PitView {
  mode: "pit";
  licensed: false;
  playChips: true;
  phase: Phase;
  bankroll: number;
  pendingBet: number;
  insuranceBet: number;
  lastNet: number;
  lastOutcomes: Outcome[];
  dealer: EngineSnapshot["dealer"];
  hands: EngineSnapshot["hands"];
  activeIndex: number;
  stats: SessionStats;
  shoeRemaining: number;
  shoeDealt: number;
  shoeDecks: number;
  needsShuffle: boolean;
  canDeal: boolean;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
  canInsure: boolean;
  canEvenMoney: boolean;
  plus3Pending: number;
  plus3Last: Plus3Result | null;
  lastMainBet: number;
  lastPlus3Bet: number;
  canRebet: boolean;
  running: number;
  trueCount: number;
  countStake: number;
  mix: ShoeMix;
  tape: TapeMark[];
  seedCommit: string;
  seedReveal: string | null;
  handId: string | null;
  soft17: boolean;
  lossLimit: number;
  cooloffUntil: string | null;
  selfExcludedUntil: string | null;
  realityCheck: boolean;
  rulesPack: string;
  rulesHash: string;
  seated: true;
}

export interface HandRow {
  id: string;
  startedAt: string;
  settledAt: string | null;
  mainBet: number;
  plus3Bet: number;
  net: number;
  outcomes: string;
  seedCommit: string;
  seedReveal: string | null;
  rulesHash: string;
  rulesPack: string;
  status: string;
}

export interface PitStats {
  hands: number;
  wagered: number;
  returned: number;
  net: number;
  rtp: number | null;
  voids: number;
  lastHourHands: number;
  rulesPack: string;
  rulesHash: string;
}

export const PLAY_GRANT = 1000;
export const REALITY_MS = 45 * 60 * 1000;

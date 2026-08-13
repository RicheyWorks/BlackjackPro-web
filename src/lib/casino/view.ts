import { shoeMix } from "@/lib/blackjack/hilo";
import { chooseCountBet } from "@/lib/blackjack/deviations";
import { TABLE_MAX } from "@/lib/blackjack/money";
import type { EngineSnapshot } from "@/lib/blackjack/types";
import { redactDealer } from "./redact";
import { type PitView } from "./types";
import { rebetAffordable } from "./apply";
import type { PitSession } from "./session";
import { needsRealityAck } from "./reality";
import { rulesFingerprint } from "@/lib/blackjack/rules";

export function toView(
  s: PitSession,
  extra: {
    lossLimit: number;
    cooloffUntil: string | null;
    selfExcludedUntil: string | null;
    rulesHash: string;
    lastSeedCommit: string | null;
    seedOk: boolean;
  },
): PitView {
  const snap = s.engine.snapshot();
  const tc = s.counter.trueCount(snap.shoeRemaining);
  const realityCheck = needsRealityAck(s.sessionStartedAt, s.lastRealityAckAt);
  const pack = rulesFingerprint(s.engine.rules);
  return {
    mode: "pit",
    licensed: false,
    playChips: true,
    phase: snap.phase,
    bankroll: snap.bankroll,
    pendingBet: snap.pendingBet,
    insuranceBet: snap.insuranceBet,
    lastNet: snap.lastNet,
    lastOutcomes: snap.lastOutcomes,
    dealer: redactDealer(snap.dealer, snap.phase),
    hands: snap.hands,
    activeIndex: snap.activeIndex,
    stats: snap.stats,
    shoeRemaining: snap.shoeRemaining,
    shoeDealt: snap.shoeDealt,
    shoeDecks: snap.shoeDecks,
    needsShuffle: snap.needsShuffle,
    canDeal: snap.canDeal && !realityCheck,
    canHit: snap.canHit,
    canStand: snap.canStand,
    canDouble: snap.canDouble,
    canSplit: snap.canSplit,
    canSurrender: snap.canSurrender,
    canInsure: snap.canInsure,
    canEvenMoney: snap.canEvenMoney,
    plus3Pending: s.plus3Pending,
    plus3Last: s.plus3Last,
    plus3Stats: { ...s.plus3 },
    lastMainBet: s.lastMainBet,
    lastPlus3Bet: s.lastPlus3Bet,
    canRebet: rebetAffordable(s) && !realityCheck,
    running: s.counter.running,
    trueCount: tc,
    countStake: chooseCountBet(tc, snap.bankroll, snap.pendingBet),
    mix: shoeMix(snap.shoeDecks, s.counter),
    tape: s.tape,
    seedCommit: s.seedCommit,
    seedReveal: s.prevSeedReveal,
    lastSeedCommit: extra.lastSeedCommit,
    seedOk: extra.seedOk,
    handId: s.handId,
    soft17: s.engine.rules.dealerHitsSoft17,
    lossLimit: extra.lossLimit,
    cooloffUntil: extra.cooloffUntil,
    selfExcludedUntil: extra.selfExcludedUntil,
    realityCheck,
    rulesPack: pack,
    rulesHash: extra.rulesHash,
    seated: true,
  };
}

export function viewToSnap(v: PitView): EngineSnapshot {
  return {
    phase: v.phase,
    bankroll: v.bankroll,
    pendingBet: v.pendingBet,
    insuranceBet: v.insuranceBet,
    lastNet: v.lastNet,
    lastOutcomes: v.lastOutcomes,
    dealer: v.dealer,
    hands: v.hands,
    activeIndex: v.activeIndex,
    stats: v.stats,
    shoeRemaining: v.shoeRemaining,
    shoeDealt: v.shoeDealt,
    shoeDecks: v.shoeDecks,
    needsShuffle: v.needsShuffle,
    canBet: (n) =>
      v.phase === "BETTING" &&
      Number.isSafeInteger(n) &&
      n > 0 &&
      n <= v.bankroll &&
      v.pendingBet + n <= TABLE_MAX,
    canDeal: v.canDeal,
    canHit: v.canHit,
    canStand: v.canStand,
    canDouble: v.canDouble,
    canSplit: v.canSplit,
    canSurrender: v.canSurrender,
    canInsure: v.canInsure,
    canEvenMoney: v.canEvenMoney,
  };
}

import { shoeMix } from "@/lib/blackjack/hilo";
import { chooseCountBet } from "@/lib/blackjack/deviations";
import { TABLE_MAX } from "@/lib/blackjack/money";
import type { EngineSnapshot } from "@/lib/blackjack/types";
import { redactDealer } from "./redact";
import { REALITY_MS, type PitView } from "./types";
import { rebetAffordable } from "./apply";
import type { PitSession } from "./session";

export function toView(
  s: PitSession,
  extra: { lossLimit: number; cooloffUntil: string | null; selfExcludedUntil: string | null },
): PitView {
  const snap = s.engine.snapshot();
  const tc = s.counter.trueCount(snap.shoeRemaining);
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
    canDeal: snap.canDeal,
    canHit: snap.canHit,
    canStand: snap.canStand,
    canDouble: snap.canDouble,
    canSplit: snap.canSplit,
    canSurrender: snap.canSurrender,
    canInsure: snap.canInsure,
    canEvenMoney: snap.canEvenMoney,
    plus3Pending: s.plus3Pending,
    plus3Last: s.plus3Last,
    lastMainBet: s.lastMainBet,
    lastPlus3Bet: s.lastPlus3Bet,
    canRebet: rebetAffordable(s),
    running: s.counter.running,
    trueCount: tc,
    countStake: chooseCountBet(tc, snap.bankroll, snap.pendingBet),
    mix: shoeMix(snap.shoeDecks, s.counter),
    tape: s.tape,
    seedCommit: s.seedCommit,
    seedReveal: s.prevSeedReveal,
    handId: s.handId,
    soft17: s.engine.rules.dealerHitsSoft17,
    lossLimit: extra.lossLimit,
    cooloffUntil: extra.cooloffUntil,
    selfExcludedUntil: extra.selfExcludedUntil,
    realityCheck: Date.now() - s.sessionStartedAt >= REALITY_MS,
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

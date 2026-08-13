import type { Card, HandState, Phase } from "./types";
import { coachAdvice, takeInsuranceAt } from "./deviations";
import type { Advice } from "./strategy";
import { TABLE_MIN } from "./money";

export type AutoStep =
  | { kind: "wait" }
  | { kind: "stop" }
  | { kind: "countBet" }
  | { kind: "deal" }
  | { kind: "insure"; yes: boolean }
  | { kind: "act"; action: Advice };

export interface AutoView {
  phase: Phase;
  canDeal: boolean;
  canInsure: boolean;
  canEvenMoney: boolean;
  pendingBet: number;
  bankroll: number;
  countStake: number;
  trueCount: number;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
  hand?: HandState;
  up?: Card;
  soft17: boolean;
  locked?: boolean;
}

/** Next thing the coach should do. Never places 21+3. */
export function nextAutoStep(s: AutoView): AutoStep {
  if (s.locked) return { kind: "stop" };
  if (s.phase === "DEALING" || s.phase === "DEALER" || s.phase === "SETTLE") {
    return { kind: "wait" };
  }

  if (s.phase === "INSURANCE") {
    const yes = takeInsuranceAt(s.trueCount) && (s.canInsure || s.canEvenMoney);
    return { kind: "insure", yes };
  }

  if (s.phase === "BETTING") {
    if (s.countStake > s.pendingBet && s.bankroll >= s.countStake - s.pendingBet) {
      return { kind: "countBet" };
    }
    if (s.canDeal) return { kind: "deal" };
    if (s.pendingBet >= TABLE_MIN) return { kind: "stop" };
    if (s.bankroll + s.pendingBet < TABLE_MIN) return { kind: "stop" };
    if (s.bankroll <= 0 && s.pendingBet <= 0) return { kind: "stop" };
    return { kind: "wait" };
  }

  if (s.phase !== "PLAYER" || !s.hand || !s.up) return { kind: "wait" };

  const coach = coachAdvice(s.hand, s.up, s.trueCount, {
    h17: s.soft17,
    allowSplit: s.canSplit,
    allowDouble: s.canDouble,
    allowSurrender: s.canSurrender,
  });

  const action = coach.action;
  if (action === "SURRENDER" && s.canSurrender) return { kind: "act", action };
  if (action === "SPLIT" && s.canSplit) return { kind: "act", action };
  if (action === "DOUBLE" && s.canDouble) return { kind: "act", action };
  if (action === "HIT" && s.canHit) return { kind: "act", action };
  if (s.canStand) return { kind: "act", action: "STAND" };
  if (s.canHit) return { kind: "act", action: "HIT" };
  return { kind: "wait" };
}

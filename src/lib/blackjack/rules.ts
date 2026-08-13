import type { Rules } from "./types";
import { DEFAULT_RULES } from "./types";

export function createRules(overrides: Partial<Rules> = {}): Rules {
  return { ...DEFAULT_RULES, ...overrides };
}

/** Stable, human-readable pack id. Hashed on the server onto every hand. */
export function rulesFingerprint(rules: Rules): string {
  return [
    `${rules.decks}D`,
    `pen${rules.penetration}`,
    rules.dealerHitsSoft17 ? "H17" : "S17",
    rules.dealerPeek ? "peek" : "ENHC",
    rules.lateSurrender ? "LS" : "NS",
    `BJ${rules.blackjackPayoutNum}/${rules.blackjackPayoutDen}`,
    rules.doubleAfterSplit ? "DAS" : "NDAS",
    rules.resplitAces ? "RSA" : "nRSA",
    rules.splitAcesOneCard ? "A1" : "A+",
    `max${rules.maxSplits}`,
  ].join(":");
}

/** ceil(amount * num / den), saturating at MAX_SAFE. */
function payUp(amount: number, num: number, den: number): number {
  if (amount <= 0 || num < 0) return 0;
  if (den <= 0) throw new Error(`payout denominator must be positive, was ${den}`);
  const raw = Math.floor((amount * num + den - 1) / den);
  return Math.min(raw, Number.MAX_SAFE_INTEGER);
}

/** Blackjack winnings excluding returned stake. $25 natural pays 38. */
export function blackjackPayout(rules: Rules, bet: number): number {
  if (bet < 0) return 0;
  return payUp(bet, rules.blackjackPayoutNum, rules.blackjackPayoutDen);
}

export function insurancePayout(rules: Rules, insuranceBet: number): number {
  if (insuranceBet < 0) return 0;
  return payUp(insuranceBet, rules.insurancePayoutNum, rules.insurancePayoutDen);
}

/** Half the stake, rounded down — money the player hands over. */
export function insurancePremium(bet: number): number {
  if (bet <= 0) return 0;
  return Math.floor(bet / 2);
}

/** Half the stake, rounded up. $25 surrender returns 13. */
export function surrenderRefund(bet: number): number {
  if (bet <= 0) return 0;
  return payUp(bet, 1, 2);
}

export function evenMoneyReturn(bet: number): number {
  if (bet <= 0) return 0;
  return payUp(bet, 2, 1);
}

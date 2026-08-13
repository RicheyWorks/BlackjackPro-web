export const RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
] as const;

export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

export type Phase =
  | "BETTING"
  | "DEALING"
  | "INSURANCE"
  | "PLAYER"
  | "DEALER"
  | "SETTLE";

export type Outcome =
  | "BLACKJACK"
  | "WIN"
  | "PUSH"
  | "LOSS"
  | "BUST"
  | "SURRENDER";

export type ThemeId = "midnight" | "abyss" | "crimson" | "glacier" | "classic";

export interface Card {
  id: number;
  rank: Rank;
  suit: Suit;
}

export interface HandState {
  cards: Card[];
  bet: number;
  doubled: boolean;
  surrendered: boolean;
  fromSplit: boolean;
  splitAce: boolean;
  stood: boolean;
}

export interface SessionStats {
  hands: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  busts: number;
  doubles: number;
  splits: number;
  surrenders: number;
  totalWagered: number;
  totalReturned: number;
  peakBankroll: number;
}

export interface Rules {
  decks: number;
  penetration: number;
  dealerHitsSoft17: boolean;
  lateSurrender: boolean;
  offerInsurance: boolean;
  /** American peek on ace / ten-up. Off = European no-hole-card. */
  dealerPeek: boolean;
  /** Extra hands allowed after the original (3 → four boxes). */
  maxSplits: number;
  doubleAfterSplit: boolean;
  splitAcesOneCard: boolean;
  resplitAces: boolean;
  blackjackPayoutNum: number;
  blackjackPayoutDen: number;
  insurancePayoutNum: number;
  insurancePayoutDen: number;
}

export interface EngineSnapshot {
  phase: Phase;
  bankroll: number;
  pendingBet: number;
  insuranceBet: number;
  lastNet: number;
  lastOutcomes: Outcome[];
  dealer: HandState;
  hands: HandState[];
  activeIndex: number;
  stats: SessionStats;
  shoeRemaining: number;
  shoeDealt: number;
  shoeDecks: number;
  needsShuffle: boolean;
  canBet: (amount: number) => boolean;
  canDeal: boolean;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
  canInsure: boolean;
  canEvenMoney: boolean;
}

export const CHIP_VALUES = [1, 5, 25, 100, 500] as const;
export const STARTING_BANKROLL = 1000;

export const DEFAULT_RULES: Rules = {
  decks: 6,
  penetration: 0.75,
  dealerHitsSoft17: false,
  lateSurrender: true,
  offerInsurance: true,
  dealerPeek: true,
  maxSplits: 3,
  doubleAfterSplit: true,
  splitAcesOneCard: true,
  resplitAces: false,
  blackjackPayoutNum: 3,
  blackjackPayoutDen: 2,
  insurancePayoutNum: 2,
  insurancePayoutDen: 1,
};

export const EMPTY_STATS: SessionStats = {
  hands: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  blackjacks: 0,
  busts: 0,
  doubles: 0,
  splits: 0,
  surrenders: 0,
  totalWagered: 0,
  totalReturned: 0,
  peakBankroll: 0,
};

export function rankValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K" || rank === "10") return 10;
  return Number(rank);
}

export function isRed(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

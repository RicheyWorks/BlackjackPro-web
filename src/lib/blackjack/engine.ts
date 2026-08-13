import type {
  EngineSnapshot,
  HandState,
  Outcome,
  Phase,
  Rules,
  SessionStats,
} from "./types";
import { DEFAULT_RULES, EMPTY_STATS } from "./types";
import { cloneHand, emptyHand, handValue, isBlackjack, isBust, isPair, isSoft, isTen } from "./hand";
import {
  blackjackPayout,
  evenMoneyReturn,
  insurancePayout,
  insurancePremium,
  surrenderRefund,
} from "./rules";
import { Shoe } from "./shoe";
import { clampMoney, isChipAmount, TABLE_MAX, TABLE_MIN } from "./money";
import { snapshotLive, type LiveRound } from "./live";
import type { Plus3Result } from "./plus3";
import type { LiveCount } from "./live";

export class Engine {
  readonly rules: Rules;
  readonly shoe: Shoe;
  dealer: HandState = emptyHand();
  player: HandState[] = [emptyHand()];
  stats: SessionStats;
  activeHand = 0;
  bankroll: number;
  pendingBet = 0;
  insuranceBet = 0;
  phase: Phase = "BETTING";
  lastOutcomes: Outcome[] = [];
  lastNet = 0;
  private roundWagered = 0;
  private roundReturned = 0;

  constructor(startingBankroll: number, rules: Rules = DEFAULT_RULES) {
    this.rules = { ...rules };
    this.bankroll = clampMoney(startingBankroll);
    this.shoe = new Shoe(this.rules.decks, this.rules.penetration);
    this.stats = { ...EMPTY_STATS, peakBankroll: this.bankroll };
  }

  setBankroll(b: number): void {
    this.bankroll = clampMoney(b);
    this.stats.peakBankroll = Math.max(this.stats.peakBankroll, this.bankroll);
  }

  canBet(amount: number): boolean {
    return (
      this.phase === "BETTING" &&
      isChipAmount(amount) &&
      amount <= this.bankroll &&
      this.pendingBet + amount <= TABLE_MAX
    );
  }

  get canDeal(): boolean {
    return (
      this.phase === "BETTING" &&
      this.pendingBet >= TABLE_MIN &&
      this.pendingBet <= TABLE_MAX
    );
  }

  get canHit(): boolean {
    if (this.phase !== "PLAYER") return false;
    const h = this.active();
    return !isBust(h.cards) && !h.stood && !h.splitAce && handValue(h.cards) < 21;
  }

  get canStand(): boolean {
    if (this.phase !== "PLAYER") return false;
    const h = this.active();
    return !isBust(h.cards) && !h.stood && !h.surrendered;
  }

  get canDouble(): boolean {
    if (this.phase !== "PLAYER") return false;
    const h = this.active();
    return (
      h.cards.length === 2 &&
      this.bankroll >= h.bet &&
      !h.splitAce &&
      (this.player.length === 1 || this.rules.doubleAfterSplit)
    );
  }

  get canSplit(): boolean {
    if (this.phase !== "PLAYER") return false;
    const h = this.active();
    if (h.cards.length !== 2 || !isPair(h.cards)) return false;
    if (this.bankroll < h.bet) return false;
    if (this.player.length > this.rules.maxSplits) return false;
    if (h.cards[0]?.rank === "A" && !this.rules.resplitAces && h.fromSplit) return false;
    return true;
  }

  get canSurrender(): boolean {
    if (this.phase !== "PLAYER") return false;
    const h = this.active();
    return (
      this.rules.lateSurrender &&
      h.cards.length === 2 &&
      this.player.length === 1 &&
      !h.fromSplit &&
      !h.doubled
    );
  }

  get canInsure(): boolean {
    if (this.phase !== "INSURANCE" || this.player.length === 0) return false;
    const premium = insurancePremium(this.player[0]!.bet);
    return premium > 0 && this.bankroll >= premium;
  }

  get canEvenMoney(): boolean {
    return this.phase === "INSURANCE" && this.player.length > 0 && isBlackjack(this.player[0]!);
  }

  active(): HandState {
    return this.player[Math.min(this.activeHand, this.player.length - 1)]!;
  }

  addBet(amount: number): void {
    if (!this.canBet(amount)) throw new Error(`cannot bet ${amount}`);
    this.bankroll -= amount;
    this.pendingBet += amount;
  }

  clearBet(): void {
    if (this.phase !== "BETTING") return;
    this.creditBankrollOnly(this.pendingBet);
    this.pendingBet = 0;
  }

  abandonRound(): void {
    this.creditBankrollOnly(this.pendingBet);
    this.creditBankrollOnly(this.insuranceBet);
    for (const h of this.player) this.creditBankrollOnly(h.bet);
    this.pendingBet = 0;
    this.player = [emptyHand()];
    this.dealer = emptyHand();
    this.activeHand = 0;
    this.insuranceBet = 0;
    this.lastOutcomes = [];
    this.roundWagered = 0;
    this.roundReturned = 0;
    this.lastNet = 0;
    this.phase = "BETTING";
  }

  newSession(bankroll = 1000): void {
    this.abandonRound();
    this.stats = { ...EMPTY_STATS, peakBankroll: bankroll };
    this.setBankroll(bankroll);
    this.shoe.reshuffle();
  }

  deal(): void {
    if (!this.canDeal) throw new Error("cannot deal");
    if (this.shoe.needsShuffle()) this.shoe.reshuffle();

    this.lastOutcomes = [];
    this.roundWagered = 0;
    this.roundReturned = 0;
    this.lastNet = 0;

    this.dealer = emptyHand();
    const first = emptyHand();
    first.bet = this.pendingBet;
    this.recordWager(first.bet);
    this.pendingBet = 0;
    this.player = [first];
    this.activeHand = 0;
    this.insuranceBet = 0;
    this.phase = "DEALING";
    this.stats.hands++;

    first.cards.push(this.shoe.deal());
    this.dealer.cards.push(this.shoe.deal());
    first.cards.push(this.shoe.deal());
    this.dealer.cards.push(this.shoe.deal());

    if (this.rules.offerInsurance && this.dealer.cards[0]?.rank === "A") {
      this.phase = "INSURANCE";
      return;
    }
    this.afterInsuranceCheck();
  }

  takeInsurance(accept: boolean): void {
    if (this.phase !== "INSURANCE") throw new Error("not in insurance phase");
    if (accept && isBlackjack(this.player[0]!)) {
      this.takeEvenMoney();
      return;
    }
    const h = this.player[0]!;
    if (accept) {
      const cost = insurancePremium(h.bet);
      if (cost <= 0) throw new Error("insurance premium is zero");
      if (this.bankroll < cost) throw new Error("not enough chips for insurance");
      this.bankroll -= cost;
      this.recordWager(cost);
      this.insuranceBet = cost;
    } else {
      this.insuranceBet = 0;
    }
    this.afterInsuranceCheck();
  }

  /** Lock 1:1 on a natural vs ace. Does not use the insurance box. */
  private takeEvenMoney(): void {
    const h = this.player[0]!;
    this.credit(evenMoneyReturn(h.bet));
    this.stats.wins++;
    this.lastOutcomes = ["WIN"];
    this.insuranceBet = 0;
    this.stats.peakBankroll = Math.max(this.stats.peakBankroll, this.bankroll);
    this.lastNet = this.roundReturned - this.roundWagered;
    this.activeHand = 0;
    this.phase = "BETTING";
  }

  private dealerHasBlackjack(): boolean {
    return this.dealer.cards.length === 2 && handValue(this.dealer.cards) === 21;
  }

  private peekableUp(): boolean {
    const up = this.dealer.cards[0];
    return Boolean(up && (up.rank === "A" || isTen(up.rank)));
  }

  private afterInsuranceCheck(): void {
    const peek = this.rules.dealerPeek !== false && this.peekableUp();
    if (peek && this.dealerHasBlackjack()) {
      if (this.insuranceBet > 0) {
        const payout = this.insuranceBet + insurancePayout(this.rules, this.insuranceBet);
        this.credit(payout);
      }
      this.insuranceBet = 0;
      this.phase = "SETTLE";
      this.settle();
      return;
    }
    this.insuranceBet = 0;
    if (isBlackjack(this.player[0]!)) {
      this.phase = "SETTLE";
      this.settle();
      return;
    }
    this.phase = "PLAYER";
  }

  hit(): void {
    if (!this.canHit) throw new Error("cannot hit");
    const h = this.active();
    h.cards.push(this.shoe.deal());
    if (isBust(h.cards) || handValue(h.cards) === 21) this.advanceHand();
  }

  stand(): void {
    if (!this.canStand) throw new Error("cannot stand");
    this.active().stood = true;
    this.advanceHand();
  }

  doubleDown(): void {
    if (!this.canDouble) throw new Error("cannot double");
    const h = this.active();
    this.bankroll -= h.bet;
    this.recordWager(h.bet);
    h.bet *= 2;
    h.doubled = true;
    this.stats.doubles++;
    h.cards.push(this.shoe.deal());
    this.advanceHand();
  }

  split(): void {
    if (!this.canSplit) throw new Error("cannot split");
    const h = this.active();
    const n = emptyHand();
    n.cards.push(h.cards.pop()!);
    n.bet = h.bet;
    n.fromSplit = true;
    h.fromSplit = true;
    this.bankroll -= h.bet;
    this.recordWager(h.bet);
    this.stats.splits++;
    this.player.splice(this.activeHand + 1, 0, n);

    h.cards.push(this.shoe.deal());
    n.cards.push(this.shoe.deal());

    if (this.rules.splitAcesOneCard && h.cards[0]?.rank === "A") {
      h.splitAce = true;
      n.splitAce = true;
      this.advanceHand();
      return;
    }
    // A 21 (or bust) on the hand we are sitting on must not wait for a click.
    if (handValue(h.cards) >= 21) this.advanceHand();
  }

  surrender(): void {
    if (!this.canSurrender) throw new Error("cannot surrender");
    const h = this.active();
    h.surrendered = true;
    this.stats.surrenders++;
    this.credit(surrenderRefund(h.bet));
    this.phase = "SETTLE";
    this.settle();
  }

  private finished(h: HandState): boolean {
    return h.splitAce || h.stood || h.surrendered || handValue(h.cards) >= 21;
  }

  private advanceHand(): void {
    while (true) {
      this.activeHand++;
      if (this.activeHand >= this.player.length) {
        this.phase = "DEALER";
        this.playDealer();
        return;
      }
      if (this.finished(this.active())) continue;
      return;
    }
  }

  private playDealer(): void {
    const anyLive = this.player.some((h) => !isBust(h.cards) && !h.surrendered);
    if (anyLive) {
      while (true) {
        const v = handValue(this.dealer.cards);
        if (v < 17) {
          this.dealer.cards.push(this.shoe.deal());
          continue;
        }
        if (v === 17 && isSoft(this.dealer.cards) && this.rules.dealerHitsSoft17) {
          this.dealer.cards.push(this.shoe.deal());
          continue;
        }
        break;
      }
    }
    this.phase = "SETTLE";
    this.settle();
  }

  private settle(): void {
    const dv = handValue(this.dealer.cards);
    const dealerBJ = isBlackjack(this.dealer);
    this.lastOutcomes = [];

    for (const h of this.player) {
      if (h.surrendered) {
        this.stats.losses++;
        this.lastOutcomes.push("SURRENDER");
        continue;
      }
      if (isBust(h.cards)) {
        this.stats.losses++;
        this.stats.busts++;
        this.lastOutcomes.push("BUST");
        continue;
      }
      if (isBlackjack(h) && !dealerBJ) {
        this.credit(h.bet + blackjackPayout(this.rules, h.bet));
        this.lastOutcomes.push("BLACKJACK");
        this.stats.wins++;
        this.stats.blackjacks++;
        continue;
      }
      if (dealerBJ) {
        if (isBlackjack(h)) {
          this.credit(h.bet);
          this.stats.pushes++;
          this.lastOutcomes.push("PUSH");
        } else {
          this.stats.losses++;
          this.lastOutcomes.push("LOSS");
        }
        continue;
      }
      const pv = handValue(h.cards);
      if (dv > 21 || pv > dv) {
        this.credit(evenMoneyReturn(h.bet));
        this.stats.wins++;
        this.lastOutcomes.push("WIN");
      } else if (pv === dv) {
        this.credit(h.bet);
        this.stats.pushes++;
        this.lastOutcomes.push("PUSH");
      } else {
        this.stats.losses++;
        this.lastOutcomes.push("LOSS");
      }
    }
    this.stats.peakBankroll = Math.max(this.stats.peakBankroll, this.bankroll);
    this.lastNet = this.roundReturned - this.roundWagered;
    this.activeHand = 0;
    this.phase = "BETTING";
  }

  private recordWager(amount: number): void {
    if (amount <= 0) return;
    this.stats.totalWagered = clampMoney(this.stats.totalWagered + amount);
    this.roundWagered += amount;
  }

  private creditBankrollOnly(amount: number): void {
    if (amount <= 0) return;
    this.bankroll = clampMoney(this.bankroll + amount);
    this.stats.peakBankroll = Math.max(this.stats.peakBankroll, this.bankroll);
  }

  private credit(amount: number): void {
    if (amount <= 0) return;
    this.creditBankrollOnly(amount);
    this.stats.totalReturned = clampMoney(this.stats.totalReturned + amount);
    this.roundReturned += amount;
  }

  captureLive(plus3Last: Plus3Result | null, count: LiveCount): LiveRound | null {
    return snapshotLive(
      this.phase,
      this.activeHand,
      this.insuranceBet,
      this.dealer,
      this.player,
      this.shoe.snapshot(),
      this.roundWagered,
      this.roundReturned,
      plus3Last,
      count,
    );
  }

  restoreLive(live: LiveRound): boolean {
    if (live.phase !== "PLAYER" && live.phase !== "INSURANCE") return false;
    if (!this.shoe.load(live.shoe)) return false;
    this.phase = live.phase;
    this.activeHand = Math.min(live.activeHand, live.hands.length - 1);
    this.insuranceBet = live.insuranceBet;
    this.pendingBet = 0;
    this.dealer = { ...live.dealer, cards: [...live.dealer.cards] };
    this.player = live.hands.map((h) => ({ ...h, cards: [...h.cards] }));
    this.roundWagered = live.roundWagered;
    this.roundReturned = live.roundReturned;
    this.lastOutcomes = [];
    this.lastNet = 0;
    return true;
  }

  roundFigures(): { wagered: number; returned: number; net: number } {
    return { wagered: this.roundWagered, returned: this.roundReturned, net: this.lastNet };
  }

  snapshot(): EngineSnapshot {
    return {
      phase: this.phase,
      bankroll: this.bankroll,
      pendingBet: this.pendingBet,
      insuranceBet: this.insuranceBet,
      lastNet: this.lastNet,
      lastOutcomes: [...this.lastOutcomes],
      dealer: cloneHand(this.dealer),
      hands: this.player.map(cloneHand),
      activeIndex: this.activeHand,
      stats: { ...this.stats },
      shoeRemaining: this.shoe.remaining(),
      shoeDealt: this.shoe.dealt(),
      shoeDecks: this.shoe.decks,
      needsShuffle: this.shoe.needsShuffle(),
      canBet: (n) => this.canBet(n),
      canDeal: this.canDeal,
      canHit: this.canHit,
      canStand: this.canStand,
      canDouble: this.canDouble,
      canSplit: this.canSplit,
      canSurrender: this.canSurrender,
      canInsure: this.canInsure,
      canEvenMoney: this.canEvenMoney,
    };
  }
}

import { isBlackjack } from "@/lib/blackjack/hand";
import { syncVisibleCount } from "@/lib/blackjack/hilo";
import { isTableChip, TABLE_MAX, TABLE_MIN } from "@/lib/blackjack/money";
import { settlePlus3 } from "@/lib/blackjack/plus3";
import { chooseCountBet } from "@/lib/blackjack/deviations";
import { appendTape } from "@/lib/blackjack/tape";
import type { PitOp } from "./types";
import type { PitSession } from "./session";

export interface ApplyHooks {
  reshuffle: (s: PitSession) => void;
  newHandId: () => string;
}

export interface ApplyResult {
  settled: boolean;
}

function rebetAffordable(s: PitSession): boolean {
  return (
    s.engine.phase === "BETTING" &&
    s.engine.pendingBet === 0 &&
    s.plus3Pending === 0 &&
    s.lastMainBet >= TABLE_MIN &&
    s.engine.bankroll >= s.lastMainBet + s.lastPlus3Bet
  );
}

function note(s: PitSession): void {
  if (s.engine.shoe.consumeMidRoundShuffle()) {
    s.counter.reset();
    s.seen.clear();
  }
  syncVisibleCount(s.counter, s.seen, s.engine.snapshot());
}

function resolvePlus3(s: PitSession): void {
  if (s.plus3Pending <= 0) {
    s.plus3Last = null;
    return;
  }
  const stake = s.plus3Pending;
  s.plus3Pending = 0;
  const result = settlePlus3(s.engine.player[0]?.cards ?? [], s.engine.dealer.cards[0], stake);
  s.plus3Last = result;
  s.plus3.wagered += stake;
  s.plus3.returned += result.returned;
  if (result.returned > 0) {
    s.plus3.wins += 1;
    s.engine.setBankroll(s.engine.bankroll + result.returned);
  }
}

function ensureShoe(s: PitSession, hooks: ApplyHooks): void {
  if (s.engine.shoe.remaining() < 20) hooks.reshuffle(s);
}

export function applyOp(s: PitSession, op: PitOp, hooks: ApplyHooks): ApplyResult {
  const e = s.engine;
  let settled = false;

  switch (op.op) {
    case "seat":
    case "sync":
      break;
    case "addChip": {
      if (e.phase !== "BETTING" || !isTableChip(op.n) || e.bankroll < op.n) break;
      if (op.rail === "plus3") {
        if (s.plus3Pending + op.n > e.pendingBet) break;
        e.setBankroll(e.bankroll - op.n);
        s.plus3Pending += op.n;
      } else if (e.canBet(op.n)) {
        e.addBet(op.n);
      }
      break;
    }
    case "clearBet":
      e.clearBet();
      if (s.plus3Pending > 0) {
        e.setBankroll(e.bankroll + s.plus3Pending);
        s.plus3Pending = 0;
      }
      break;
    case "rebet":
      if (rebetAffordable(s)) {
        e.addBet(s.lastMainBet);
        if (s.lastPlus3Bet > 0 && e.bankroll >= s.lastPlus3Bet) {
          e.setBankroll(e.bankroll - s.lastPlus3Bet);
          s.plus3Pending = s.lastPlus3Bet;
        }
      }
      break;
    case "rebetDeal":
      if (!e.canDeal && rebetAffordable(s)) {
        e.addBet(s.lastMainBet);
        if (s.lastPlus3Bet > 0 && e.bankroll >= s.lastPlus3Bet) {
          e.setBankroll(e.bankroll - s.lastPlus3Bet);
          s.plus3Pending = s.lastPlus3Bet;
        }
      }
      if (!e.canDeal) break;
    // fall through
    case "deal": {
      if (!e.canDeal) break;
      ensureShoe(s, hooks);
      if (e.shoe.needsShuffle()) hooks.reshuffle(s);
      const main = e.pendingBet;
      if (s.plus3Pending > main) {
        e.setBankroll(e.bankroll + (s.plus3Pending - main));
        s.plus3Pending = main;
      }
      const side = s.plus3Pending;
      e.deal();
      s.lastMainBet = main;
      s.lastPlus3Bet = side;
      s.handId = hooks.newHandId();
      resolvePlus3(s);
      note(s);
      if (e.phase === "BETTING") {
        s.tape = appendTape(s.tape, e.lastOutcomes);
        settled = true;
      }
      break;
    }
    case "countBet": {
      if (e.phase !== "BETTING") break;
      const target = chooseCountBet(s.counter.trueCount(e.shoe.remaining()), e.bankroll, e.pendingBet);
      const need = target - e.pendingBet;
      if (need > 0 && e.canBet(need)) e.addBet(need);
      break;
    }
    case "hit":
      if (e.canHit) {
        ensureShoe(s, hooks);
        e.hit();
        note(s);
        if (e.phase === "BETTING") {
          s.tape = appendTape(s.tape, e.lastOutcomes);
          settled = true;
        }
      }
      break;
    case "stand":
      if (e.canStand) {
        ensureShoe(s, hooks);
        e.stand();
        note(s);
        if (e.phase === "BETTING") {
          s.tape = appendTape(s.tape, e.lastOutcomes);
          settled = true;
        }
      }
      break;
    case "double":
      if (e.canDouble) {
        ensureShoe(s, hooks);
        e.doubleDown();
        note(s);
        if (e.phase === "BETTING") {
          s.tape = appendTape(s.tape, e.lastOutcomes);
          settled = true;
        }
      }
      break;
    case "split":
      if (e.canSplit) {
        ensureShoe(s, hooks);
        e.split();
        note(s);
        if (e.phase === "BETTING") {
          s.tape = appendTape(s.tape, e.lastOutcomes);
          settled = true;
        }
      }
      break;
    case "surrender":
      if (e.canSurrender) {
        e.surrender();
        note(s);
        s.tape = appendTape(s.tape, e.lastOutcomes);
        settled = true;
      }
      break;
    case "insure": {
      if (e.phase !== "INSURANCE") break;
      const natural = e.player[0] ? isBlackjack(e.player[0]) : false;
      if (op.yes && !natural && !e.canInsure) break;
      ensureShoe(s, hooks);
      e.takeInsurance(op.yes);
      note(s);
      if (e.lastOutcomes.length > 0) {
        s.tape = appendTape(s.tape, e.lastOutcomes);
        settled = true;
      }
      break;
    }
    case "setSoft17":
      if (e.phase === "BETTING") e.rules.dealerHitsSoft17 = op.v;
      break;
    case "newSession":
      e.abandonRound();
      if (s.plus3Pending > 0) {
        e.setBankroll(e.bankroll + s.plus3Pending);
        s.plus3Pending = 0;
      }
      s.plus3Last = null;
      s.handId = null;
      break;
    case "refill":
    case "setLossLimit":
    case "cooloff":
    case "selfExclude":
    case "ackReality":
      break;
  }

  return { settled };
}

export { rebetAffordable };

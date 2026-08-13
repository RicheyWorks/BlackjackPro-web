import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "./engine";
import { blackjackPayout, insurancePremium, surrenderRefund } from "./rules";
import { handValue, isBlackjack, isSoft } from "./hand";
import { basicAdvice } from "./strategy";
import { HiLoCounter, hiloValue, shoeMix, syncVisibleCount } from "./hilo";
import { nextAutoStep } from "./autoplay";
import { unlocks } from "./achievements";
import { settlePlus3 } from "./plus3";
import { chooseCountBet, coachAdvice, takeInsuranceAt } from "./deviations";
import { appendTape, sanitizeTape } from "./tape";
import { loadSave, restoreCash, defaultSave } from "./persist";
import { TABLE_MAX, TABLE_MIN } from "./money";
import type { Card, Rank, Suit } from "./types";
import { DEFAULT_RULES } from "./types";

type ShoeMut = { cards: Card[]; nextId: number };

function stack(engine: Engine, order: Array<[Rank, Suit?]>): void {
  const shoe = engine.shoe as unknown as ShoeMut;
  const cards: Card[] = order.map(([rank, suit], i) => ({
    id: shoe.nextId + i,
    rank,
    suit: suit ?? "spades",
  }));
  shoe.nextId += cards.length;
  // deal() pops, so the first card of `order` must sit at the end.
  shoe.cards.push(...[...cards].reverse());
}

function card(id: number, rank: Rank, suit: Suit = "clubs"): Card {
  return { id, rank, suit };
}

describe("payouts", () => {
  it("pays a $25 natural 38 (3:2 rounded up)", () => {
    assert.equal(blackjackPayout(DEFAULT_RULES, 25), 38);
  });

  it("returns 13 on a $25 late surrender", () => {
    assert.equal(surrenderRefund(25), 13);
  });

  it("charges floor(bet/2) for insurance", () => {
    assert.equal(insurancePremium(25), 12);
    assert.equal(insurancePremium(1), 0);
  });
});

describe("engine money", () => {
  it("credits 3:2 on a natural vs a non-bj dealer", () => {
    const e = new Engine(1000);
    e.addBet(25);
    stack(e, [["A"], ["9"], ["10"], ["6"]]);
    e.deal();
    assert.equal(e.phase, "BETTING");
    assert.deepEqual(e.lastOutcomes, ["BLACKJACK"]);
    assert.equal(e.lastNet, 38);
    assert.equal(e.bankroll, 1038);
  });

  it("returns 13 and records surrender", () => {
    const e = new Engine(1000);
    e.addBet(25);
    stack(e, [["10"], ["10"], ["6"], ["9"]]);
    e.deal();
    assert.equal(e.phase, "PLAYER");
    e.surrender();
    assert.equal(e.phase, "BETTING");
    assert.deepEqual(e.lastOutcomes, ["SURRENDER"]);
    assert.equal(e.lastNet, -12);
    assert.equal(e.bankroll, 988);
  });

  it("peeks a ten-up blackjack and does not let the player act", () => {
    const e = new Engine(1000);
    e.addBet(25);
    stack(e, [["9"], ["10"], ["8"], ["A"]]);
    e.deal();
    assert.equal(e.phase, "BETTING");
    assert.deepEqual(e.lastOutcomes, ["LOSS"]);
    assert.equal(e.bankroll, 975);
  });

  it("pays insurance 2:1 when the dealer has blackjack", () => {
    const e = new Engine(1000);
    e.addBet(25);
    stack(e, [["9"], ["A"], ["8"], ["10"]]);
    e.deal();
    assert.equal(e.phase, "INSURANCE");
    e.takeInsurance(true);
    assert.equal(e.phase, "BETTING");
    assert.equal(e.lastNet, -1);
    assert.equal(e.bankroll, 999);
  });
});

describe("splits", () => {
  it("auto-stands a 21 dealt after a split", () => {
    const e = new Engine(1000);
    e.addBet(25);
    stack(e, [["10"], ["6"], ["10"], ["9"], ["A"], ["5"]]);
    e.deal();
    assert.ok(e.canSplit);
    e.split();
    assert.equal(e.phase, "PLAYER");
    assert.equal(e.activeHand, 1);
    assert.equal(handValue(e.player[0]!.cards), 21);
    assert.equal(handValue(e.player[1]!.cards), 15);
    assert.equal(e.canHit, true);
  });

  it("skips a second-hand 21 after the first hand stands", () => {
    const e = new Engine(1000);
    e.addBet(25);
    stack(e, [["10"], ["6"], ["10"], ["9"], ["2"], ["A"]]);
    e.deal();
    e.split();
    assert.equal(e.phase, "PLAYER");
    assert.equal(e.activeHand, 0);
    assert.equal(handValue(e.player[1]!.cards), 21);
    e.stand();
    assert.equal(e.phase, "BETTING");
    assert.equal(e.lastOutcomes.length, 2);
  });

  it("gives split aces one card each and goes to the dealer", () => {
    const e = new Engine(1000);
    e.addBet(25);
    stack(e, [["A"], ["6"], ["A"], ["9"], ["5"], ["9"]]);
    e.deal();
    e.split();
    assert.equal(e.phase, "BETTING");
    assert.equal(e.player.length, 2);
    assert.equal(e.player[0]!.cards.length, 2);
    assert.equal(e.player[1]!.cards.length, 2);
    assert.ok(e.player[0]!.splitAce);
    assert.ok(!isBlackjack(e.player[0]!));
  });

  it("pays even money, not 3:2, on a split 10-ace", () => {
    const e = new Engine(1000);
    e.addBet(25);
    stack(e, [["10"], ["6"], ["10"], ["9"], ["A"], ["5"]]);
    e.deal();
    e.split();
    assert.equal(handValue(e.player[0]!.cards), 21);
    assert.ok(!isBlackjack(e.player[0]!));
    e.stand();
    assert.equal(e.phase, "BETTING");
    assert.equal(e.lastOutcomes[0], "WIN");
    assert.ok(e.lastOutcomes[0] !== "BLACKJACK");
  });
});

describe("dealer 17", () => {
  it("S17 stands on soft 17", () => {
    const e = new Engine(1000);
    e.rules.dealerHitsSoft17 = false;
    e.addBet(25);
    stack(e, [["10"], ["A"], ["9"], ["6"]]);
    e.deal();
    if (e.phase === "INSURANCE") e.takeInsurance(false);
    if (e.phase === "PLAYER") e.stand();
    assert.equal(e.phase, "BETTING");
    assert.equal(e.dealer.cards.length, 2);
    assert.equal(handValue(e.dealer.cards), 17);
    assert.ok(isSoft(e.dealer.cards));
    assert.deepEqual(e.lastOutcomes, ["WIN"]);
  });

  it("H17 hits soft 17", () => {
    const e = new Engine(1000);
    e.rules.dealerHitsSoft17 = true;
    e.addBet(25);
    stack(e, [["10"], ["A"], ["9"], ["6"], ["K"]]);
    e.deal();
    if (e.phase === "INSURANCE") e.takeInsurance(false);
    if (e.phase === "PLAYER") e.stand();
    assert.equal(e.phase, "BETTING");
    assert.ok(e.dealer.cards.length >= 3);
  });
});

describe("basic strategy", () => {
  const up = (rank: Rank): Card => card(1, rank, "hearts");
  const hand = (...ranks: Rank[]) => ({
    cards: ranks.map((r, i) => card(i + 2, r)),
    bet: 25,
    doubled: false,
    surrendered: false,
    fromSplit: false,
    splitAce: false,
    stood: false,
  });

  it("stands on soft 19 vs 6 (S17 — not a double)", () => {
    assert.equal(basicAdvice(hand("A", "8"), up("6")), "STAND");
  });

  it("doubles soft 19 vs 6 only on H17", () => {
    assert.equal(basicAdvice(hand("A", "8"), up("6"), { h17: true }), "DOUBLE");
  });

  it("falls back when surrender is illegal (split 16 vs 10)", () => {
    const h = { ...hand("10", "6"), fromSplit: true };
    assert.equal(basicAdvice(h, up("10")), "SURRENDER");
    assert.equal(basicAdvice(h, up("10"), { allowSurrender: false }), "HIT");
  });

  it("falls back when a double is illegal", () => {
    assert.equal(basicAdvice(hand("6", "5"), up("6")), "DOUBLE");
    assert.equal(basicAdvice(hand("6", "5"), up("6"), { allowDouble: false }), "HIT");
    assert.equal(basicAdvice(hand("A", "7"), up("4")), "DOUBLE");
    assert.equal(basicAdvice(hand("A", "7"), up("4"), { allowDouble: false }), "STAND");
  });

  it("falls back when a split is illegal (8s vs 10 → surrender)", () => {
    assert.equal(basicAdvice(hand("8", "8"), up("10")), "SPLIT");
    assert.equal(basicAdvice(hand("8", "8"), up("10"), { allowSplit: false }), "SURRENDER");
  });
});

describe("hi-lo sync", () => {
  it("does not count the hole while it is face-down", () => {
    const counter = new HiLoCounter();
    const seen = new Set<number>();
    const dealer = { cards: [card(1, "5"), card(2, "K")] };
    const hands = [{ cards: [card(3, "2"), card(4, "7")] }];
    syncVisibleCount(counter, seen, { phase: "PLAYER", hands, dealer });
    assert.equal(counter.running, 2);
    syncVisibleCount(counter, seen, { phase: "BETTING", hands, dealer });
    assert.equal(counter.running, 1);
  });

  it("counts a card drawn onto a finished split hand", () => {
    const counter = new HiLoCounter();
    const seen = new Set<number>();
    const dealer = { cards: [card(1, "6"), card(2, "9")] };
    syncVisibleCount(counter, seen, {
      phase: "PLAYER",
      dealer,
      hands: [{ cards: [card(3, "8"), card(4, "8")] }],
    });
    syncVisibleCount(counter, seen, {
      phase: "PLAYER",
      dealer,
      hands: [
        { cards: [card(3, "8"), card(4, "8"), card(5, "10")] },
        { cards: [card(6, "8"), card(7, "2")] },
      ],
    });
    assert.equal(hiloValue(card(5, "10")), -1);
    assert.ok(seen.has(5));
  });
});

describe("achievements", () => {
  it("unlocks five-card only on a 21, not any five-card win", () => {
    const twenty = [card(1, "2"), card(2, "3"), card(3, "4"), card(4, "5"), card(5, "6")];
    const snap = {
      lastOutcomes: ["WIN"],
      bankroll: 1000,
      stats: { hands: 1 },
      hands: [{ cards: twenty, doubled: false, fromSplit: false }],
    } as unknown as Parameters<typeof unlocks>[1];
    const got = unlocks(new Set(), snap, { insurancePaid: false, openedAt: 1000 });
    assert.ok(!got.some((a) => a.id === "five-card"));
    assert.equal(handValue(twenty), 20);
  });
});

describe("persist", () => {
  it("rejects a poisoned bankroll", () => {
    const g = globalThis as typeof globalThis & { window?: { localStorage: Storage } };
    const store: Record<string, string> = {
      "blackjack-pro-v1": JSON.stringify({
        version: 1,
        bankroll: Number.NaN,
        theme: "not-a-theme",
        stats: { hands: "nope" },
      }),
    };
    g.window = {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
        key: () => null,
        length: 0,
      },
    };
    const save = loadSave();
    assert.equal(save.bankroll, 1000);
    assert.equal(save.theme, "midnight");
    assert.equal(save.stats.hands, 0);
    delete g.window;
  });

  it("puts pending chips back on the felt and refunds a live hand", () => {
    const betting = restoreCash({
      ...defaultSave(),
      bankroll: 875,
      pendingBet: 100,
      plus3Pending: 25,
      inPlay: 0,
    });
    assert.equal(betting.bankroll, 875);
    assert.equal(betting.pendingBet, 100);
    assert.equal(betting.plus3Pending, 25);

    const mid = restoreCash({
      ...defaultSave(),
      bankroll: 950,
      pendingBet: 0,
      plus3Pending: 0,
      inPlay: 50,
      stats: { ...defaultSave().stats, hands: 4, totalWagered: 150 },
    });
    assert.equal(mid.bankroll, 1000);
    assert.equal(mid.pendingBet, 0);
    assert.equal(mid.stats.hands, 3);
    assert.equal(mid.stats.totalWagered, 100);
  });
});

describe("21+3", () => {
  it("pays the Java table: suited trips 100:1 through flush 5:1", () => {
    const trips = settlePlus3(
      [card(1, "7", "spades"), card(2, "7", "spades")],
      card(3, "7", "spades"),
      10,
    );
    assert.equal(trips.returned, 1010);
    assert.equal(trips.kind, "SUITED_TRIPS");

    const sf = settlePlus3(
      [card(1, "5", "hearts"), card(2, "6", "hearts")],
      card(3, "7", "hearts"),
      10,
    );
    assert.equal(sf.returned, 410);
    assert.equal(sf.kind, "STRAIGHT_FLUSH");

    const kind = settlePlus3(
      [card(1, "K", "spades"), card(2, "K", "hearts")],
      card(3, "K", "clubs"),
      10,
    );
    assert.equal(kind.returned, 310);
    assert.equal(kind.kind, "TRIPS");

    const straight = settlePlus3(
      [card(1, "5", "spades"), card(2, "6", "hearts")],
      card(3, "7", "clubs"),
      10,
    );
    assert.equal(straight.returned, 110);
    assert.equal(straight.kind, "STRAIGHT");

    const flush = settlePlus3(
      [card(1, "2", "hearts"), card(2, "8", "hearts")],
      card(3, "J", "hearts"),
      10,
    );
    assert.equal(flush.returned, 60);
    assert.equal(flush.kind, "FLUSH");
  });

  it("detects the A-2-3 wheel, broadway, and suited wheel", () => {
    const wheel = settlePlus3(
      [card(1, "A", "spades"), card(2, "2", "hearts")],
      card(3, "3", "clubs"),
      10,
    );
    assert.equal(wheel.returned, 110);
    assert.equal(wheel.kind, "STRAIGHT");

    const miss = settlePlus3(
      [card(1, "2", "hearts"), card(2, "8", "spades")],
      card(3, "J", "clubs"),
      10,
    );
    assert.equal(miss.returned, 0);
    assert.equal(miss.kind, null);

    const broadway = settlePlus3(
      [card(1, "Q", "spades"), card(2, "K", "hearts")],
      card(3, "A", "clubs"),
      10,
    );
    assert.equal(broadway.kind, "STRAIGHT");
    assert.equal(broadway.returned, 110);

    const suitedWheel = settlePlus3(
      [card(1, "A", "hearts"), card(2, "2", "hearts")],
      card(3, "3", "hearts"),
      10,
    );
    assert.equal(suitedWheel.kind, "STRAIGHT_FLUSH");
    assert.equal(suitedWheel.returned, 410);
  });

  it("does not move engine lastNet — side money stays off the hand", () => {
    const e = new Engine(1000);
    e.addBet(25);
    stack(e, [["10"], ["9"], ["8"], ["6"]]);
    e.deal();
    e.stand();
    const net = e.lastNet;
    e.setBankroll(e.bankroll + 60);
    assert.equal(e.lastNet, net);
  });
});

describe("count coach", () => {
  const up = (rank: Rank): Card => card(1, rank, "hearts");
  const hand = (...ranks: Rank[]) => ({
    cards: ranks.map((r, i) => card(i + 2, r)),
    bet: 25,
    doubled: false,
    surrendered: false,
    fromSplit: false,
    splitAce: false,
    stood: false,
  });

  it("matches the Java ramp: 1/2/4/8 units of $5", () => {
    assert.equal(chooseCountBet(0, 1000), 5);
    assert.equal(chooseCountBet(2, 1000), 10);
    assert.equal(chooseCountBet(3, 1000), 20);
    assert.equal(chooseCountBet(4, 1000), 40);
    assert.equal(chooseCountBet(5, 12), 12);
  });

  it("takes insurance at a floored true count of +3", () => {
    assert.equal(takeInsuranceAt(2.9), false);
    assert.equal(takeInsuranceAt(3), true);
  });

  it("deviates 12 vs 3 at TC +2, and 9 vs 2 at TC +1", () => {
    const twelve = coachAdvice(hand("7", "5"), up("3"), 2.4, { allowDouble: true });
    assert.equal(twelve.action, "STAND");
    assert.equal(twelve.deviate, true);

    const nine = coachAdvice(hand("4", "5"), up("2"), 1, { allowDouble: true });
    assert.equal(nine.action, "DOUBLE");
    assert.equal(nine.deviate, true);
  });

  it("does not override late surrender on 16 vs 10", () => {
    const c = coachAdvice(hand("10", "6"), up("10"), 4, { allowSurrender: true });
    assert.equal(c.action, "SURRENDER");
    assert.equal(c.deviate, false);
  });

  it("caps the tape and drops junk marks", () => {
    const marks = appendTape(
      Array.from({ length: 23 }, () => "W" as const),
      ["LOSS", "WIN"],
    );
    assert.equal(marks.length, 24);
    assert.equal(marks[0], "W");
    assert.equal(marks[22], "L");
    assert.equal(marks[23], "W");
    assert.deepEqual(sanitizeTape(["W", "nope", 3, "BJ"]), ["W", "BJ"]);
  });
});

describe("coach autoplay + shoe mix", () => {
  const up = (rank: Rank): Card => card(1, rank, "hearts");
  const hand = (...ranks: Rank[]) => ({
    cards: ranks.map((r, i) => card(i + 2, r)),
    bet: 25,
    doubled: false,
    surrendered: false,
    fromSplit: false,
    splitAce: false,
    stood: false,
  });

  it("bets the ramp then deals, and never takes 21+3", () => {
    const bet = nextAutoStep({
      phase: "BETTING",
      canDeal: false,
      canInsure: false,
      canEvenMoney: false,
      pendingBet: 0,
      bankroll: 1000,
      countStake: 5,
      trueCount: 0,
      canHit: false,
      canStand: false,
      canDouble: false,
      canSplit: false,
      canSurrender: false,
      soft17: false,
    });
    assert.equal(bet.kind, "countBet");

    const deal = nextAutoStep({
      phase: "BETTING",
      canDeal: true,
      canInsure: false,
      canEvenMoney: false,
      pendingBet: 5,
      bankroll: 995,
      countStake: 5,
      trueCount: 0,
      canHit: false,
      canStand: false,
      canDouble: false,
      canSplit: false,
      canSurrender: false,
      soft17: false,
    });
    assert.equal(deal.kind, "deal");
  });

  it("takes insurance only at TC +3 and stands a 17", () => {
    const ins = nextAutoStep({
      phase: "INSURANCE",
      canDeal: false,
      canInsure: true,
      canEvenMoney: false,
      pendingBet: 0,
      bankroll: 900,
      countStake: 20,
      trueCount: 3.2,
      canHit: false,
      canStand: false,
      canDouble: false,
      canSplit: false,
      canSurrender: false,
      soft17: false,
    });
    assert.deepEqual(ins, { kind: "insure", yes: true });

    const play = nextAutoStep({
      phase: "PLAYER",
      canDeal: false,
      canInsure: false,
      canEvenMoney: false,
      pendingBet: 0,
      bankroll: 900,
      countStake: 5,
      trueCount: 0,
      canHit: true,
      canStand: true,
      canDouble: false,
      canSplit: false,
      canSurrender: false,
      hand: hand("10", "7"),
      up: up("6"),
      soft17: false,
    });
    assert.deepEqual(play, { kind: "act", action: "STAND" });
  });

  it("tracks remaining lows / mids / highs", () => {
    const c = new HiLoCounter();
    c.see(card(1, "5"));
    c.see(card(2, "K"));
    c.see(card(3, "8"));
    const mix = shoeMix(6, c);
    assert.equal(mix.low.total, 120);
    assert.equal(mix.mid.total, 72);
    assert.equal(mix.high.total, 120);
    assert.equal(mix.low.left, 119);
    assert.equal(mix.mid.left, 71);
    assert.equal(mix.high.left, 119);
  });

  it("stops when the rack is empty", () => {
    const stop = nextAutoStep({
      phase: "BETTING",
      canDeal: false,
      canInsure: false,
      canEvenMoney: false,
      pendingBet: 0,
      bankroll: 0,
      countStake: 0,
      trueCount: 0,
      canHit: false,
      canStand: false,
      canDouble: false,
      canSplit: false,
      canSurrender: false,
      soft17: false,
    });
    assert.equal(stop.kind, "stop");
  });
});

describe("casino rules", () => {
  it("locks even money at 1:1 even when the rack is empty", () => {
    const e = new Engine(25);
    e.addBet(25);
    stack(e, [["A"], ["A"], ["10"], ["10"]]);
    e.deal();
    assert.equal(e.phase, "INSURANCE");
    assert.equal(e.canEvenMoney, true);
    assert.equal(e.canInsure, false);
    e.takeInsurance(true);
    assert.equal(e.phase, "BETTING");
    assert.deepEqual(e.lastOutcomes, ["WIN"]);
    assert.equal(e.lastNet, 25);
    assert.equal(e.bankroll, 50);
    assert.equal(e.stats.blackjacks, 0);
  });

  it("does not deal below the table minimum or above the max", () => {
    const e = new Engine(1000);
    e.addBet(1);
    assert.equal(e.canDeal, false);
    e.addBet(4);
    assert.equal(e.canDeal, true);
    assert.equal(e.canBet(TABLE_MAX), false);
    const fat = new Engine(10_000);
    fat.addBet(TABLE_MAX);
    assert.equal(fat.canBet(1), false);
    assert.equal(fat.canDeal, true);
    assert.equal(TABLE_MIN, 5);
  });

  it("rejects non-integer and oversized bets", () => {
    const e = new Engine(1000);
    assert.equal(e.canBet(2.5), false);
    assert.equal(e.canBet(Number.NaN), false);
    assert.equal(e.canBet(Infinity), false);
    assert.equal(e.canBet(-5), false);
  });
});

describe("security persist", () => {
  it("drops prototype keys and caps a poisoned bankroll", () => {
    const g = globalThis as typeof globalThis & { window?: { localStorage: Storage } };
    const store: Record<string, string> = {
      "blackjack-pro-v1": JSON.stringify({
        version: 1,
        bankroll: 9e15,
        theme: "midnight",
        achievements: ["first-win", "hacked", "__proto__"],
        extra: "nope",
      }),
    };
    g.window = {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
        key: () => null,
        length: 0,
      },
    };
    const save = loadSave();
    assert.ok(save.bankroll <= 1_000_000);
    assert.deepEqual(save.achievements, ["first-win"]);
    assert.equal("extra" in save, false);
    delete g.window;
    assert.equal(Object.prototype.hasOwnProperty("polluted"), false);
  });

  it("revives a __proto__ payload without polluting", () => {
    const g = globalThis as typeof globalThis & { window?: { localStorage: Storage } };
    const raw = '{"version":1,"__proto__":{"polluted":true},"constructor":{"prototype":{"x":1}},"bankroll":250}';
    g.window = {
      localStorage: {
        getItem: () => raw,
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
        key: () => null,
        length: 0,
      },
    };
    const save = loadSave();
    assert.equal(save.bankroll, 250);
    assert.equal((save as unknown as { polluted?: boolean }).polluted, undefined);
    delete g.window;
    assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  });
});



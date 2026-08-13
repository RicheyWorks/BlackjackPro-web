import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "@/lib/blackjack/engine";
import { createRules } from "@/lib/blackjack/rules";
import { HiLoCounter } from "@/lib/blackjack/hilo";
import { redactDealer } from "./redact";
import { settlePlus3 } from "@/lib/blackjack/plus3";
import { parseDealerJson, parseHandsJson, groupActions, sanitizeAction, handProof, ledgerExport } from "./history";
import { parseDevice, parseOp } from "./parse";
import { applyOp } from "./apply";
import { dumpSession, parseBlob, type PitSession } from "./session";
import { buildShuffledShoe, commitSeed, hmacIndex, newSeed } from "./rng.server";
import { nextAutoStep } from "@/lib/blackjack/autoplay";
import { needsRealityAck, formatSeated, needsRealityWarn } from "./reality";
import { assertRate, _resetRateForTests } from "./rate";
import { REALITY_MS, REALITY_WARN_MS } from "./types";
import { commitFromSeed } from "./verify";
import { rulesFingerprint } from "@/lib/blackjack/rules";
import { DEFAULT_RULES } from "@/lib/blackjack/types";
import type { Card, Rank, Suit } from "@/lib/blackjack/types";

function session(bank = 1000): PitSession {
  const seed = newSeed();
  const engine = new Engine(bank, createRules({ dealerHitsSoft17: false }));
  engine.shoe.load(buildShuffledShoe(6, seed, 0.75));
  return {
    engine,
    plus3Pending: 0,
    plus3Last: null,
    lastMainBet: 0,
    lastPlus3Bet: 0,
    plus3: { wagered: 0, returned: 0, wins: 0 },
    tape: [],
    seed,
    seedCommit: commitSeed(seed),
    prevSeedReveal: null,
    prevSeedCommit: null,
    handId: null,
    counter: new HiLoCounter(),
    seen: new Set(),
    version: 1,
    sessionAnchor: bank,
    sessionStartedAt: Date.now(),
    lastRealityAckAt: Date.now(),
  };
}

function card(id: number, rank: Rank, suit: Suit = "spades"): Card {
  return { id, rank, suit };
}

const hooks = {
  reshuffle: (s: PitSession) => {
    s.prevSeedReveal = s.seed;
    s.seed = newSeed();
    s.seedCommit = commitSeed(s.seed);
    s.engine.shoe.load(buildShuffledShoe(6, s.seed, 0.75));
    s.counter.reset();
    s.seen.clear();
  },
  newHandId: () => "hand-test",
};

describe("casino rng", () => {
  it("commits a 32-byte seed and shuffles deterministically", () => {
    const seed = "ab".repeat(32);
    assert.equal(commitSeed(seed).length, 64);
    const a = buildShuffledShoe(1, seed, 0.75);
    const b = buildShuffledShoe(1, seed, 0.75);
    assert.deepEqual(a.cards.map((c) => c.id), b.cards.map((c) => c.id));
    assert.equal(a.cards.length, 52);
  });

  it("hmacIndex stays in range", () => {
    const seed = newSeed();
    for (let i = 1; i < 40; i++) {
      const j = hmacIndex(seed, i, i);
      assert.ok(j >= 0 && j < i);
    }
  });
});

describe("casino redact", () => {
  it("drops the hole while the player is acting", () => {
    const dealer = {
      cards: [card(1, "A"), card(2, "K")],
      bet: 0,
      doubled: false,
      surrendered: false,
      fromSplit: false,
      splitAce: false,
      stood: false,
    };
    const hidden = redactDealer(dealer, "PLAYER");
    assert.equal(hidden.cards.length, 1);
    assert.equal(hidden.cards[0]!.rank, "A");
    assert.equal(redactDealer(dealer, "BETTING").cards.length, 2);
  });
});

describe("casino parse", () => {
  it("rejects junk", () => {
    assert.throws(() => parseOp({ op: "explode" }));
    assert.throws(() => parseOp({ op: "addChip", n: 7, rail: "main" }));
    assert.throws(() => parseOp({ op: "seat" }));
    assert.equal(parseOp({ op: "seat", ageAttest: true }).op, "seat");
  });
});

describe("casino apply", () => {
  it("deals from the server engine and settles a natural", () => {
    const s = session();
    applyOp(s, { op: "addChip", n: 25, rail: "main" }, hooks);
    assert.equal(s.engine.pendingBet, 25);
    assert.equal(s.engine.bankroll, 975);
    const shoe = s.engine.shoe as unknown as { cards: Card[]; nextId: number };
    const order: Card[] = [card(31, "A"), card(32, "9"), card(33, "10"), card(34, "6")];
    shoe.cards.push(...[...order].reverse());
    applyOp(s, { op: "deal" }, hooks);
    assert.equal(s.engine.phase, "BETTING");
    assert.deepEqual(s.engine.lastOutcomes, ["BLACKJACK"]);
    assert.equal(s.engine.bankroll, 975 + 25 + 38);
  });

  it("round-trips a live snapshot without refunding the box", () => {
    const s = session();
    applyOp(s, { op: "addChip", n: 25, rail: "main" }, hooks);
    const shoe = s.engine.shoe as unknown as { cards: Card[] };
    const order: Card[] = [card(41, "10"), card(42, "10"), card(43, "6"), card(44, "9")];
    shoe.cards.push(...[...order].reverse());
    applyOp(s, { op: "deal" }, hooks);
    assert.equal(s.engine.phase, "PLAYER");
    const cash = s.engine.bankroll;
    const blob = JSON.stringify(dumpSession(s));
    const restored = parseBlob(blob, cash, 2);
    assert.ok(restored);
    assert.equal(restored!.engine.phase, "PLAYER");
    assert.equal(restored!.engine.bankroll, cash);
    assert.equal(restored!.engine.player[0]!.bet, 25);
    assert.equal(restored!.engine.canHit, true);
  });
});

describe("casino phase 2", () => {
  it("needs a reality ack after 45 minutes", () => {
    const start = 1_000_000;
    assert.equal(needsRealityAck(start, start, start + REALITY_MS - 1), false);
    assert.equal(needsRealityAck(start, start, start + REALITY_MS), true);
    assert.equal(needsRealityAck(start, start + REALITY_MS, start + REALITY_MS + 10), false);
  });

  it("formats seat time", () => {
    assert.equal(formatSeated(0), "0s");
    assert.equal(formatSeated(12_000), "12s");
    assert.equal(formatSeated(12 * 60_000), "12m");
    assert.equal(formatSeated(90 * 60_000), "1h 30m");
  });

  it("warns five minutes before the reality lock", () => {
    const start = 1_000_000;
    assert.equal(needsRealityWarn(start, start, start + REALITY_WARN_MS - 1), false);
    assert.equal(needsRealityWarn(start, start, start + REALITY_WARN_MS), true);
    assert.equal(needsRealityWarn(start, start, start + REALITY_MS), false);
  });

  it("fingerprints S17 and H17 as different packs", () => {
    const s17 = rulesFingerprint(DEFAULT_RULES);
    const h17 = rulesFingerprint({ ...DEFAULT_RULES, dealerHitsSoft17: true });
    assert.match(s17, /S17/);
    assert.match(h17, /H17/);
    assert.notEqual(s17, h17);
  });

  it("rate-limits a burst", () => {
    _resetRateForTests();
    for (let i = 0; i < 8; i++) assertRate("u", "hit");
    assert.throws(() => assertRate("u", "hit"), /Slow down/);
    assertRate("u", "sync");
  });

  it("parses ackReality", () => {
    assert.equal(parseOp({ op: "ackReality" }).op, "ackReality");
  });

  it("accepts a 32-hex device id", () => {
    assert.equal(parseDevice({ device: "ab".repeat(16) }), "ab".repeat(16));
    assert.equal(parseDevice({ device: "nope" }), "");
  });

  it("retired seed hashes to its commit", async () => {
    const seed = newSeed();
    const commit = commitSeed(seed);
    assert.equal(commitSeed(seed), commit);
    assert.notEqual(commitSeed(newSeed()), commit);
    assert.equal(await commitFromSeed(seed), commit);
  });

  it("refunds 21+3 when the live box is voided", () => {
    const s = session();
    applyOp(s, { op: "addChip", n: 25, rail: "main" }, hooks);
    applyOp(s, { op: "addChip", n: 25, rail: "plus3" }, hooks);
    assert.equal(s.engine.bankroll, 950);
    applyOp(s, { op: "newSession" }, hooks);
    assert.equal(s.plus3Pending, 0);
    assert.equal(s.engine.pendingBet, 0);
    assert.equal(s.engine.bankroll, 1000);
  });

  it("stops the coach when the tray is under the minimum", () => {
    const step = nextAutoStep({
      phase: "BETTING",
      canDeal: false,
      canInsure: false,
      canEvenMoney: false,
      pendingBet: 0,
      bankroll: 3,
      countStake: 0,
      trueCount: 0,
      canHit: false,
      canStand: false,
      canDouble: false,
      canSplit: false,
      canSurrender: false,
      soft17: false,
    });
    assert.equal(step.kind, "stop");
  });

  it("stops the coach when the table is locked", () => {
    const step = nextAutoStep({
      phase: "BETTING",
      canDeal: false,
      canInsure: false,
      canEvenMoney: false,
      pendingBet: 25,
      bankroll: 975,
      countStake: 25,
      trueCount: 0,
      canHit: false,
      canStand: false,
      canDouble: false,
      canSplit: false,
      canSurrender: false,
      soft17: false,
      locked: true,
    });
    assert.equal(step.kind, "stop");
  });

  it("refuses a 21+3 chip bigger than the main box", () => {
    const s = session();
    applyOp(s, { op: "addChip", n: 25, rail: "plus3" }, hooks);
    assert.equal(s.plus3Pending, 0);
    assert.equal(s.engine.bankroll, 1000);
    applyOp(s, { op: "addChip", n: 25, rail: "main" }, hooks);
    applyOp(s, { op: "addChip", n: 25, rail: "plus3" }, hooks);
    applyOp(s, { op: "addChip", n: 5, rail: "plus3" }, hooks);
    assert.equal(s.plus3Pending, 25);
    assert.equal(s.engine.bankroll, 950);
  });

  it("drops prototype keys and junk stats from a pit snapshot", () => {
    const s = session();
    applyOp(s, { op: "addChip", n: 25, rail: "main" }, hooks);
    const blob = dumpSession(s);
    const raw = JSON.stringify({ ...blob, stats: { hands: "nope", wins: 1e20 } }).replace(
      "{",
      '{"__proto__":{"polluted":true},',
    );
    const restored = parseBlob(raw, 975, 1);
    assert.ok(restored);
    assert.equal(restored!.engine.stats.hands, 0);
    assert.equal((restored as unknown as { polluted?: boolean }).polluted, undefined);
  });

  it("voids a 21+3 that cannot be evaluated", () => {
    const r = settlePlus3([], undefined, 25);
    assert.equal(r.returned, 25);
    assert.equal(r.label, "void");
  });

  it("hides the hole on an open hand in the ledger", () => {
    const dealer = parseDealerJson(
      JSON.stringify({
        cards: [
          { id: 1, rank: "A", suit: "spades" },
          { id: 2, rank: "10", suit: "hearts" },
        ],
        bet: 0,
        doubled: false,
        surrendered: false,
        fromSplit: false,
        splitAce: false,
        stood: false,
      }),
      "open",
    );
    assert.ok(dealer);
    assert.equal(dealer!.cards.length, 1);
    assert.equal(dealer!.cards[0]!.rank, "A");
    const settled = parseDealerJson(
      JSON.stringify({
        cards: [
          { id: 1, rank: "A", suit: "spades" },
          { id: 2, rank: "10", suit: "hearts" },
        ],
        bet: 0,
        doubled: false,
        surrendered: false,
        fromSplit: false,
        splitAce: false,
        stood: false,
      }),
      "settled",
    );
    assert.equal(settled?.cards.length, 2);
    assert.equal(parseHandsJson("nope").length, 0);
  });

  it("keeps only known actions on a hand", () => {
    assert.equal(sanitizeAction("hit"), "hit");
    assert.equal(sanitizeAction("drop table"), null);
    const map = groupActions([
      { hand_id: "a", action: "deal" },
      { hand_id: "a", action: "hit" },
      { hand_id: "a", action: "evil" },
      { hand_id: null, action: "stand" },
    ]);
    assert.deepEqual(map.get("a"), ["deal", "hit"]);
  });

  it("prints a hand proof without the live seed", () => {
    const text = handProof({
      id: "abc",
      rulesPack: "6D S17",
      rulesHash: "deadbeef",
      seedCommit: "aa".repeat(32),
      seedReveal: null,
      outcomes: "WIN",
      wagered: 25,
      returned: 50,
      net: 25,
    });
    assert.match(text, /commit/);
    assert.match(text, /reveal pending/);
    assert.doesNotMatch(text, /live seed/);
  });

  it("exports a play-chip ledger without claiming a license", () => {
    const raw = ledgerExport({
      rulesPack: "6D S17",
      rulesHash: "abc",
      pit: { hands: 1, wagered: 25, returned: 50, net: 25, rtp: 2, voids: 0 },
      hands: [],
      wallet: [{ amount: 1000, balanceAfter: 1000, kind: "grant", at: "t" }],
    });
    const j = JSON.parse(raw) as { licensed: boolean; playChips: boolean };
    assert.equal(j.licensed, false);
    assert.equal(j.playChips, true);
  });
});




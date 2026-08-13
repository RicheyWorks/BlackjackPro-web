import { create } from "zustand";
import { Engine } from "@/lib/blackjack/engine";
import type { EngineSnapshot, Outcome, ThemeId } from "@/lib/blackjack/types";
import { STARTING_BANKROLL } from "@/lib/blackjack/types";
import { createRules } from "@/lib/blackjack/rules";
import { HiLoCounter, shoeMix, syncVisibleCount, type ShoeMix } from "@/lib/blackjack/hilo";
import { handValue, isBust, isBlackjack } from "@/lib/blackjack/hand";
import { lineFor, linesForOutcomes, type Line } from "@/lib/blackjack/chatter";
import { unlocks } from "@/lib/blackjack/achievements";
import { defaultSave, loadSave, liveInPlay, restoreCash, writeSave, type Plus3Save, type SaveData } from "@/lib/blackjack/persist";
import { settlePlus3, type Plus3Result } from "@/lib/blackjack/plus3";
import { chooseCountBet } from "@/lib/blackjack/deviations";
import { appendTape, type TapeMark } from "@/lib/blackjack/tape";
import { nextAutoStep } from "@/lib/blackjack/autoplay";
import { tableAction } from "@/lib/casino/api";
import { viewToSnap } from "@/lib/casino/view";
import type { PitOp, PitView } from "@/lib/casino/types";
import { isTableChip, TABLE_MAX, TABLE_MIN } from "@/lib/blackjack/money";
import { sfx } from "@/lib/blackjack/sfx";

export type BetRail = "main" | "plus3";

interface TableState {
  rev: number;
  snap: EngineSnapshot;
  theme: ThemeId;
  sound: boolean;
  hints: boolean;
  showCount: boolean;
  seated: boolean;
  soft17: boolean;
  running: number;
  trueCount: number;
  chatter: Line | null;
  toast: string | null;
  achievements: string[];
  openedAt: number;
  lastInsurancePaid: boolean;
  plus3Pending: number;
  plus3Last: Plus3Result | null;
  plus3Stats: Plus3Save;
  lastMainBet: number;
  lastPlus3Bet: number;
  canRebet: boolean;
  betRail: BetRail;
  tape: TapeMark[];
  countStake: number;
  mix: ShoeMix;
  autoplay: boolean;
  mode: "practice" | "pit";
  pitBusy: boolean;
  seedCommit: string | null;
  seedReveal: string | null;
  realityCheck: boolean;
  lossLimit: number;
  rulesPack: string | null;
  rulesHash: string | null;
  seat: () => void;
  openPit: () => Promise<void>;
  refillPit: () => void;
  ackReality: () => void;
  setLossLimit: (amount: number) => void;
  cooloff: (hours: number) => void;
  selfExclude: (days: number) => void;
  addChip: (n: number) => void;
  setBetRail: (r: BetRail) => void;
  clearBet: () => void;
  rebet: () => boolean;
  rebetDeal: () => void;
  countBet: () => void;
  deal: () => void;
  hit: () => void;
  stand: () => void;
  double: () => void;
  split: () => void;
  surrender: () => void;
  insure: (yes: boolean) => void;
  setTheme: (t: ThemeId) => void;
  setSound: (v: boolean) => void;
  setHints: (v: boolean) => void;
  setShowCount: (v: boolean) => void;
  setSoft17: (v: boolean) => void;
  setAutoplay: (v: boolean) => void;
  autoTick: () => void;
  newSession: () => void;
  dismissToast: () => void;
}

const counter = new HiLoCounter();
let engine = new Engine(STARTING_BANKROLL);
let settings: SaveData = defaultSave();
let plus3Pending = 0;
let plus3Last: Plus3Result | null = null;
let tableMode: "practice" | "pit" = "practice";
let pitLock = false;

function persist(): void {
  if (tableMode === "pit") {
    const prior = loadSave();
    writeSave({
      ...prior,
      theme: settings.theme,
      sound: settings.sound,
      hints: settings.hints,
      showCount: settings.showCount,
      dealerHitsSoft17: settings.dealerHitsSoft17,
    });
    return;
  }
  writeSave({
    ...settings,
    bankroll: engine.bankroll,
    stats: { ...engine.stats },
    achievements: settings.achievements,
    lastMainBet: settings.lastMainBet,
    lastPlus3Bet: settings.lastPlus3Bet,
    pendingBet: engine.phase === "BETTING" ? engine.pendingBet : 0,
    plus3Pending: engine.phase === "BETTING" ? plus3Pending : 0,
    inPlay: liveInPlay(engine.phase, engine.insuranceBet, engine.player),
    live: engine.captureLive(plus3Last, {
      running: counter.running,
      seenLow: counter.seenLow,
      seenMid: counter.seenMid,
      seenHigh: counter.seenHigh,
      seen: [...seen],
    }),
    plus3: { ...settings.plus3 },
    tape: settings.tape,
  });
}

function applyCount(live: { running: number; seenLow: number; seenMid: number; seenHigh: number; seen: number[] }): void {
  counter.running = live.running;
  counter.seenLow = live.seenLow;
  counter.seenMid = live.seenMid;
  counter.seenHigh = live.seenHigh;
  seen.clear();
  for (const id of live.seen) seen.add(id);
}

function freezeVisibleWithoutCounting(): void {
  const snap = engine.snapshot();
  const hideHole = snap.phase === "PLAYER" || snap.phase === "INSURANCE";
  counter.reset();
  seen.clear();
  const mark = (card?: { id: number }) => {
    if (card) seen.add(card.id);
  };
  for (const hand of snap.hands) {
    for (const card of hand.cards) mark(card);
  }
  if (hideHole) mark(snap.dealer.cards[0]);
  else for (const card of snap.dealer.cards) mark(card);
}

function noteAfterDraw(): void {
  if (engine.shoe.consumeMidRoundShuffle()) freezeVisibleWithoutCounting();
}

function applySave(save: SaveData): void {
  settings = save;
  plus3Last = null;
  plus3Pending = 0;
  if (
    save.live &&
    (save.live.phase === "PLAYER" || save.live.phase === "INSURANCE")
  ) {
    engine = new Engine(save.bankroll, createRules({ dealerHitsSoft17: save.dealerHitsSoft17 }));
    engine.stats = { ...save.stats };
    engine.stats.peakBankroll = Math.max(engine.stats.peakBankroll, engine.bankroll);
    if (engine.restoreLive(save.live)) {
      plus3Last = save.live.plus3Last;
      applyCount(save.live.count);
      return;
    }
  }
  const restored = restoreCash(save);
  engine = new Engine(restored.bankroll, createRules({ dealerHitsSoft17: save.dealerHitsSoft17 }));
  engine.stats = { ...restored.stats };
  engine.stats.peakBankroll = Math.max(engine.stats.peakBankroll, engine.bankroll);
  if (restored.pendingBet > 0 && restored.pendingBet <= engine.bankroll) {
    engine.pendingBet = restored.pendingBet;
    engine.bankroll -= restored.pendingBet;
  }
  if (restored.plus3Pending > 0 && restored.plus3Pending <= engine.bankroll) {
    plus3Pending = restored.plus3Pending;
    engine.bankroll -= restored.plus3Pending;
  }
  resetCount();
}

const seen = new Set<number>();

function noteVisible(snap: EngineSnapshot): void {
  syncVisibleCount(counter, seen, snap);
}

function resetCount(): void {
  counter.reset();
  seen.clear();
}

function rebetAffordable(): boolean {
  return (
    engine.phase === "BETTING" &&
    engine.pendingBet === 0 &&
    plus3Pending === 0 &&
    settings.lastMainBet >= TABLE_MIN &&
    engine.bankroll >= settings.lastMainBet + settings.lastPlus3Bet
  );
}

function settleSound(outcomes: Outcome[], net: number): void {
  if (outcomes.includes("BLACKJACK") && net > 0) {
    sfx.blackjack();
    return;
  }
  if (net > 0) {
    sfx.win();
    return;
  }
  if (net === 0 || outcomes.every((o) => o === "PUSH" || o === "SURRENDER")) {
    sfx.push();
    return;
  }
  if (outcomes.includes("BUST") && !outcomes.some((o) => o === "WIN" || o === "BLACKJACK")) {
    sfx.bust();
    return;
  }
  sfx.lose();
}

let autoOn = false;
let autoActing = false;
let autoTimer: number | null = null;

export const useTable = create<TableState>((set, get) => {
  if (typeof window !== "undefined") {
    applySave(loadSave());
  }

  const publish = (patch: Partial<TableState> = {}) => {
    const snap = engine.snapshot();
    set({
      rev: get().rev + 1,
      snap,
      running: counter.running,
      trueCount: counter.trueCount(snap.shoeRemaining),
      plus3Pending,
      plus3Last,
      plus3Stats: { ...settings.plus3 },
      lastMainBet: settings.lastMainBet,
      lastPlus3Bet: settings.lastPlus3Bet,
      canRebet: rebetAffordable(),
      tape: settings.tape,
      countStake: chooseCountBet(counter.trueCount(snap.shoeRemaining), engine.bankroll, engine.pendingBet),
      mix: shoeMix(snap.shoeDecks, counter),
      ...patch,
    });
    persist();
  };

  const haltAuto = () => {
    if (!autoOn) return;
    autoOn = false;
    if (autoTimer !== null) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    set({ autoplay: false });
  };

  const fromUser = () => {
    if (!autoActing) haltAuto();
  };

  const applyPit = (view: PitView, extra: Partial<TableState> = {}) => {
    tableMode = "pit";
    plus3Pending = view.plus3Pending;
    plus3Last = view.plus3Last;
    set({
      rev: get().rev + 1,
      mode: "pit",
      seated: true,
      snap: viewToSnap(view),
      plus3Pending: view.plus3Pending,
      plus3Last: view.plus3Last,
      lastMainBet: view.lastMainBet,
      lastPlus3Bet: view.lastPlus3Bet,
      canRebet: view.canRebet,
      tape: view.tape,
      running: view.running,
      trueCount: view.trueCount,
      countStake: view.countStake,
      mix: view.mix,
      soft17: view.soft17,
      seedCommit: view.seedCommit,
      seedReveal: view.seedReveal,
      realityCheck: view.realityCheck,
      lossLimit: view.lossLimit,
      rulesPack: view.rulesPack,
      rulesHash: view.rulesHash,
      pitBusy: false,
      ...extra,
    });
    persist();
    if (autoOn) bumpAuto();
  };

  const runPit = async (op: PitOp) => {
    if (pitLock) return;
    pitLock = true;
    set({ pitBusy: true });
    try {
      const view = await tableAction({ data: op });
      applyPit(view);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pit error";
      set({ toast: msg, pitBusy: false });
    } finally {
      pitLock = false;
    }
  };

  const ifPit = (op: PitOp): boolean => {
    if (tableMode !== "pit") return false;
    fromUser();
    void runPit(op);
    return true;
  };

  const bumpAuto = () => {
    if (autoTimer !== null) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    if (!autoOn || typeof window === "undefined") return;
    autoTimer = window.setTimeout(() => get().autoTick(), 720);
  };

  const say = (line: Line) => set({ chatter: line });

  const markUnlocks = (insurancePaid: boolean) => {
    const snap = engine.snapshot();
    const fresh = unlocks(new Set(settings.achievements), snap, {
      insurancePaid,
      openedAt: settings.openedAt,
      plus3Win: Boolean(plus3Last && plus3Last.returned > 0),
      plus3Kind: plus3Last?.kind ?? null,
    });
    if (fresh.length) {
      settings.achievements = [...settings.achievements, ...fresh.map((a) => a.id)];
      set({ toast: fresh[0]!.title, achievements: settings.achievements });
    }
  };

  const afterSettle = (insurancePaid: boolean) => {
    const snap = engine.snapshot();
    noteVisible(snap);
    if (settings.sound) settleSound(snap.lastOutcomes, snap.lastNet);
    const dealerBust = isBust(snap.dealer.cards) && snap.dealer.cards.length > 0;
    say(linesForOutcomes(settings.theme, snap.lastOutcomes, dealerBust, snap.lastNet));
    settings.tape = appendTape(settings.tape, snap.lastOutcomes);
    markUnlocks(insurancePaid);
    if (snap.needsShuffle) {
      resetCount();
      if (settings.sound) sfx.shuffle();
    }
  };

  const resolvePlus3 = () => {
    if (plus3Pending <= 0) {
      plus3Last = null;
      return;
    }
    const stake = plus3Pending;
    plus3Pending = 0;
    const player = engine.player[0]?.cards ?? [];
    const up = engine.dealer.cards[0];
    const result = settlePlus3(player, up, stake);
    plus3Last = result;
    settings.plus3.wagered += stake;
    settings.plus3.returned += result.returned;
    if (result.returned > 0) {
      settings.plus3.wins += 1;
      engine.setBankroll(engine.bankroll + result.returned);
    }
  };

  const placeRebet = (): boolean => {
    if (!rebetAffordable()) return false;
    const main = settings.lastMainBet;
    const side = settings.lastPlus3Bet;
    engine.addBet(main);
    if (side > 0 && engine.bankroll >= side) {
      engine.setBankroll(engine.bankroll - side);
      plus3Pending = side;
    }
    return true;
  };

  return {
    rev: 0,
    snap: engine.snapshot(),
    theme: settings.theme,
    sound: settings.sound,
    hints: settings.hints,
    showCount: settings.showCount,
    soft17: settings.dealerHitsSoft17,
    seated: engine.phase === "PLAYER" || engine.phase === "INSURANCE",
    running: 0,
    trueCount: 0,
    chatter: null,
    toast: null,
    achievements: settings.achievements,
    openedAt: settings.openedAt,
    lastInsurancePaid: false,
    plus3Pending,
    plus3Last: null,
    plus3Stats: { ...settings.plus3 },
    lastMainBet: settings.lastMainBet,
    lastPlus3Bet: settings.lastPlus3Bet,
    canRebet: rebetAffordable(),
    betRail: "main",
    tape: settings.tape,
    countStake: chooseCountBet(counter.trueCount(engine.shoe.remaining()), engine.bankroll, engine.pendingBet),
    mix: shoeMix(engine.shoe.decks, counter),
    autoplay: false,
    mode: "practice",
    pitBusy: false,
    seedCommit: null,
    seedReveal: null,
    realityCheck: false,
    lossLimit: 0,
    rulesPack: null,
    rulesHash: null,

    seat() {
      set({
        seated: true,
        chatter: lineFor(settings.theme, "sit"),
        canRebet: rebetAffordable(),
        plus3Pending,
        lastMainBet: settings.lastMainBet,
        lastPlus3Bet: settings.lastPlus3Bet,
      });
    },

    async openPit() {
      haltAuto();
      try {
        const view = await tableAction({ data: { op: "seat", ageAttest: true } });
        applyPit(view, { chatter: lineFor(settings.theme, "sit") });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Pit error";
        set({ toast: msg });
      }
    },

    refillPit() {
      if (tableMode !== "pit") return;
      void runPit({ op: "refill" });
    },

    ackReality() {
      if (tableMode !== "pit") return;
      void runPit({ op: "ackReality" });
    },

    setLossLimit(amount) {
      if (tableMode !== "pit") return;
      void runPit({ op: "setLossLimit", amount });
    },

    cooloff(hours) {
      if (tableMode !== "pit") return;
      void runPit({ op: "cooloff", hours: hours as 1 | 24 | 72 });
    },

    selfExclude(days) {
      if (tableMode !== "pit") return;
      void runPit({ op: "selfExclude", days: days as 1 | 7 | 30 });
    },

    setBetRail(r) {
      set({ betRail: r });
    },

    addChip(n) {
      if (ifPit({ op: "addChip", n, rail: get().betRail })) return;
      fromUser();
      if (engine.phase !== "BETTING" || !isTableChip(n) || engine.bankroll < n) return;
      const rail = get().betRail;
      if (rail === "plus3") {
        if (plus3Pending + n > engine.pendingBet) return;
        engine.setBankroll(engine.bankroll - n);
        plus3Pending += n;
      } else {
        if (!engine.canBet(n)) return;
        engine.addBet(n);
      }
      if (settings.sound) sfx.chip();
      publish();
    },

    clearBet() {
      if (ifPit({ op: "clearBet" })) return;
      fromUser();
      engine.clearBet();
      if (plus3Pending > 0) {
        engine.setBankroll(engine.bankroll + plus3Pending);
        plus3Pending = 0;
      }
      publish();
    },

    rebet() {
      if (tableMode === "pit") {
        fromUser();
        void runPit({ op: "rebet" });
        return true;
      }
      fromUser();
      if (!placeRebet()) return false;
      if (settings.sound) sfx.chip();
      publish();
      return true;
    },

    rebetDeal() {
      if (ifPit({ op: "rebetDeal" })) return;
      fromUser();
      if (engine.canDeal) {
        get().deal();
        return;
      }
      if (!placeRebet()) return;
      if (settings.sound) sfx.chip();
      get().deal();
    },

    countBet() {
      if (ifPit({ op: "countBet" })) return;
      fromUser();
      if (engine.phase !== "BETTING") return;
      const target = chooseCountBet(
        counter.trueCount(engine.shoe.remaining()),
        engine.bankroll,
        engine.pendingBet,
      );
      const need = target - engine.pendingBet;
      if (need <= 0 || !engine.canBet(need)) {
        publish();
        return;
      }
      engine.addBet(need);
      if (settings.sound) sfx.chip();
      publish();
    },

    deal() {
      if (ifPit({ op: "deal" })) return;
      fromUser();
      if (!engine.canDeal) return;
      const before = engine.shoe.needsShuffle();
      if (before) resetCount();
      const main = engine.pendingBet;
      if (plus3Pending > main) {
        engine.setBankroll(engine.bankroll + (plus3Pending - main));
        plus3Pending = main;
      }
      const side = plus3Pending;
      engine.deal();
      noteAfterDraw();
      settings.lastMainBet = main;
      settings.lastPlus3Bet = side;
      resolvePlus3();
      const snap = engine.snapshot();
      noteVisible(snap);
      if (before) {
        if (settings.sound) sfx.shuffle();
        say(lineFor(settings.theme, "new_shoe"));
      } else {
        say(lineFor(settings.theme, "deal"));
      }
      if (settings.sound) sfx.deal();
      if (plus3Last && plus3Last.returned > 0) {
        if (settings.sound) sfx.win();
        say(lineFor(settings.theme, "plus3"));
      }
      if (snap.phase === "INSURANCE") say(lineFor(settings.theme, "insurance"));
      if (snap.phase === "BETTING") afterSettle(false);
      else if (plus3Last && plus3Last.returned > 0) markUnlocks(false);
      publish({ betRail: "main" });
    },

    hit() {
      if (ifPit({ op: "hit" })) return;
      fromUser();
      if (!engine.canHit) return;
      engine.hit();
      noteAfterDraw();
      const snap = engine.snapshot();
      noteVisible(snap);
      if (settings.sound) sfx.hit();
      say(lineFor(settings.theme, "hit"));
      if (snap.phase === "BETTING") afterSettle(false);
      publish();
    },

    stand() {
      if (ifPit({ op: "stand" })) return;
      fromUser();
      if (!engine.canStand) return;
      engine.stand();
      noteAfterDraw();
      const snap = engine.snapshot();
      noteVisible(snap);
      say(lineFor(settings.theme, "stand"));
      if (snap.phase === "BETTING") afterSettle(false);
      publish();
    },

    double() {
      if (ifPit({ op: "double" })) return;
      fromUser();
      if (!engine.canDouble) return;
      engine.doubleDown();
      noteAfterDraw();
      const snap = engine.snapshot();
      noteVisible(snap);
      if (settings.sound) sfx.chip();
      say(lineFor(settings.theme, "double"));
      if (snap.phase === "BETTING") afterSettle(false);
      publish();
    },

    split() {
      if (ifPit({ op: "split" })) return;
      fromUser();
      if (!engine.canSplit) return;
      engine.split();
      noteAfterDraw();
      const snap = engine.snapshot();
      noteVisible(snap);
      say(lineFor(settings.theme, "split"));
      if (snap.phase === "BETTING") afterSettle(false);
      publish();
    },

    surrender() {
      if (ifPit({ op: "surrender" })) return;
      fromUser();
      if (!engine.canSurrender) return;
      engine.surrender();
      afterSettle(false);
      publish();
    },

    insure(yes) {
      if (ifPit({ op: "insure", yes })) return;
      fromUser();
      if (engine.phase !== "INSURANCE") return;
      const natural = engine.player[0] ? isBlackjack(engine.player[0]) : false;
      if (yes && !natural && !engine.canInsure) return;
      const premium = yes && !natural ? Math.floor(engine.player[0]!.bet / 2) : 0;
      engine.takeInsurance(yes);
      noteAfterDraw();
      const snap = engine.snapshot();
      noteVisible(snap);
      const paid = yes && !natural && snap.lastOutcomes.length > 0 && handValue(snap.dealer.cards) === 21;
      if (yes && settings.sound) sfx.chip();
      if (snap.phase === "BETTING") afterSettle(paid && premium > 0);
      publish({ lastInsurancePaid: paid });
    },

    setTheme(t) {
      const allowed: ThemeId[] = ["midnight", "abyss", "crimson", "glacier", "classic"];
      if (!allowed.includes(t)) return;
      settings.theme = t;
      set({ theme: t });
      persist();
    },

    setSound(v) {
      settings.sound = v;
      set({ sound: v });
      persist();
    },

    setHints(v) {
      settings.hints = v;
      set({ hints: v });
      persist();
    },

    setShowCount(v) {
      settings.showCount = v;
      set({ showCount: v });
      persist();
    },

    setSoft17(v) {
      if (ifPit({ op: "setSoft17", v })) return;
      if (engine.phase !== "BETTING") return;
      settings.dealerHitsSoft17 = v;
      engine.rules.dealerHitsSoft17 = v;
      set({ soft17: v });
      persist();
      publish();
    },

    setAutoplay(v) {
      if (v === autoOn) return;
      if (!v) {
        haltAuto();
        return;
      }
      autoOn = true;
      settings.showCount = true;
      settings.hints = true;
      persist();
      set({ autoplay: true, showCount: true, hints: true });
      bumpAuto();
    },

    autoTick() {
      if (!autoOn) return;
      if (tableMode === "pit" && pitLock) {
        bumpAuto();
        return;
      }
      const st = get();
      const snap = st.snap;
      const step = nextAutoStep({
        phase: snap.phase,
        canDeal: snap.canDeal,
        canInsure: snap.canInsure,
        canEvenMoney: snap.canEvenMoney,
        pendingBet: snap.pendingBet,
        bankroll: snap.bankroll,
        countStake: st.countStake,
        trueCount: st.trueCount,
        canHit: snap.canHit,
        canStand: snap.canStand,
        canDouble: snap.canDouble,
        canSplit: snap.canSplit,
        canSurrender: snap.canSurrender,
        hand: snap.hands[snap.activeIndex],
        up: snap.dealer.cards[0],
        soft17: st.soft17,
      });
      if (step.kind === "stop") {
        haltAuto();
        return;
      }
      autoActing = true;
      try {
        if (step.kind === "countBet") get().countBet();
        else if (step.kind === "deal") get().deal();
        else if (step.kind === "insure") get().insure(step.yes);
        else if (step.kind === "act") {
          if (step.action === "HIT") get().hit();
          else if (step.action === "STAND") get().stand();
          else if (step.action === "DOUBLE") get().double();
          else if (step.action === "SPLIT") get().split();
          else if (step.action === "SURRENDER") get().surrender();
        }
      } finally {
        autoActing = false;
      }
      if (autoOn) bumpAuto();
    },

    newSession() {
      haltAuto();
      if (tableMode === "pit") {
        void runPit({ op: "newSession" });
        return;
      }
      engine.newSession(STARTING_BANKROLL);
      resetCount();
      plus3Pending = 0;
      plus3Last = null;
      settings.openedAt = STARTING_BANKROLL;
      settings.stats = { ...engine.stats };
      settings.lastMainBet = 0;
      settings.lastPlus3Bet = 0;
      settings.plus3 = { wagered: 0, returned: 0, wins: 0 };
      settings.tape = [];
      set({
        openedAt: STARTING_BANKROLL,
        chatter: lineFor(settings.theme, "sit"),
        betRail: "main",
        tape: [],
      });
      publish();
    },

    dismissToast() {
      set({ toast: null });
    },
  };
});

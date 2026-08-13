import type { ThemeId } from "./types";
import { STARTING_BANKROLL } from "./types";
import { sanitizeTape, type TapeMark } from "./tape";
import { asInt, clampMoney, MAX_MONEY, TABLE_MAX } from "./money";
import { CATALOG } from "./achievements";
import { parseLive, type LiveRound } from "./live";

const KEY = "blackjack-pro-v1";
const THEMES: ThemeId[] = ["midnight", "abyss", "crimson", "glacier", "classic"];
const ACHIEVEMENT_IDS = new Set(CATALOG.map((a) => a.id));
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export interface Plus3Save {
  wagered: number;
  returned: number;
  wins: number;
}

export interface SaveData {
  version: 1;
  bankroll: number;
  openedAt: number;
  theme: ThemeId;
  dealerHitsSoft17: boolean;
  sound: boolean;
  hints: boolean;
  showCount: boolean;
  lastMainBet: number;
  lastPlus3Bet: number;
  pendingBet: number;
  plus3Pending: number;
  /** Live hand + insurance while a round is open. Fallback if `live` is corrupt. */
  inPlay: number;
  /** Full mid-hand table. When present and valid, resume instead of refunding. */
  live: LiveRound | null;
  plus3: Plus3Save;
  tape: TapeMark[];
  achievements: string[];
  stats: {
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
  };
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    bankroll: STARTING_BANKROLL,
    openedAt: STARTING_BANKROLL,
    theme: "midnight",
    dealerHitsSoft17: false,
    sound: true,
    hints: false,
    showCount: false,
    lastMainBet: 0,
    lastPlus3Bet: 0,
    pendingBet: 0,
    plus3Pending: 0,
    inPlay: 0,
    live: null,
    plus3: { wagered: 0, returned: 0, wins: 0 },
    tape: [],
    achievements: [],
    stats: {
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
      peakBankroll: STARTING_BANKROLL,
    },
  };
}

function asBool(n: unknown, fallback: boolean): boolean {
  return typeof n === "boolean" ? n : fallback;
}

function jsonReviver(key: string, value: unknown): unknown {
  if (DANGEROUS_KEYS.has(key)) return undefined;
  return value;
}

function getStorage(): Storage | null {
  try {
    const g = globalThis as { window?: { localStorage?: Storage }; localStorage?: Storage };
    return g.window?.localStorage ?? g.localStorage ?? null;
  } catch {
    return null;
  }
}

function sanitizeAchievements(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id === "string" && ACHIEVEMENT_IDS.has(id) && !out.includes(id)) {
      out.push(id);
    }
    if (out.length >= CATALOG.length) break;
  }
  return out;
}

function pickTheme(raw: unknown): ThemeId {
  return THEMES.includes(raw as ThemeId) ? (raw as ThemeId) : "midnight";
}

export function loadSave(): SaveData {
  const storage = getStorage();
  if (!storage) return defaultSave();
  try {
    const raw = storage.getItem(KEY);
    if (!raw || raw.length > 120_000) return defaultSave();
    const parsed = JSON.parse(raw, jsonReviver) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaultSave();
    const src = parsed as Record<string, unknown>;
    if (src.version !== 1) return defaultSave();
    const base = defaultSave();
    const statsIn = (src.stats && typeof src.stats === "object" ? src.stats : {}) as Record<string, unknown>;
    const plus3In = (src.plus3 && typeof src.plus3 === "object" ? src.plus3 : {}) as Record<string, unknown>;
    return {
      version: 1,
      theme: pickTheme(src.theme),
      bankroll: asInt(src.bankroll, base.bankroll),
      openedAt: asInt(src.openedAt, base.openedAt),
      dealerHitsSoft17: asBool(src.dealerHitsSoft17, base.dealerHitsSoft17),
      sound: asBool(src.sound, base.sound),
      hints: asBool(src.hints, base.hints),
      showCount: asBool(src.showCount, base.showCount),
      lastMainBet: asInt(src.lastMainBet, 0, TABLE_MAX),
      lastPlus3Bet: asInt(src.lastPlus3Bet, 0, TABLE_MAX),
      pendingBet: asInt(src.pendingBet, 0, TABLE_MAX),
      plus3Pending: asInt(src.plus3Pending, 0, TABLE_MAX),
      inPlay: asInt(src.inPlay, 0, TABLE_MAX * 8),
      live: parseLive(src.live),
      plus3: {
        wagered: asInt(plus3In.wagered, 0),
        returned: asInt(plus3In.returned, 0),
        wins: asInt(plus3In.wins, 0),
      },
      tape: sanitizeTape(src.tape),
      achievements: sanitizeAchievements(src.achievements),
      stats: {
        hands: asInt(statsIn.hands, 0),
        wins: asInt(statsIn.wins, 0),
        losses: asInt(statsIn.losses, 0),
        pushes: asInt(statsIn.pushes, 0),
        blackjacks: asInt(statsIn.blackjacks, 0),
        busts: asInt(statsIn.busts, 0),
        doubles: asInt(statsIn.doubles, 0),
        splits: asInt(statsIn.splits, 0),
        surrenders: asInt(statsIn.surrenders, 0),
        totalWagered: asInt(statsIn.totalWagered, 0),
        totalReturned: asInt(statsIn.totalReturned, 0),
        peakBankroll: asInt(statsIn.peakBankroll, STARTING_BANKROLL),
      },
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const payload: SaveData = {
      version: 1,
      bankroll: clampMoney(data.bankroll),
      openedAt: clampMoney(data.openedAt),
      theme: pickTheme(data.theme),
      dealerHitsSoft17: Boolean(data.dealerHitsSoft17),
      sound: Boolean(data.sound),
      hints: Boolean(data.hints),
      showCount: Boolean(data.showCount),
      lastMainBet: clampMoney(data.lastMainBet, TABLE_MAX),
      lastPlus3Bet: clampMoney(data.lastPlus3Bet, TABLE_MAX),
      pendingBet: clampMoney(data.pendingBet, TABLE_MAX),
      plus3Pending: clampMoney(data.plus3Pending, TABLE_MAX),
      inPlay: clampMoney(data.inPlay, TABLE_MAX * 8),
      live: data.live ? parseLive(data.live) : null,
      plus3: {
        wagered: clampMoney(data.plus3.wagered),
        returned: clampMoney(data.plus3.returned),
        wins: clampMoney(data.plus3.wins),
      },
      tape: sanitizeTape(data.tape),
      achievements: sanitizeAchievements(data.achievements),
      stats: {
        hands: clampMoney(data.stats.hands),
        wins: clampMoney(data.stats.wins),
        losses: clampMoney(data.stats.losses),
        pushes: clampMoney(data.stats.pushes),
        blackjacks: clampMoney(data.stats.blackjacks),
        busts: clampMoney(data.stats.busts),
        doubles: clampMoney(data.stats.doubles),
        splits: clampMoney(data.stats.splits),
        surrenders: clampMoney(data.stats.surrenders),
        totalWagered: clampMoney(data.stats.totalWagered),
        totalReturned: clampMoney(data.stats.totalReturned),
        peakBankroll: clampMoney(data.stats.peakBankroll),
      },
    };
    storage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export interface RestoredTable {
  bankroll: number;
  pendingBet: number;
  plus3Pending: number;
  stats: SaveData["stats"];
}

/**
 * Rebuild a betting-round tray from a save. Chips already in a live hand
 * (or insurance) are folded back into cash and that unfinished round is
 * dropped from the ledger so a refresh cannot steal the stake.
 */
export function restoreCash(save: SaveData): RestoredTable {
  const stats = { ...save.stats };
  let bankroll = clampMoney(save.bankroll);
  let pendingBet = clampMoney(save.pendingBet, TABLE_MAX);
  let plus3Pending = clampMoney(save.plus3Pending, TABLE_MAX);
  const inPlay = clampMoney(save.inPlay, TABLE_MAX * 8);
  if (inPlay > 0) {
    bankroll = clampMoney(bankroll + inPlay);
    stats.hands = Math.max(0, stats.hands - 1);
    stats.totalWagered = Math.max(0, stats.totalWagered - inPlay);
    pendingBet = 0;
    plus3Pending = 0;
  }
  if (pendingBet + plus3Pending > bankroll) {
    pendingBet = 0;
    plus3Pending = 0;
  }
  return { bankroll, pendingBet, plus3Pending, stats };
}

export function liveInPlay(
  phase: string,
  insuranceBet: number,
  hands: { bet: number }[],
): number {
  if (phase === "BETTING") return 0;
  return clampMoney(
    Math.max(0, insuranceBet) + hands.reduce((sum, h) => sum + Math.max(0, h.bet), 0),
    TABLE_MAX * 8,
  );
}

export { MAX_MONEY };

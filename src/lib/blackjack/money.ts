import { CHIP_VALUES } from "./types";

/** Vegas-style 6-deck box. $1 chips still build the bet. */
export const TABLE_MIN = 5;
export const TABLE_MAX = 500;
/** Hard cap on any stored cash figure so a poisoned save cannot overflow. */
export const MAX_MONEY = 1_000_000;

export function isChipAmount(n: unknown): n is number {
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0;
}

export function isTableChip(n: unknown): n is number {
  return isChipAmount(n) && (CHIP_VALUES as readonly number[]).includes(n);
}

export function clampMoney(n: number, max = MAX_MONEY): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(0, Math.floor(n)));
}

export function asInt(n: unknown, fallback: number, max = MAX_MONEY): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return clampMoney(n, max);
}

/** Main-box stake after adding `amount`. */
export function fitsTableMax(pending: number, amount: number): boolean {
  return isChipAmount(amount) && pending + amount <= TABLE_MAX;
}

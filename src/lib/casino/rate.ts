const WINDOW_MS = 60_000;
const BURST_MS = 1_000;
const MAX_PER_MINUTE = 80;
const MAX_BURST = 8;

const hits = new Map<string, number[]>();

/** In-process throttle. Sync/seat are free. */
export function assertRate(userId: string, op: string): void {
  if (op === "sync" || op === "seat") return;
  const now = Date.now();
  const prev = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (prev.filter((t) => now - t < BURST_MS).length >= MAX_BURST) {
    throw new Error("Slow down.");
  }
  if (prev.length >= MAX_PER_MINUTE) {
    throw new Error("Slow down.");
  }
  prev.push(now);
  hits.set(userId, prev);
  if (hits.size > 4000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
}

export function _resetRateForTests(): void {
  hits.clear();
}

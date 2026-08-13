import { REALITY_MS, REALITY_WARN_MS } from "./types";

export function needsRealityAck(
  sessionStartedAt: number,
  lastRealityAckAt: number,
  now = Date.now(),
): boolean {
  const last = Math.max(sessionStartedAt, lastRealityAckAt);
  return now - last >= REALITY_MS;
}

export function needsRealityWarn(
  sessionStartedAt: number,
  lastRealityAckAt: number,
  now = Date.now(),
): boolean {
  const last = Math.max(sessionStartedAt, lastRealityAckAt);
  const elapsed = now - last;
  return elapsed >= REALITY_WARN_MS && elapsed < REALITY_MS;
}

export function formatSeated(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  if (total <= 0) return `${Math.max(0, Math.floor(ms / 1000))}s`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

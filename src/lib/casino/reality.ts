import { REALITY_MS } from "./types";

export function needsRealityAck(
  sessionStartedAt: number,
  lastRealityAckAt: number,
  now = Date.now(),
): boolean {
  const last = Math.max(sessionStartedAt, lastRealityAckAt);
  return now - last >= REALITY_MS;
}

export function formatSeated(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

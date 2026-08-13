import { REALITY_MS } from "./types";

export function needsRealityAck(
  sessionStartedAt: number,
  lastRealityAckAt: number,
  now = Date.now(),
): boolean {
  const last = Math.max(sessionStartedAt, lastRealityAckAt);
  return now - last >= REALITY_MS;
}

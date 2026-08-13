const KEY = "blackjack-pro-device";

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stable per-browser id. Bound to the pit seat on first sit. */
export function pitDevice(): string {
  try {
    const g = globalThis as { localStorage?: Storage };
    const store = g.localStorage;
    if (!store) return randomHex(16);
    const existing = store.getItem(KEY);
    if (existing && /^[0-9a-f]{32}$/.test(existing)) return existing;
    const id = randomHex(16);
    store.setItem(KEY, id);
    return id;
  } catch {
    return randomHex(16);
  }
}

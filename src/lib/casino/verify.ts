export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** SHA-256 of the seed bytes — same as the server commit. */
export async function commitFromSeed(seed: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", hexToBytes(seed));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isSeedHex(raw: string): boolean {
  return /^[0-9a-f]{64}$/.test(raw);
}

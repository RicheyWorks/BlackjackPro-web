let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  return ctx;
}

export function unlockAudio(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  unlocked = true;
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain = 0.18,
  delay = 0,
  slide?: number,
): void {
  const c = getCtx();
  if (!c || !master || !unlocked) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

export const sfx = {
  chip() {
    tone(420, 0.07, "triangle", 0.1);
    tone(680, 0.05, "sine", 0.06, 0.02);
  },
  deal() {
    tone(220 + Math.random() * 40, 0.08, "triangle", 0.08);
  },
  hit() {
    tone(260, 0.09, "triangle", 0.1);
  },
  win() {
    tone(440, 0.14, "sine", 0.12);
    tone(554, 0.16, "sine", 0.1, 0.07);
    tone(659, 0.22, "sine", 0.1, 0.14);
  },
  blackjack() {
    tone(392, 0.12, "sine", 0.12);
    tone(523, 0.16, "sine", 0.11, 0.08);
    tone(659, 0.2, "sine", 0.11, 0.16);
    tone(784, 0.28, "triangle", 0.09, 0.24);
  },
  lose() {
    tone(220, 0.18, "sine", 0.1, 0, 140);
  },
  bust() {
    tone(180, 0.16, "sawtooth", 0.05, 0, 90);
  },
  push() {
    tone(330, 0.1, "triangle", 0.08);
    tone(330, 0.1, "triangle", 0.06, 0.12);
  },
  shuffle() {
    tone(180, 0.05, "triangle", 0.05);
    tone(240, 0.05, "triangle", 0.05, 0.04);
    tone(200, 0.05, "triangle", 0.05, 0.08);
    tone(280, 0.08, "triangle", 0.05, 0.12);
  },
};

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && ctx?.state === "suspended") {
      void ctx.resume();
    }
  });
}

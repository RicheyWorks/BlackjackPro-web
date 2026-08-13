import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTable } from "@/store/table";
import { CATALOG } from "@/lib/blackjack/achievements";
import { dollars } from "@/lib/utils";
import type { ThemeId } from "@/lib/blackjack/types";
import { cn } from "@/lib/utils";
import { fetchHands, fetchPitStats, fetchWallet } from "@/lib/casino/api";
import type { HandRow, LedgerRow, PitStats } from "@/lib/casino/types";
import { TABLE_MIN } from "@/lib/blackjack/money";
import { handProof, ledgerExport } from "@/lib/casino/history";
import { formatSeated } from "@/lib/casino/reality";
import { commitFromSeed, isSeedHex } from "@/lib/casino/verify";
import { PlayingCard } from "./PlayingCard";
import { handLabel } from "@/lib/blackjack/hand";

const THEMES: { id: ThemeId; name: string; note: string }[] = [
  { id: "midnight", name: "Midnight", note: "Ink forest · pirate rail" },
  { id: "classic", name: "Classic", note: "Deep felt" },
  { id: "abyss", name: "Abyss", note: "Reef water" },
  { id: "crimson", name: "Crimson", note: "Society rooms" },
  { id: "glacier", name: "Glacier", note: "Cool stone" },
];

export function SettingsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const theme = useTable((s) => s.theme);
  const sound = useTable((s) => s.sound);
  const hints = useTable((s) => s.hints);
  const showCount = useTable((s) => s.showCount);
  const soft17 = useTable((s) => s.soft17);
  const snap = useTable((s) => s.snap);
  const setTheme = useTable((s) => s.setTheme);
  const setSound = useTable((s) => s.setSound);
  const setHints = useTable((s) => s.setHints);
  const setShowCount = useTable((s) => s.setShowCount);
  const setSoft17 = useTable((s) => s.setSoft17);
  const newSession = useTable((s) => s.newSession);
  const mode = useTable((s) => s.mode);
  const refillPit = useTable((s) => s.refillPit);
  const setLossLimit = useTable((s) => s.setLossLimit);
  const cooloff = useTable((s) => s.cooloff);
  const selfExclude = useTable((s) => s.selfExclude);
  const lossLimit = useTable((s) => s.lossLimit);
  const plus3Pending = useTable((s) => s.plus3Pending);
  const seedCommit = useTable((s) => s.seedCommit);
  const seedReveal = useTable((s) => s.seedReveal);
  const lastSeedCommit = useTable((s) => s.lastSeedCommit);
  const seedOk = useTable((s) => s.seedOk);
  const cooloffUntil = useTable((s) => s.cooloffUntil);
  const selfExcludedUntil = useTable((s) => s.selfExcludedUntil);
  const sessionNet = useTable((s) => s.sessionNet);
  const rulesPack = useTable((s) => s.rulesPack);
  const [pendingRail, setPendingRail] = useState<string | null>(null);

  const askRail = (id: string, run: () => void) => {
    if (pendingRail === id) {
      run();
      setPendingRail(null);
      return;
    }
    setPendingRail(id);
    window.setTimeout(() => setPendingRail((p) => (p === id ? null : p)), 4000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Table">
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-[0.7rem] uppercase tracking-[0.16em] text-muted">Felt</h3>
          <div className="grid grid-cols-1 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={cn(
                  "flex items-center justify-between rounded-[var(--radius-md)] border px-3 py-2.5 text-left",
                  theme === t.id ? "border-ivory/40 bg-fg/8" : "border-border hover:bg-fg/5",
                )}
              >
                <span className="text-sm text-ivory">{t.name}</span>
                <span className="text-xs text-muted">{t.note}</span>
              </button>
            ))}
          </div>
        </section>

        <Toggle label="Sound" on={sound} onChange={setSound} />
        <Toggle label="Basic-strategy hint" on={hints} onChange={setHints} />
        <Toggle label="Hi-Lo count" on={showCount} onChange={setShowCount} hint="Ramp the stake and deviate from basic when the count says so." />
        <Toggle
          label="Dealer hits soft 17"
          on={soft17}
          onChange={setSoft17}
          disabled={snap.phase !== "BETTING"}
          hint="Off is S17 — the house default. Locks in while a hand is live."
        />

        <section>
          <h3 className="mb-2 text-xs uppercase tracking-[0.16em] text-muted">Keys</h3>
          <p className="font-mono text-xs leading-relaxed text-muted">
            Enter deal · H hit · S stand · D double · P split · R surrender · Y/N insure · C count · A coach · Esc clear
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-[0.7rem] uppercase tracking-[0.16em] text-muted">
            21+3
          </h3>
          <p className="mb-2 text-xs text-muted">
            Optional side bet. Your first two cards plus the dealer up, as
            three-card poker. Paid on the deal — separate from the hand.
          </p>
          <ul className="space-y-1 text-sm text-ivory">
            <li className="flex justify-between gap-4">
              <span>Suited trips</span>
              <span className="font-mono tabular-nums text-muted">100:1</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Straight flush</span>
              <span className="font-mono tabular-nums text-muted">40:1</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Three of a kind</span>
              <span className="font-mono tabular-nums text-muted">30:1</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Straight</span>
              <span className="font-mono tabular-nums text-muted">10:1</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Flush</span>
              <span className="font-mono tabular-nums text-muted">5:1</span>
            </li>
          </ul>
        </section>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            if (mode === "pit") {
              askRail("void", () => {
                newSession();
                onOpenChange(false);
              });
              return;
            }
            newSession();
            onOpenChange(false);
          }}
        >
          {mode === "pit"
            ? pendingRail === "void"
              ? "Tap again to void"
              : "Void the live box"
            : "New session · $1,000"}
        </Button>

        {mode === "pit" && (
          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-[0.7rem] uppercase tracking-[0.16em] text-muted">Pit rails</h3>
            <p className="text-xs leading-relaxed text-muted">
              Play chips. Loss limit, cool-off, and self-exclude are enforced on
              the server. They are not a substitute for a licensed RG programme.
            </p>
            {lossLimit > 0 && (
              <p className="text-sm text-ivory">
                Cap {dollars(Math.max(0, lossLimit - Math.max(0, -sessionNet)))} left
                <span className="text-muted"> · {dollars(Math.max(0, -sessionNet))} of {dollars(lossLimit)} gone</span>
              </p>
            )}
            {untilLeft(cooloffUntil) && (
              <p className="text-sm text-ivory">Cool-off lifts in {untilLeft(cooloffUntil)}</p>
            )}
            {untilLeft(selfExcludedUntil) && (
              <p className="text-sm text-ivory">Self-exclude lifts in {untilLeft(selfExcludedUntil)}</p>
            )}
            {seedCommit && (
              <div className="space-y-1">
                <p className="break-all font-mono text-[0.6rem] text-muted">
                  Live commit {seedCommit.slice(0, 16)}…
                  {rulesPack ? ` · ${rulesPack}` : ""}
                </p>
                {seedReveal && lastSeedCommit ? (
                  <p className="break-all font-mono text-[0.6rem] text-muted">
                    Last shoe {seedOk ? "checks out" : "does not match its commit"} ·{" "}
                    {lastSeedCommit.slice(0, 12)}…
                  </p>
                ) : (
                  <p className="text-[0.6rem] text-muted">
                    The live seed is revealed when this shoe is retired.
                  </p>
                )}
              </div>
            )}
            <SeedCheck lastCommit={lastSeedCommit} liveCommit={seedCommit} />
            <div className="flex flex-wrap gap-2">
              {[0, 100, 250, 500].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setLossLimit(n)}
                  className={cn(
                    "h-11 rounded-[var(--radius-sm)] border px-3 text-xs",
                    lossLimit === n ? "border-ivory/40 text-ivory" : "border-border text-muted",
                  )}
                >
                  {n === 0 ? "No loss cap" : `Cap $${n}`}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="h-11 rounded-[var(--radius-sm)] border border-border px-3 text-xs text-muted" onClick={() => askRail("c1", () => cooloff(1))}>
                {pendingRail === "c1" ? "Confirm 1h" : "Cool-off 1h"}
              </button>
              <button type="button" className="h-11 rounded-[var(--radius-sm)] border border-border px-3 text-xs text-muted" onClick={() => askRail("c24", () => cooloff(24))}>
                {pendingRail === "c24" ? "Confirm 24h" : "Cool-off 24h"}
              </button>
              <button type="button" className="h-11 rounded-[var(--radius-sm)] border border-border px-3 text-xs text-muted" onClick={() => askRail("x7", () => selfExclude(7))}>
                {pendingRail === "x7" ? "Confirm exclude" : "Exclude 7d"}
              </button>
            </div>
            {snap.bankroll + snap.pendingBet + plus3Pending < TABLE_MIN && (
              <Button variant="outline" className="w-full" onClick={() => refillPit()}>
                Bust refill · $1,000 play chips
              </Button>
            )}
          </section>
        )}
      </div>
    </Sheet>
  );
}

export function StatsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const snap = useTable((s) => s.snap);
  const achievements = useTable((s) => s.achievements);
  const plus3 = useTable((s) => s.plus3Stats);
  const mode = useTable((s) => s.mode);
  const rulesPack = useTable((s) => s.rulesPack);
  const rulesHash = useTable((s) => s.rulesHash);
  const s = snap.stats;
  const net = s.totalReturned - s.totalWagered;
  const plus3Net = plus3.returned - plus3.wagered;
  const [hands, setHands] = useState<HandRow[]>([]);
  const [pit, setPit] = useState<PitStats | null>(null);
  const [wallet, setWallet] = useState<LedgerRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || mode !== "pit") return;
    let live = true;
    void Promise.all([fetchHands(), fetchPitStats(), fetchWallet()])
      .then(([h, st, w]) => {
        if (!live) return;
        setHands(h);
        setPit(st);
        setWallet(w);
      })
      .catch(() => {
        if (!live) return;
        setHands([]);
        setPit(null);
        setWallet([]);
      });
    return () => {
      live = false;
    };
  }, [open, mode]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Ledger">
      <dl className="grid grid-cols-2 gap-3">
        <Fact k="Hands" v={String(s.hands)} />
        <Fact k="Wins" v={String(s.wins)} />
        <Fact k="Losses" v={String(s.losses)} />
        <Fact k="Pushes" v={String(s.pushes)} />
        <Fact k="Naturals" v={String(s.blackjacks)} />
        <Fact k="Busts" v={String(s.busts)} />
        <Fact k="Doubles" v={String(s.doubles)} />
        <Fact k="Splits" v={String(s.splits)} />
        <Fact k="Surrenders" v={String(s.surrenders)} />
        <Fact k="Wagered" v={dollars(s.totalWagered)} />
        <Fact k="Returned" v={dollars(s.totalReturned)} />
        <Fact k="Net" v={dollars(net)} />
        <Fact k="Peak" v={dollars(s.peakBankroll)} />
        <Fact k="21+3 wins" v={String(plus3.wins)} />
        <Fact k="21+3 net" v={dollars(plus3Net)} />
      </dl>
      {mode === "pit" && pit && (
        <section className="mt-6">
          <h3 className="mb-2 text-[0.7rem] uppercase tracking-[0.16em] text-muted">Pit</h3>
          <dl className="grid grid-cols-2 gap-3">
            <Fact k="Logged hands" v={String(pit.hands)} />
            <Fact k="Last hour" v={String(pit.lastHourHands)} />
            <Fact k="RTP" v={pit.rtp === null ? "—" : `${(pit.rtp * 100).toFixed(1)}%`} />
            <Fact k="Voids" v={String(pit.voids)} />
          </dl>
          {(rulesPack || pit.rulesPack) && (
            <p className="mt-3 break-all font-mono text-[0.6rem] leading-relaxed text-muted">
              {rulesPack ?? pit.rulesPack}
              {(rulesHash ?? pit.rulesHash) ? ` · ${(rulesHash ?? pit.rulesHash).slice(0, 12)}…` : ""}
            </p>
          )}
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={() => {
              const blob = new Blob(
                [
                  ledgerExport({
                    rulesPack: rulesPack ?? pit.rulesPack,
                    rulesHash: rulesHash ?? pit.rulesHash,
                    pit,
                    hands,
                    wallet,
                  }),
                ],
                { type: "application/json" },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "blackjack-pro-ledger.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download ledger
          </Button>
        </section>
      )}
      {mode === "pit" && wallet.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-[0.7rem] uppercase tracking-[0.16em] text-muted">Cash tape</h3>
          <ul className="space-y-1.5">
            {wallet.map((row, i) => (
              <li key={`${row.at}-${i}`} className="flex items-baseline justify-between gap-3 font-mono text-[0.7rem]">
                <span className="text-muted">{kindLabel(row.kind)}</span>
                <span className="tabular-nums text-ivory">
                  {row.amount > 0 ? "+" : ""}
                  {dollars(row.amount)}
                  <span className="ml-2 text-muted">{dollars(row.balanceAfter)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {mode === "pit" && hands.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-[0.7rem] uppercase tracking-[0.16em] text-muted">Hands</h3>
          <ul className="space-y-2">
            {hands.map((h) => {
              const open = openId === h.id;
              return (
                <li key={h.id} className="rounded-[var(--radius-sm)] border border-border">
                  <button
                    type="button"
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left"
                    onClick={() => setOpenId(open ? null : h.id)}
                    aria-expanded={open}
                  >
                    <p className="flex justify-between gap-3 text-sm text-ivory">
                      <span>{h.outcomes || h.status}</span>
                      <span className="font-mono tabular-nums">{dollars(h.net)}</span>
                    </p>
                    <p className="font-mono text-[0.6rem] text-muted">
                      ${h.mainBet}
                      {h.plus3Bet ? ` +21+3 $${h.plus3Bet}` : ""}
                      {h.insuranceBet ? ` · ins $${h.insuranceBet}` : ""} ·{" "}
                      {h.rulesPack || h.rulesHash.slice(0, 8)}
                    </p>
                  </button>
                  {open && <HandReplay hand={h} />}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <h3 className="mt-6 mb-2 text-[0.7rem] uppercase tracking-[0.16em] text-muted">
        Marks
      </h3>
      <ul className="space-y-2">
        {CATALOG.map((a) => {
          const got = achievements.includes(a.id);
          return (
            <li
              key={a.id}
              className={cn(
                "rounded-[var(--radius-sm)] border px-3 py-2",
                got ? "border-ivory/30 bg-fg/6" : "border-border opacity-50",
              )}
            >
              <p className="text-sm text-ivory">{a.title}</p>
              <p className="text-xs text-muted">{a.detail}</p>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

function HandReplay({ hand }: { hand: HandRow }) {
  const hideHole = hand.status !== "settled";
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3 border-t border-border px-3 py-3">
      {hand.dealer && (
        <div>
          <p className="mb-1 text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            Dealer{hideHole ? "" : ` · ${handLabel(hand.dealer.cards)}`}
          </p>
          <div className="flex">
            {hand.dealer.cards.map((c, i) => (
              <div key={c.id} className="-ml-5 first:ml-0">
                <PlayingCard card={c} hidden={hideHole && i === 1} compact delay={0} />
              </div>
            ))}
            {hideHole && hand.dealer.cards.length < 2 && (
              <div className="-ml-5 first:ml-0">
                <PlayingCard hidden compact delay={0} />
              </div>
            )}
          </div>
        </div>
      )}
      {hand.player.map((box, i) => (
        <div key={i}>
          <p className="mb-1 text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            {hand.player.length > 1 ? `Hand ${i + 1}` : "You"}
            {box.cards.length ? ` · ${handLabel(box.cards)}` : ""}
            {box.bet ? ` · ${dollars(box.bet)}` : ""}
          </p>
          <div className="flex">
            {box.cards.map((c) => (
              <div key={c.id} className="-ml-5 first:ml-0">
                <PlayingCard card={c} compact delay={0} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {hand.actions.length > 0 && (
        <p className="font-mono text-[0.6rem] tracking-wide text-muted">
          {hand.actions.map(actionLabel).join(" · ")}
        </p>
      )}
      <p className="font-mono text-[0.6rem] leading-relaxed text-muted">
        Wagered {dollars(hand.wagered)} · returned {dollars(hand.returned)}
        {hand.seedReveal
          ? ` · shoe ${hand.seedOk ? "checks out" : "does not match"}`
          : " · seed hidden until this shoe is cut"}
      </p>
      <button
        type="button"
        className="h-11 rounded-[var(--radius-sm)] border border-border px-3 text-xs uppercase tracking-[0.14em] text-muted hover:bg-fg/6"
        onClick={() => {
          void navigator.clipboard?.writeText(handProof(hand)).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          });
        }}
      >
        {copied ? "Copied" : "Copy proof"}
      </button>
    </div>
  );
}

function untilLeft(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t <= Date.now()) return null;
  return formatSeated(t - Date.now());
}

function SeedCheck({ lastCommit, liveCommit }: { lastCommit: string | null; liveCommit: string | null }) {
  const [hex, setHex] = useState("");
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-[0.7rem] uppercase tracking-[0.16em] text-muted">Check a seed</p>
      <input
        value={hex}
        onChange={(e) => setHex(e.target.value.trim().toLowerCase())}
        spellCheck={false}
        autoComplete="off"
        placeholder="Paste a 64-hex reveal"
        className="h-11 w-full rounded-[var(--radius-sm)] border border-border bg-felt-deep/50 px-3 font-mono text-xs text-ivory placeholder:text-muted focus:border-ivory/30 focus:outline-none"
      />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => {
          void (async () => {
            if (!isSeedHex(hex)) {
              setNote("Need a 64-character hex seed.");
              return;
            }
            const commit = await commitFromSeed(hex);
            if (lastCommit && commit === lastCommit) setNote("Matches the last retired shoe.");
            else if (liveCommit && commit === liveCommit) setNote("That hashes to the live commit.");
            else setNote("Does not match this table.");
          })();
        }}
      >
        Hash and compare
      </Button>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "grant":
      return "Grant";
    case "wager":
      return "Wager";
    case "plus3_wager":
      return "21+3";
    case "insurance":
      return "Insurance";
    case "payout":
      return "Payout";
    case "plus3_payout":
      return "21+3 pay";
    case "refund":
      return "Refund";
    case "even_money":
      return "Even money";
    case "void":
      return "Void";
    default:
      return kind;
  }
}

function actionLabel(op: string): string {
  switch (op) {
    case "rebetDeal":
      return "deal again";
    case "addChip":
      return "chip";
    case "countBet":
      return "count bet";
    case "clearBet":
      return "clear";
    case "newSession":
      return "void";
    default:
      return op;
  }
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-border px-3 py-2">
      <dt className="text-[0.65rem] uppercase tracking-[0.14em] text-muted">{k}</dt>
      <dd className="font-mono text-sm tabular-nums text-ivory">{v}</dd>
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-center justify-between gap-4", disabled && "opacity-50")}>
      <span>
        <span className="block text-sm text-ivory">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-7 w-12 rounded-full border transition-colors disabled:cursor-not-allowed",
          on ? "border-ivory/40 bg-ivory/20" : "border-border bg-fg/8",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-6 rounded-full bg-ivory transition-transform",
            on ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}

function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-felt-deep/70 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[86vh] overflow-y-auto rounded-t-[var(--radius-xl)] border border-border bg-felt-mid p-5 shadow-xl focus:outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[28rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-xl)]">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-display text-xl text-ivory">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-[var(--radius-sm)] text-muted hover:bg-fg/8"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

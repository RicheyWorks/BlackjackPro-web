import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTable } from "@/store/table";
import { CATALOG } from "@/lib/blackjack/achievements";
import { dollars } from "@/lib/utils";
import type { ThemeId } from "@/lib/blackjack/types";
import { cn } from "@/lib/utils";

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
            Enter deal · H hit · S stand · D double · P split · R surrender · C count · A coach · Esc clear
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
            newSession();
            onOpenChange(false);
          }}
        >
          New session · $1,000
        </Button>
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
  const s = snap.stats;
  const net = s.totalReturned - s.totalWagered;
  const plus3Net = plus3.returned - plus3.wagered;

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

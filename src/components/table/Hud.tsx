import { dollars } from "@/lib/utils";
import { useTable } from "@/store/table";
import { UserButton, SignedIn, SignedOut } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Link } from "@tanstack/react-router";

export function Hud({
  onOpenSettings,
  onOpenStats,
}: {
  onOpenSettings: () => void;
  onOpenStats: () => void;
}) {
  const snap = useTable((s) => s.snap);
  const showCount = useTable((s) => s.showCount);
  const running = useTable((s) => s.running);
  const trueCount = useTable((s) => s.trueCount);
  const countStake = useTable((s) => s.countStake);
  const chatter = useTable((s) => s.chatter);
  const autoplay = useTable((s) => s.autoplay);
  const { user, isPending } = useCurrentUserState();

  return (
    <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-6">
      <div>
        <p className="font-display text-xl tracking-tight text-ivory sm:text-2xl">
          Blackjack Pro
        </p>
        <p className="kicker mt-0.5">6-deck · 3:2 · $5–$500</p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Stat label="Bank" value={dollars(snap.bankroll)} />
        <Stat
          label="Shoe"
          value={`${snap.shoeRemaining}`}
          hint={`${snap.shoeDecks} decks`}
        />
        {showCount && (
          <Stat
            label="Hi-Lo"
            value={trueCount.toFixed(1)}
            hint={`RC ${running >= 0 ? "+" : ""}${running} · ${countStake > 0 ? `$${countStake}` : "flat"}`}
          />
        )}
        {autoplay && (
          <span className="inline-flex h-11 items-center rounded-[var(--radius-sm)] border border-ivory/30 px-3 text-xs uppercase tracking-[0.14em] text-ivory">
            Coach
          </span>
        )}
        <button
          type="button"
          onClick={onOpenStats}
          className="h-11 rounded-[var(--radius-sm)] border border-border px-3 text-xs uppercase tracking-[0.14em] text-muted hover:bg-fg/6"
        >
          Ledger
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="h-11 rounded-[var(--radius-sm)] border border-border px-3 text-xs uppercase tracking-[0.14em] text-muted hover:bg-fg/6"
        >
          Table
        </button>
        {isPending ? (
          <div className="h-8 w-20 animate-pulse rounded-full bg-fg/10" />
        ) : user ? (
          <SignedIn>
            <div className="hidden sm:block">
              <UserButton />
            </div>
          </SignedIn>
        ) : (
          <SignedOut>
            <Link
              to="/login"
              className="h-11 inline-flex items-center rounded-[var(--radius-sm)] border border-border px-3 text-xs uppercase tracking-[0.14em] text-muted hover:bg-fg/6"
            >
              Sign in
            </Link>
          </SignedOut>
        )}
      </div>

      {chatter && (
        <blockquote className="w-full max-w-xl text-sm text-muted anim-rise">
          <span className="mr-2 text-[0.65rem] uppercase tracking-[0.16em] text-ivory/70">
            {chatter.speaker}
          </span>
          {chatter.text}
        </blockquote>
      )}
    </header>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-[4.5rem] rounded-[var(--radius-md)] border border-border bg-felt-deep/40 px-3 py-1.5">
      <p className="text-[0.6rem] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="font-mono text-sm tabular-nums text-ivory">{value}</p>
      {hint && <p className="text-[0.6rem] text-muted">{hint}</p>}
    </div>
  );
}

import { CHIP_VALUES } from "@/lib/blackjack/types";
import { TABLE_MAX, TABLE_MIN } from "@/lib/blackjack/money";
import { ChipButton } from "./Chip";
import { useTable } from "@/store/table";
import { dollars } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Betting() {
  const snap = useTable((s) => s.snap);
  const addChip = useTable((s) => s.addChip);
  const plus3Pending = useTable((s) => s.plus3Pending);
  const betRail = useTable((s) => s.betRail);
  const setBetRail = useTable((s) => s.setBetRail);

  if (snap.phase !== "BETTING") return null;

  const short = snap.pendingBet > 0 && snap.pendingBet < TABLE_MIN;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-stretch justify-center gap-2">
        <Rail
          label="Stake"
          amount={snap.pendingBet}
          active={betRail === "main"}
          onClick={() => setBetRail("main")}
        />
        <Rail
          label="21+3"
          amount={plus3Pending}
          active={betRail === "plus3"}
          onClick={() => setBetRail("plus3")}
        />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {CHIP_VALUES.map((v) => {
          const room = betRail === "plus3" ? TABLE_MAX - plus3Pending : TABLE_MAX - snap.pendingBet;
          const enabled = snap.bankroll >= v && v <= room;
          return (
            <ChipButton
              key={v}
              value={v}
              disabled={!enabled}
              onClick={() => addChip(v)}
            />
          );
        })}
      </div>
      <p className="max-w-sm text-center text-[0.65rem] leading-relaxed text-muted">
        {short
          ? `Table minimum ${dollars(TABLE_MIN)}. Add ${dollars(TABLE_MIN - snap.pendingBet)} more to deal.`
          : "Box $5–$500. 21+3 cannot exceed the main stake. Flush 5:1 · straight 10:1 · trips 30:1 · SF 40:1 · suited trips 100:1"}
      </p>
    </div>
  );
}

function Rail({
  label,
  amount,
  active,
  onClick,
}: {
  label: string;
  amount: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-w-[7.5rem] rounded-[var(--radius-md)] border px-4 py-2 text-left transition-colors",
        active ? "border-ivory/40 bg-fg/8" : "border-border hover:bg-fg/5",
      )}
    >
      <span className="block text-[0.65rem] uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <span className="font-display text-2xl tabular-nums tracking-tight text-ivory">
        {dollars(amount)}
      </span>
    </button>
  );
}

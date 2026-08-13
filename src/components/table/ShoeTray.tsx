import { useTable } from "@/store/table";
import { cn } from "@/lib/utils";

export function ShoeTray() {
  const showCount = useTable((s) => s.showCount);
  const mix = useTable((s) => s.mix);
  const snap = useTable((s) => s.snap);
  if (!showCount || !mix) return null;

  const dealt = snap.shoeDealt;
  const total = snap.shoeDecks * 52;
  const pen = total > 0 ? dealt / total : 0;

  return (
    <div className="w-full max-w-md space-y-2 px-2">
      <Bar label="Low 2–6" left={mix.low.left} total={mix.low.total} />
      <Bar label="Mid 7–9" left={mix.mid.left} total={mix.mid.total} />
      <Bar label="High 10–A" left={mix.high.left} total={mix.high.total} />
      <Bar label="Dealt" left={dealt} total={total} fill={pen} invert />
    </div>
  );
}

function Bar({
  label,
  left,
  total,
  fill,
  invert,
}: {
  label: string;
  left: number;
  total: number;
  fill?: number;
  invert?: boolean;
}) {
  const ratio = fill ?? (total > 0 ? left / total : 0);
  return (
    <div className="grid grid-cols-[6.5rem_1fr_3.25rem] items-center gap-2">
      <span className="text-[0.65rem] uppercase tracking-[0.14em] text-muted">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-fg/10">
        <div
          className={cn("h-full rounded-full bg-ivory/45", invert && "bg-ivory/25")}
          style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }}
        />
      </div>
      <span className="text-right font-mono text-[0.65rem] tabular-nums text-muted">
        {invert ? `${Math.round(ratio * 100)}%` : `${left}`}
      </span>
    </div>
  );
}

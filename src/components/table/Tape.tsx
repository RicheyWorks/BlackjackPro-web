import { useTable } from "@/store/table";
import type { TapeMark } from "@/lib/blackjack/tape";
import { cn } from "@/lib/utils";

const COPY: Record<TapeMark, string> = {
  BJ: "BJ",
  W: "W",
  L: "L",
  P: "P",
  S: "S",
  X: "X",
};

export function Tape() {
  const tape = useTable((s) => s.tape);
  if (tape.length === 0) return null;

  return (
    <ol
      className="flex max-w-full flex-wrap justify-center gap-1"
      aria-label="Recent hands"
    >
      {tape.map((mark, i) => (
        <li
          key={`${mark}-${i}`}
          className={cn(
            "grid size-7 place-items-center rounded-[var(--radius-xs)] border font-mono text-[0.65rem] tabular-nums",
            mark === "BJ" || mark === "W"
              ? "border-ivory/35 text-ivory"
              : mark === "P" || mark === "S"
                ? "border-border text-muted"
                : "border-border text-muted/80",
          )}
        >
          {COPY[mark]}
        </li>
      ))}
    </ol>
  );
}

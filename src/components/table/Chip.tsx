import { CHIP_VALUES } from "@/lib/blackjack/types";
import { cn } from "@/lib/utils";

const TONE: Record<(typeof CHIP_VALUES)[number], string> = {
  1: "bg-chip-1 text-card-fg",
  5: "bg-chip-5 text-ivory",
  25: "bg-chip-25 text-ivory",
  100: "bg-chip-100 text-ivory",
  500: "bg-chip-500 text-ivory",
};

export function ChipButton({
  value,
  disabled,
  onClick,
}: {
  value: (typeof CHIP_VALUES)[number];
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "chip text-[0.8rem] transition-transform duration-150 enabled:hover:-translate-y-0.5 enabled:active:scale-95 disabled:opacity-35",
        TONE[value],
      )}
      aria-label={`Add ${value} dollar chip`}
    >
      {value}
    </button>
  );
}

export function StakePile({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  return (
    <div className="flex items-center gap-2 text-ivory">
      <span className="chip bg-chip-25 text-[0.7rem] text-ivory scale-75 origin-left">
        $
      </span>
      <span className="font-mono text-sm tabular-nums tracking-tight">
        {amount.toLocaleString("en-US")}
      </span>
    </div>
  );
}

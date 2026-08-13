import type { HandState, Outcome } from "@/lib/blackjack/types";
import { rankValue } from "@/lib/blackjack/types";
import { handLabel, isBlackjack } from "@/lib/blackjack/hand";
import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";
import { dollars } from "@/lib/utils";

const OUTCOME_COPY: Record<Outcome, string> = {
  BLACKJACK: "Blackjack",
  WIN: "Win",
  PUSH: "Push",
  LOSS: "Loss",
  BUST: "Bust",
  SURRENDER: "Surrender",
};

function holeUpLabel(hand: HandState): string {
  const up = hand.cards[0];
  if (!up) return "";
  return up.rank === "A" ? "A" : String(rankValue(up.rank));
}

export function HandRow({
  hand,
  outcome,
  active,
  hideHole,
  label,
}: {
  hand: HandState;
  outcome?: Outcome;
  active?: boolean;
  hideHole?: boolean;
  label: string;
}) {
  const total = hand.cards.length ? handLabel(hand.cards) : "";
  const shown = hideHole ? holeUpLabel(hand) : total;
  const natural = !hideHole && isBlackjack(hand);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-[var(--radius-lg)] px-3 py-2 transition-colors duration-200",
        active && "bg-fg/6 ring-1 ring-ivory/25",
      )}
    >
      <div className="flex items-baseline gap-2 text-[0.7rem] uppercase tracking-[0.16em] text-muted">
        <span>{label}</span>
        {hand.bet > 0 && (
          <span className="font-mono normal-case tracking-normal text-ivory/80">
            {dollars(hand.bet)}
          </span>
        )}
        {hand.doubled && <span>Doubled</span>}
      </div>
      <div className="flex items-end">
        {hand.cards.map((card, i) => (
          <div
            key={card.id}
            className="-ml-6 first:ml-0"
            style={{ zIndex: i }}
          >
            <PlayingCard card={card} hidden={hideHole && i === 1} delay={i * 70} />
          </div>
        ))}
      </div>
      <div className="flex h-6 items-center gap-2 font-mono text-sm tabular-nums text-ivory">
        {hand.cards.length > 0 && <span>{shown}</span>}
        {natural && <span className="text-[0.7rem] uppercase tracking-[0.14em]">Natural</span>}
        {outcome && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            {OUTCOME_COPY[outcome]}
          </span>
        )}
      </div>
    </div>
  );
}

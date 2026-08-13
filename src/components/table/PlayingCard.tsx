import type { Card, Suit } from "@/lib/blackjack/types";
import { isRed } from "@/lib/blackjack/types";
import { cn } from "@/lib/utils";

function SuitMark({ suit, className }: { suit: Suit; className?: string }) {
  const path =
    suit === "spades"
      ? "M12 2C12 2 4 10 4 14.5A5 5 0 0 0 12 18.5 5 5 0 0 0 20 14.5C20 10 12 2 12 2ZM10 18.5c0 2-1 3.5-4 3.5h12c-3 0-4-1.5-4-3.5"
      : suit === "hearts"
        ? "M12 21S3 14 3 8.5A4.5 4.5 0 0 1 12 6.5 4.5 4.5 0 0 1 21 8.5C21 14 12 21 12 21Z"
        : suit === "diamonds"
          ? "M12 2 21 12 12 22 3 12 12 2Z"
          : "M12 21S5 14.5 5 10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 4.5-7 11-7 11ZM9 21h6c-1.5 0-3-1-3-2s-1.5 2-3 2Z";
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="currentColor" d={path} />
    </svg>
  );
}

export function PlayingCard({
  card,
  hidden,
  delay = 0,
  compact,
}: {
  card?: Card;
  hidden?: boolean;
  delay?: number;
  compact?: boolean;
}) {
  if (hidden || !card) {
    return (
      <div
        className={cn("playing-card playing-card-back anim-card", compact && "scale-90")}
        style={{ animationDelay: `${delay}ms` }}
        aria-label="Facedown card"
      />
    );
  }

  const red = isRed(card.suit);
  return (
    <div
      className={cn("playing-card anim-card relative overflow-hidden p-1.5", compact && "scale-90")}
      style={{ animationDelay: `${delay}ms`, ["--tilt" as string]: `${(card.id % 5) - 2}deg` }}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <div
        className={cn(
          "flex flex-col items-center leading-none",
          red ? "text-suit-red" : "text-card-fg",
        )}
      >
        <span className="font-display text-[1.05rem] font-semibold tracking-tight">
          {card.rank}
        </span>
        <SuitMark suit={card.suit} className="size-3" />
      </div>
      <SuitMark
        suit={card.suit}
        className={cn(
          "absolute right-1.5 bottom-1.5 size-7 opacity-90",
          red ? "text-suit-red" : "text-card-fg",
        )}
      />
    </div>
  );
}

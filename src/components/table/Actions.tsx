import { Button } from "@/components/ui/button";
import { useTable } from "@/store/table";
import { adviceLabel } from "@/lib/blackjack/strategy";
import { coachAdvice, takeInsuranceAt } from "@/lib/blackjack/deviations";
import { isBlackjack } from "@/lib/blackjack/hand";
import { cn } from "@/lib/utils";
import { dollars } from "@/lib/utils";
import type { Advice } from "@/lib/blackjack/strategy";

export function Actions() {
  const snap = useTable((s) => s.snap);
  const hints = useTable((s) => s.hints);
  const showCount = useTable((s) => s.showCount);
  const soft17 = useTable((s) => s.soft17);
  const trueCount = useTable((s) => s.trueCount);
  const canRebet = useTable((s) => s.canRebet);
  const lastMainBet = useTable((s) => s.lastMainBet);
  const lastPlus3Bet = useTable((s) => s.lastPlus3Bet);
  const plus3Pending = useTable((s) => s.plus3Pending);
  const countStake = useTable((s) => s.countStake);
  const hit = useTable((s) => s.hit);
  const stand = useTable((s) => s.stand);
  const double = useTable((s) => s.double);
  const split = useTable((s) => s.split);
  const surrender = useTable((s) => s.surrender);
  const insure = useTable((s) => s.insure);
  const deal = useTable((s) => s.deal);
  const rebet = useTable((s) => s.rebet);
  const rebetDeal = useTable((s) => s.rebetDeal);
  const countBet = useTable((s) => s.countBet);
  const clearBet = useTable((s) => s.clearBet);
  const newSession = useTable((s) => s.newSession);
  const autoplay = useTable((s) => s.autoplay);
  const setAutoplay = useTable((s) => s.setAutoplay);

  if (snap.phase === "INSURANCE") {
    const natural = snap.hands[0] ? isBlackjack(snap.hands[0]) : false;
    const countSaysYes = showCount && takeInsuranceAt(trueCount);
    return (
      <div className="flex flex-col items-center gap-3 anim-rise">
        <p className="text-sm text-muted">
          {natural
            ? "Natural against an ace. Even money locks the even payout."
            : "Dealer shows an ace. Insurance pays 2:1."}
        </p>
        {countSaysYes && (
          <p className="text-xs uppercase tracking-[0.16em] text-muted">
            Hi-Lo · take it at TC +3
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => insure(true)}
            disabled={natural ? !snap.canEvenMoney : !snap.canInsure}
            className={cn(countSaysYes && "ring-1 ring-ivory/40")}
          >
            {natural ? "Even money" : "Insure"}
          </Button>
          <Button variant="ghost" onClick={() => insure(false)}>
            {natural ? "Play it out" : "Decline"}
          </Button>
          {autoplay && (
            <Button variant="ghost" onClick={() => setAutoplay(false)}>
              Stop coach
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (snap.phase === "BETTING") {
    const broke = snap.bankroll <= 0 && snap.pendingBet <= 0 && plus3Pending <= 0 && !canRebet;
    if (broke) {
      return (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted">The rack is empty.</p>
          <Button onClick={newSession} size="lg">
            New session · $1,000
          </Button>
        </div>
      );
    }

    const lastTotal = lastMainBet + lastPlus3Bet;
    const rampReady = showCount && countStake > snap.pendingBet && snap.bankroll >= countStake - snap.pendingBet;
    return (
      <div className="flex flex-wrap justify-center gap-2">
        {snap.canDeal ? (
          <Button onClick={deal} size="lg">
            Deal
          </Button>
        ) : canRebet ? (
          <Button onClick={rebetDeal} size="lg">
            Deal again
            <span className="text-[0.65rem] uppercase tracking-wider opacity-70">
              {dollars(lastTotal)}
            </span>
          </Button>
        ) : (
          <Button onClick={deal} disabled size="lg">
            Deal
          </Button>
        )}
        <Button variant="ghost" onClick={() => rebet()} disabled={!canRebet}>
          Same bet
        </Button>
        {showCount && (
          <Button variant="ghost" onClick={countBet} disabled={!rampReady}>
            Count bet
            <span className="text-[0.65rem] uppercase tracking-wider opacity-70">
              {dollars(countStake)}
            </span>
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={clearBet}
          disabled={snap.pendingBet <= 0 && plus3Pending <= 0}
        >
          Clear
        </Button>
        <Button
          variant={autoplay ? "default" : "ghost"}
          onClick={() => setAutoplay(!autoplay)}
        >
          {autoplay ? "Stop coach" : "Let the coach play"}
        </Button>
      </div>
    );
  }

  if (snap.phase !== "PLAYER") return null;

  const hand = snap.hands[snap.activeIndex];
  const up = snap.dealer.cards[0];
  const coach =
    hints && hand && up
      ? coachAdvice(hand, up, showCount ? trueCount : 0, {
          h17: soft17,
          allowSplit: snap.canSplit,
          allowDouble: snap.canDouble,
          allowSurrender: snap.canSurrender,
        })
      : null;
  const advice = coach?.action ?? null;

  const action = (key: Advice, enabled: boolean, fn: () => void, label: string) => (
    <Button
      key={key}
      variant={advice === key ? "default" : "outline"}
      onClick={fn}
      disabled={!enabled}
      className={cn(advice === key && "ring-1 ring-ivory/40")}
    >
      {label}
      {advice === key && hints ? (
        <span className="text-[0.65rem] uppercase tracking-wider opacity-70">
          {coach?.deviate ? "count" : "hint"}
        </span>
      ) : null}
    </Button>
  );

  return (
    <div className="flex flex-col items-center gap-3">
      {coach && (
        <p className="text-xs uppercase tracking-[0.16em] text-muted">
          {coach.deviate ? `Deviation · ${adviceLabel(coach.action)}` : `Basic strategy · ${adviceLabel(coach.action)}`}
          {coach.note ? ` · ${coach.note}` : ""}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {action("HIT", snap.canHit, hit, "Hit")}
        {action("STAND", snap.canStand, stand, "Stand")}
        {action("DOUBLE", snap.canDouble, double, "Double")}
        {action("SPLIT", snap.canSplit, split, "Split")}
        {action("SURRENDER", snap.canSurrender, surrender, "Surrender")}
      </div>
      <Button
        variant={autoplay ? "default" : "ghost"}
        onClick={() => setAutoplay(!autoplay)}
      >
        {autoplay ? "Stop coach" : "Let the coach play"}
      </Button>
    </div>
  );
}

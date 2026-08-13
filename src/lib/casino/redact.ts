import type { HandState, Phase } from "@/lib/blackjack/types";
import { cloneHand } from "@/lib/blackjack/hand";

/** Drop the hole while it is face-down. Never send a dummy rank. */
export function redactDealer(dealer: HandState, phase: Phase): HandState {
  const copy = cloneHand(dealer);
  if ((phase === "PLAYER" || phase === "INSURANCE") && copy.cards.length > 1) {
    copy.cards = [copy.cards[0]!];
  }
  return copy;
}

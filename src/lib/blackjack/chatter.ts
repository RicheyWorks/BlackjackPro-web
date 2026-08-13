import type { Outcome, ThemeId } from "./types";

export type ChatterEvent =
  | "deal"
  | "hit"
  | "stand"
  | "double"
  | "split"
  | "bust"
  | "natural"
  | "win"
  | "loss"
  | "push"
  | "surrender"
  | "insurance"
  | "dealer_bust"
  | "new_shoe"
  | "plus3"
  | "sit";

export interface Line {
  speaker: string;
  text: string;
}

interface Cast {
  speakers: [string, string, string];
  lines: Record<ChatterEvent, string[]>;
}

const PIRATE: Cast = {
  speakers: ["Dutch", "Maggie", "Bones"],
  lines: {
    sit: [
      "Felt's clean. Cards are honest. Sit if you like the weather.",
      "House pays three to two. We don't argue with math.",
      "No stories about luck at this table. Just the next card.",
    ],
    deal: [
      "Cards are out. Breathe.",
      "Two for you, two for the house.",
      "The shoe doesn't care who you are.",
    ],
    hit: [
      "Another one, then.",
      "Asking the shoe for mercy.",
      "One more. That's the whole request.",
    ],
    stand: [
      "You leave it there. Fair.",
      "That's a finished thought.",
      "House will take its turn.",
    ],
    double: [
      "Twice the stake, one more card. Clean.",
      "You like the two you have. Understood.",
      "The bet grows. The rules stay put.",
    ],
    split: [
      "Two hands now. Keep them separate in your head.",
      "Pairs get a second table.",
      "Split is a door, not a promise.",
    ],
    bust: [
      "Over. The rail doesn't flinch.",
      "Twenty-two is just a number with no friends.",
      "That's the end of that hand.",
    ],
    natural: [
      "Twenty-one on the deal. Three to two.",
      "A natural. The house writes it down correctly.",
      "That's the good kind of quiet.",
    ],
    win: [
      "Yours. Even money.",
      "The total held. So did the chips.",
      "House pays what it owes.",
    ],
    loss: [
      "Dealer's. Nothing theatrical about it.",
      "The count of the cards is the whole story.",
      "Sit for the next one if you want.",
    ],
    push: [
      "Tie. Stake comes back whole.",
      "Nobody moves a chip that didn't already belong.",
      "Push. The felt stays even.",
    ],
    surrender: [
      "Half back. You walked before the last card.",
      "Late surrender is a door, not a defeat speech.",
      "Half the stake stays. That's the rule you asked for.",
    ],
    insurance: [
      "Ace up. Insurance is a side bet, not advice.",
      "Two to one if the hole is a ten. Your call.",
      "The house isn't selling hope. Just a price.",
    ],
    dealer_bust: [
      "House went over. Your total stands.",
      "The dealer found too much.",
      "That's the other way a hand can end.",
    ],
    new_shoe: [
      "Cut card. Fresh shoe.",
      "The old count is gone. Start over.",
      "Six decks, shuffled. Same rules.",
    ],
    plus3: [
      "Twenty-one plus three. The side bet hit.",
      "Three-card poker paid. Separate from the hand.",
      "That's the painted side of the rail.",
    ],
  },
};

const SOCIETY: Cast = {
  speakers: ["Pemberton", "The Duchess", "Maxie"],
  lines: {
    sit: [
      "We keep the arithmetic tidy here.",
      "Three to two on a natural. Always.",
      "A quiet table is a correct table.",
    ],
    deal: ["Cards, then.", "The first two decide very little.", "We begin."],
    hit: ["Another.", "As you wish.", "The deck complies."],
    stand: ["Held.", "A finished hand.", "Very well."],
    double: ["Doubled.", "One card, twice the stake.", "Noted."],
    split: ["Two accounts now.", "Split, cleanly.", "Keep them distinct."],
    bust: ["Over twenty-one.", "That hand is closed.", "The total exceeded."],
    natural: ["A natural. Paid correctly.", "Three to two.", "Elegantly done."],
    win: ["Yours.", "Even money.", "Settled in your favor."],
    loss: ["The house.", "Recorded.", "Next, if you please."],
    push: ["A push.", "Stake returned.", "Even."],
    surrender: ["Half returned.", "You left early. Allowed.", "Late surrender."],
    insurance: ["Ace showing. Insurance is optional.", "A side wager only.", "No counsel from us."],
    dealer_bust: ["The house exceeded.", "Dealer over.", "Your total remains."],
    new_shoe: ["New shoe.", "The cut card found us.", "Reshuffled."],
    plus3: ["The side wager paid.", "21+3. Noted.", "Three-card poker."],
  },
};

const REEF: Cast = {
  speakers: ["Marina", "Moss", "Dr. Coral"],
  lines: {
    sit: [
      "Current's steady. Rules don't drift.",
      "Sit. The table keeps time for you.",
      "No bigger bets from this side of the rail.",
    ],
    deal: ["Two and two.", "Cards in the water.", "Here they come."],
    hit: ["Deeper.", "One more from the shoe.", "Asking the current."],
    stand: ["You stay.", "Still water.", "Held."],
    double: ["Twice the weight, one more card.", "You lean in. Allowed.", "Doubled."],
    split: ["Two schools now.", "Split the pair.", "Keep both afloat."],
    bust: ["Too deep.", "Over.", "That hand sinks."],
    natural: ["A natural on the deal.", "Twenty-one, first breath.", "Paid three to two."],
    win: ["Yours.", "The total held.", "Even money."],
    loss: ["House current.", "That one's gone.", "Next tide."],
    push: ["Even water.", "Push.", "Stake comes back."],
    surrender: ["Half back to shore.", "You left early.", "Allowed."],
    insurance: ["Ace on the surface.", "Insurance is a separate current.", "Your call."],
    dealer_bust: ["House went under.", "Dealer over.", "You stay up."],
    new_shoe: ["Fresh water.", "New shoe.", "Count resets."],
    plus3: ["The side current paid.", "Three-card. Separate water.", "21+3 hit."],
  },
};

const CASTS: Record<ThemeId, Cast> = {
  midnight: PIRATE,
  classic: PIRATE,
  abyss: REEF,
  crimson: SOCIETY,
  glacier: SOCIETY,
};

const OUTCOME_EVENT: Record<Outcome, ChatterEvent> = {
  BLACKJACK: "natural",
  WIN: "win",
  PUSH: "push",
  LOSS: "loss",
  BUST: "bust",
  SURRENDER: "surrender",
};

export function lineFor(theme: ThemeId, event: ChatterEvent): Line {
  const cast = CASTS[theme];
  const pool = cast.lines[event];
  const text = pool[Math.floor(Math.random() * pool.length)] ?? pool[0]!;
  const speaker = cast.speakers[Math.floor(Math.random() * cast.speakers.length)]!;
  return { speaker, text };
}

export function linesForOutcomes(
  theme: ThemeId,
  outcomes: Outcome[],
  dealerBust: boolean,
  lastNet = 0,
): Line {
  if (dealerBust && outcomes.some((o) => o === "WIN")) return lineFor(theme, "dealer_bust");
  if (outcomes.includes("BLACKJACK") && lastNet > 0) return lineFor(theme, "natural");
  if (lastNet > 0 && outcomes.some((o) => o === "WIN" || o === "BLACKJACK")) {
    return lineFor(theme, "win");
  }
  if (outcomes.length > 1) {
    if (lastNet > 0) return lineFor(theme, "win");
    if (lastNet === 0) return lineFor(theme, "push");
    if (outcomes.every((o) => o === "BUST")) return lineFor(theme, "bust");
    return lineFor(theme, "loss");
  }
  const first = outcomes[0] ?? "LOSS";
  return lineFor(theme, OUTCOME_EVENT[first]);
}

export function castNames(theme: ThemeId): [string, string, string] {
  return CASTS[theme].speakers;
}

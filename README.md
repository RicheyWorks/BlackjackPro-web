# Blackjack Pro

Browser port of [RicheyWorks/BlackJackPro](https://github.com/RicheyWorks/BlackJackPro). Same house: a six-deck shoe, 3:2 naturals, and a table that will not invent money.

Sit down, buy the $5–$500 box, and play. Optional 21+3. Optional Hi-Lo. Optional coach that bets the ramp and acts the Illustrious 18 for you.

## House rules

| | |
| --- | --- |
| Shoe | 6 decks, shuffled at 75% |
| Naturals | 3:2 (`$25` pays `$38`) |
| Peek | American — ace and ten-up |
| Even money | True 1:1 lock on a natural vs ace. Not insurance. Works all-in. |
| Insurance | 2:1, premium `floor(bet / 2)` |
| Surrender | Late, original two cards only, after the peek. `$25` returns `$13`. |
| Dealer | S17 default, H17 toggle (locked mid-hand) |
| Splits | To four hands, DAS, aces take one card, no RSA |
| 21 after a split | Pays 1:1. Not a blackjack. |
| 21+3 | Optional. Cannot exceed the main stake. Paid on the deal. |

21+3 pay table: flush 5:1 · straight 10:1 · trips 30:1 · straight flush 40:1 · suited trips 100:1. Wheel (A-2-3) counts as a straight.

## Count

Hi-Lo, true count = running / decks remaining. The hole stays out of the running count until it is turned.

Bet ramp (same units as the Java `chooseBet`):

| True count | Stake |
| --- | --- |
| < 2 | $5 |
| 2 | $10 |
| 3 | $20 |
| 4+ | $40 |

Insurance / even money at a floored TC of +3. Illustrious 18 + Fab 4 sit on top of basic strategy when hints and the count are both on.

**Let the coach play** (`A`) turns those on, ramps the box, and acts. It never buys 21+3. Touch a chip or an action and it sits down.

## Keys

| | |
| --- | --- |
| Enter | Deal / deal again |
| H S D P R | Hit, stand, double, split, surrender |
| C | Count bet |
| A | Coach on/off |
| Esc | Clear the box |

## Persistence

Bankroll, tray, tape, achievements, settings, and a live hand live in `localStorage`. Refresh mid-hand **resumes the same cards and shoe** — it does not refund the box after you have seen them. A corrupt live snapshot falls back to folding the stake back into cash. Saves are allowlisted and capped — see [SECURITY.md](./SECURITY.md).

## Develop

```bash
npm install
npm test
npm run typecheck
npm run dev
```

`npm test` runs the brand/PWA checks plus the engine suite (payouts, peek, even money, splits, 21+3, persist hardening, coach).

Stack: React 19, TanStack Start, Vite, Tailwind v4, Zustand.

## Lineage

Rules, 21+3, and the count ramp come from the Java table. This repo is the web felt — not a Swing rewrite.

# Security

Offline casino game. No real-money ledger. Still treated as money-shaped state.

## Round 1 — cash integrity

- Integer chips only. `NaN` / `Infinity` / fractions rejected at `canBet`.
- Table box `$5–$500`. Bankroll and every persisted figure capped at `$1,000,000`.
- Mid-hand refresh restores the live table (cards, shoe, count). A missing or
  poisoned snapshot falls back to folding `inPlay` back into cash.
- Poisoned pending + side bets that exceed cash are dropped, not minted.
- 21+3 cannot exceed the main stake or the table max.

## Round 2 — untrusted save data

- `localStorage` is parsed with a reviver that drops `__proto__`, `constructor`, and `prototype`.
- Saves are allowlisted field-by-field. Extra keys never enter state.
- Themes, tape marks, and achievement ids are allowlisted. Payload size is capped.
- Writes serialize a constructed object, never the live store.

## Round 3 — UI and action surface

- Chip clicks only accept `CHIP_VALUES`.
- Theme changes are allowlisted.
- Store actions no-op when the engine says the move is illegal (no thrown errors to the page).
- Even money is a 1:1 lock, not an insurance side bet, so an all-in natural can still take it.
- Chatter is static copy. Nothing from the save is rendered as HTML.

Report issues on the repo. Do not send real secrets in issues.

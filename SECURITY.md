# Security

This is a **play-chip** table, not a licensed casino. See [CASINO.md](./CASINO.md).

## Practice table

Offline game. Integer chips, `$5–$500` box, bankroll capped at `$1,000,000`.
`localStorage` is parsed with a reviver that drops `__proto__`, `constructor`,
and `prototype`. Saves are allowlisted field-by-field. Mid-hand refresh
restores the live snapshot; a poisoned one folds `inPlay` back into cash.

Anyone can edit the save. Never take money here.

## Pit seat

- Identity from Better Auth only. Server functions use `authMiddleware`.
- Wallet is an append-only `wallet_ledger`. The client cannot set a balance.
- The engine runs on the server. The hole card is stripped from the JSON while
  it is face-down.
- Shoe seed stays on the server until that shoe is retired (`sha256` commit first).
- Live table writes use an optimistic `version` column. Stale clicks are rejected.
- Age checkbox, loss limit, cool-off, and self-exclude are server-enforced stubs —
  not a substitute for a licensed RG programme.

## Action surface

- Chip clicks only accept `CHIP_VALUES`.
- Theme changes are allowlisted.
- Store actions no-op when the engine says the move is illegal.
- Even money is a 1:1 lock, not an insurance side bet.
- Chatter is static copy. Nothing from the save is rendered as HTML.

Report issues on the repo. Do not send real secrets in issues.

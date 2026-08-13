# What a real online casino still needs

This table is a **rules-faithful blackjack game** with a **play-chip pit** (server
ledger, signed-in seat, hole card off the wire). It is **not** a licensed
gambling product and it **does not** take real money.

A legitimate real-money casino is mostly law, labs, and banking. Software is the
smaller piece.

## Honest split

| Layer | Who does it | Status here |
| --- | --- | --- |
| Game math (H17/S17, peek, 3:2, 21+3, splits) | Us | Done — `src/lib/blackjack` |
| Server-authoritative table | Us | **Phase 1 — building now** |
| Append-only chip ledger | Us | Phase 1 |
| Hole card not sent to the client | Us | Phase 1 |
| Commit–reveal shoe seed | Us | Phase 1 (play chips) |
| Age attestation + RG rails (limits, cool-off, self-exclude) | Us | Phase 1 stubs |
| Hand history / action log | Us | Phase 1 |
| Certified RNG (GLI-19 / BMM / eCOGRA) | Independent lab | Not started — swap the seeder when a lab says so |
| License per market (MGA, UKGC, NJ DGE, AGCO, …) | Lawyers + regulator | Outside this repo |
| KYC / AML / age verification vendor | Jumio, Onfido, … | Not started |
| Real-money cashier + segregated player funds | Licensed acquirer | Not started — do not bolt Stripe onto this |
| Geo-fence + prohibited-jurisdiction block | Ops + counsel | Not started |
| Responsible-gambling network (e.g. GAMSTOP) | Jurisdiction | Not started |
| 24/7 dispute desk, SAR filing, SOC 2 | Company | Not started |

**Do not take deposits until every row above is green.** Play chips are the only
currency this build will ever mint.

## Build phases

### Phase 0 — Practice table (already shipping)

Local engine, localStorage tray, coach, 21+3. Fine for learning. Anyone can
edit the save and print chips. That is why it cannot take money.

### Phase 1 — Pit seat (this pass)

Signed-in visitors can open a **pit seat**:

1. Identity from Better Auth (Google / X). No client-supplied user ids.
2. Wallet is a **Postgres ledger**. Balance = last `balance_after`, not a number
   the browser asserts.
3. Every click (chip, deal, hit, stand, double, split, surrender, insurance) is
   a server function. The engine runs on the server. The client renders a
   **redacted** view — the hole card is not in the JSON while it is face-down.
4. Shoe is shuffled from a server seed. Clients see `sha256(seed)` at shuffle
   and the seed itself when that shoe is retired.
5. First seat grants **1,000 play chips**. Bust refill only when the rack is
   empty. No client “set bankroll”.
6. Age checkbox (18+) and RG columns: loss limit, cool-off, self-exclude.
   Self-exclude is enforced on the server.
7. Hand + action rows for later audit.
8. Copy on the felt: **play chips only — not a licensed casino**.

Practice mode stays. It never writes the pit ledger.

### Phase 2 — Operator-ready play chips

- Single-connection transactions on Neon (Phase 1 uses an optimistic version).
- Reality-check ack before the next deal after 45 minutes.
- Immutable rules hash stored on every hand.
- Operator read-only views (RTP, hands/hour, void rate).
- Replace Mulberry-free HMAC shuffle with whatever the test lab specifies.
- Rate limits and device/session binding.

### Phase 3 — Real money (only after licenses)

- Swap play-chip grants for a licensed cashier. Never store PAN/CVV.
- KYC before first cash-out. Geo + age vendor before first cash-in.
- Certified RNG binary pinned; game build hashed and filed with the lab.
- Jurisdictional rule packs (no 21+3, different peek, etc.).
- Self-exclusion networks, affordability checks, SAR pipeline.

## Non-goals

- Peer-to-peer “house” games with real stakes.
- Letting the client shuffle, settle, or hide a loss by refreshing.
- Pretending a GitHub repo is a casino license.

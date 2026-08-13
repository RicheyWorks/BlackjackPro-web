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
| Server-authoritative table | Us | Phase 1 done |
| Append-only chip ledger | Us | Phase 1 done |
| Hole card not sent to the client | Us | Phase 1 done |
| Commit–reveal shoe seed | Us | Phase 1 (play chips) |
| Age attestation + RG rails (limits, cool-off, self-exclude) | Us | Phase 1 stubs |
| Hand history / action log | Us | Phase 1–2 |
| Reality-check ack | Us | **Phase 2** |
| Rules hash on every hand | Us | **Phase 2** |
| Single-connection DB transactions | Us | **Phase 2** |
| In-process rate limit | Us | **Phase 2** |
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

### Phase 2 — Operator-ready play chips (this pass)

- Ledger + table writes run in a **single-connection transaction**.
- After 45 minutes the next deal is locked until the player taps **Still playing**.
- Every hand stores the rules pack and its SHA-256 (`6D:pen0.75:S17:peek:…`).
- Ledger panel shows pit RTP, hands/hour, and the last 20 hands.
- Burst rate limit (8/sec, 80/min) on pit actions.
- Retired shoe: last seed + last commit, checked on the server (`seedOk`).
- Ledger replay of settled hands (hole stays redacted while the box is open).
- Cash tape (grant / wager / payout) plus the action strip on each hand.
- Seat clock, reality check with time / hands / net, copy-proof on a settled hand.
- Loss-cap remaining on the rail. In-browser hash of a pasted reveal against the last commit.
- Cool-off / exclude / void take a second tap. Ledger downloads as JSON.
- Pit seat bound to the browser that opened it.
- HMAC shoe shuffle is still play-chip grade — a lab will name the seeder later.

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

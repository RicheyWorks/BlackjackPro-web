import { getSql } from "@/lib/db";
import { Engine } from "@/lib/blackjack/engine";
import { createRules } from "@/lib/blackjack/rules";
import { HiLoCounter } from "@/lib/blackjack/hilo";
import { STARTING_BANKROLL } from "@/lib/blackjack/types";
import { liveInPlay } from "@/lib/blackjack/persist";
import { PLAY_GRANT, type HandRow, type PitOp, type PitView } from "./types";
import { applyOp } from "./apply";
import { dumpSession, parseBlob, type PitSession } from "./session";
import { toView } from "./view";
import { buildShuffledShoe, commitSeed, newHandId, newSeed } from "./rng.server";

interface ProfileRow {
  age_attested: boolean;
  rg_loss_limit: number;
  rg_cooloff_until: string | null;
  self_excluded_until: string | null;
}

interface TableRow {
  version: number;
  bankroll: number;
  live_json: string;
  session_anchor: number;
  session_started_at: string;
}

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return typeof d === "string" ? d : d.toISOString();
}

function blocked(profile: ProfileRow | null): string | null {
  if (!profile) return null;
  const now = Date.now();
  if (profile.self_excluded_until && new Date(profile.self_excluded_until).getTime() > now) {
    return "self-excluded";
  }
  if (profile.rg_cooloff_until && new Date(profile.rg_cooloff_until).getTime() > now) {
    return "cool-off";
  }
  return null;
}

function reshuffle(s: PitSession): void {
  s.prevSeedReveal = s.seed;
  s.seed = newSeed();
  s.seedCommit = commitSeed(s.seed);
  const shoe = buildShuffledShoe(s.engine.rules.decks, s.seed, s.engine.rules.penetration);
  s.engine.shoe.load(shoe);
  s.counter.reset();
  s.seen.clear();
}

function freshSession(): PitSession {
  const seed = newSeed();
  const seedCommit = commitSeed(seed);
  const engine = new Engine(PLAY_GRANT, createRules({ dealerHitsSoft17: false }));
  const shoe = buildShuffledShoe(engine.rules.decks, seed, engine.rules.penetration);
  engine.shoe.load(shoe);
  return {
    engine,
    plus3Pending: 0,
    plus3Last: null,
    lastMainBet: 0,
    lastPlus3Bet: 0,
    plus3: { wagered: 0, returned: 0, wins: 0 },
    tape: [],
    seed,
    seedCommit,
    prevSeedReveal: null,
    handId: null,
    counter: new HiLoCounter(),
    seen: new Set(),
    version: 1,
    sessionAnchor: PLAY_GRANT,
    sessionStartedAt: Date.now(),
  };
}

function exposed(s: PitSession): number {
  return (
    s.engine.bankroll +
    s.engine.pendingBet +
    s.plus3Pending +
    liveInPlay(s.engine.phase, s.engine.insuranceBet, s.engine.player)
  );
}

async function loadProfile(userId: string): Promise<ProfileRow | null> {
  const sql = await getSql();
  const rows = await sql<ProfileRow>`
    select age_attested, rg_loss_limit, rg_cooloff_until, self_excluded_until
    from player_profile where user_id = ${userId}
  `;
  return rows[0] ?? null;
}

async function loadTable(userId: string): Promise<TableRow | null> {
  const sql = await getSql();
  const rows = await sql<TableRow>`
    select version, bankroll, live_json, session_anchor, session_started_at
    from casino_tables where user_id = ${userId}
  `;
  return rows[0] ?? null;
}

async function writeLedger(
  userId: string,
  amount: number,
  balanceAfter: number,
  kind: string,
  ref: string | null,
): Promise<void> {
  if (amount === 0) return;
  const sql = await getSql();
  await sql`
    insert into wallet_ledger (user_id, amount, balance_after, kind, ref)
    values (${userId}, ${amount}, ${balanceAfter}, ${kind}, ${ref})
  `;
}

async function saveTable(userId: string, s: PitSession, expectedVersion: number): Promise<boolean> {
  const sql = await getSql();
  const blob = JSON.stringify(dumpSession(s));
  const next = expectedVersion + 1;
  const rows = await sql<{ user_id: string }>`
    update casino_tables
    set version = ${next},
        bankroll = ${s.engine.bankroll},
        live_json = ${blob},
        session_anchor = ${s.sessionAnchor},
        updated_at = now()
    where user_id = ${userId} and version = ${expectedVersion}
    returning user_id
  `;
  if (rows.length) {
    s.version = next;
    return true;
  }
  return false;
}

async function insertTable(userId: string, s: PitSession): Promise<void> {
  const sql = await getSql();
  const blob = JSON.stringify(dumpSession(s));
  await sql`
    insert into casino_tables (user_id, version, bankroll, live_json, session_anchor, session_started_at)
    values (${userId}, ${s.version}, ${s.engine.bankroll}, ${blob}, ${s.sessionAnchor}, to_timestamp(${s.sessionStartedAt / 1000}))
  `;
}

async function recordAction(userId: string, handId: string | null, action: string): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into casino_actions (hand_id, user_id, seq, action)
    values (${handId}, ${userId}, ${Date.now() % 1_000_000}, ${action})
  `;
}

async function openHand(userId: string, s: PitSession, main: number, plus3: number): Promise<void> {
  if (!s.handId) return;
  const sql = await getSql();
  await sql`
    insert into casino_hands (id, user_id, seed_commit, main_bet, plus3_bet, status)
    values (${s.handId}, ${userId}, ${s.seedCommit}, ${main}, ${plus3}, ${"open"})
  `;
}

async function closeHand(userId: string, s: PitSession): Promise<void> {
  if (!s.handId) return;
  const sql = await getSql();
  const e = s.engine;
  const fig = e.roundFigures();
  await sql`
    update casino_hands
    set settled_at = now(),
        insurance_bet = ${e.insuranceBet},
        wagered = ${fig.wagered},
        returned = ${fig.returned},
        net = ${fig.net},
        outcomes = ${e.lastOutcomes.join(",")},
        player_json = ${JSON.stringify(e.player)},
        dealer_json = ${JSON.stringify(e.dealer)},
        status = ${"settled"}
    where id = ${s.handId} and user_id = ${userId}
  `;
}

function extra(profile: ProfileRow | null) {
  return {
    lossLimit: profile?.rg_loss_limit ?? 0,
    cooloffUntil: iso(profile?.rg_cooloff_until),
    selfExcludedUntil: iso(profile?.self_excluded_until),
  };
}

export async function runTable(userId: string, op: PitOp): Promise<PitView> {
  const sql = await getSql();
  let profile = await loadProfile(userId);
  const gate = blocked(profile);
  if (gate && op.op !== "sync" && op.op !== "seat") {
    throw new Error(gate === "self-excluded" ? "This seat is self-excluded." : "Cool-off is still running.");
  }

  if (op.op === "seat") {
    await sql`
      insert into player_profile (user_id, age_attested, age_attested_at)
      values (${userId}, ${true}, now())
      on conflict (user_id) do update
        set age_attested = true,
            age_attested_at = coalesce(player_profile.age_attested_at, now())
    `;
    profile = await loadProfile(userId);
    const again = blocked(profile);
    if (again) {
      throw new Error(again === "self-excluded" ? "This seat is self-excluded." : "Cool-off is still running.");
    }
  }

  if (op.op === "setLossLimit") {
    await sql`
      insert into player_profile (user_id, rg_loss_limit)
      values (${userId}, ${op.amount})
      on conflict (user_id) do update set rg_loss_limit = ${op.amount}
    `;
    profile = await loadProfile(userId);
  }

  if (op.op === "cooloff") {
    await sql`
      insert into player_profile (user_id)
      values (${userId})
      on conflict (user_id) do nothing
    `;
    await sql`
      update player_profile
      set rg_cooloff_until = now() + (${op.hours} || ' hours')::interval
      where user_id = ${userId}
    `;
    profile = await loadProfile(userId);
  }

  if (op.op === "selfExclude") {
    await sql`
      insert into player_profile (user_id)
      values (${userId})
      on conflict (user_id) do nothing
    `;
    await sql`
      update player_profile
      set self_excluded_until = now() + (${op.days} || ' days')::interval
      where user_id = ${userId}
    `;
    profile = await loadProfile(userId);
  }

  let row = await loadTable(userId);
  let session: PitSession | null = row ? parseBlob(row.live_json, row.bankroll, row.version) : null;

  if (row && !session) throw new Error("Pit snapshot unreadable.");

  if (!session) {
    if (op.op !== "seat") throw new Error("Sit the pit first.");
    session = freshSession();
    await insertTable(userId, session);
    await writeLedger(userId, PLAY_GRANT, PLAY_GRANT, "grant", "open");
    row = await loadTable(userId);
  }

  if (op.op === "refill") {
    if (exposed(session) !== 0) throw new Error("Rack still has chips.");
    session.engine.setBankroll(PLAY_GRANT);
    session.sessionAnchor = PLAY_GRANT;
    session.sessionStartedAt = Date.now();
    await writeLedger(userId, PLAY_GRANT, PLAY_GRANT, "grant", "refill");
  }

  if (op.op === "deal" || op.op === "rebetDeal") {
    const limit = profile?.rg_loss_limit ?? 0;
    if (limit > 0) {
      const lost = session.sessionAnchor - exposed(session);
      if (lost >= limit) throw new Error("Session loss limit reached.");
    }
  }

  const before = session.engine.bankroll;
  const beforeHand = session.handId;
  const result = applyOp(session, op, { reshuffle, newHandId });
  const after = session.engine.bankroll;
  const delta = after - before;

  if ((op.op === "deal" || op.op === "rebetDeal") && session.handId && session.handId !== beforeHand) {
    await openHand(userId, session, session.lastMainBet, session.lastPlus3Bet);
  }
  if (result.settled) await closeHand(userId, session);

  let kind = "payout";
  if (delta < 0) {
    if (op.op === "addChip" && op.rail === "plus3") kind = "plus3_wager";
    else if (op.op === "insure") kind = "insurance";
    else kind = "wager";
  } else if (delta > 0) {
    if (op.op === "clearBet" || op.op === "newSession") kind = "refund";
    else if (session.plus3Last && session.plus3Last.returned > 0 && op.op === "deal") kind = "plus3_payout";
    else if (op.op === "insure") kind = "even_money";
    else kind = "payout";
  }
  if (delta !== 0 && op.op !== "refill") {
    await writeLedger(userId, delta, after, kind, session.handId);
  }

  if (op.op !== "sync") await recordAction(userId, session.handId, op.op);

  if (op.op !== "sync" && row) {
    const ok = await saveTable(userId, session, row.version);
    if (!ok) throw new Error("Table is busy. Try again.");
  }

  return toView(session, extra(profile));
}

export async function listHands(userId: string): Promise<HandRow[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    started_at: string;
    settled_at: string | null;
    main_bet: number;
    plus3_bet: number;
    net: number;
    outcomes: string;
    seed_commit: string;
    seed_reveal: string | null;
    status: string;
  }>`
    select id, started_at, settled_at, main_bet, plus3_bet, net, outcomes, seed_commit, seed_reveal, status
    from casino_hands where user_id = ${userId}
    order by started_at desc
    limit 20
  `;
  return rows.map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    settledAt: r.settled_at,
    mainBet: r.main_bet,
    plus3Bet: r.plus3_bet,
    net: r.net,
    outcomes: r.outcomes,
    seedCommit: r.seed_commit,
    seedReveal: r.seed_reveal,
    status: r.status,
  }));
}

export { STARTING_BANKROLL };

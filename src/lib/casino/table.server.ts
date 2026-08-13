import { createHash } from "node:crypto";
import { getSql, withTransaction, type Sql } from "@/lib/db";
import { Engine } from "@/lib/blackjack/engine";
import { createRules, rulesFingerprint } from "@/lib/blackjack/rules";
import { HiLoCounter } from "@/lib/blackjack/hilo";
import { liveInPlay } from "@/lib/blackjack/persist";
import { PLAY_GRANT, type HandRow, type PitOp, type PitStats, type PitView } from "./types";
import { applyOp } from "./apply";
import { dumpSession, parseBlob, type PitSession } from "./session";
import { toView } from "./view";
import { buildShuffledShoe, commitSeed, newHandId, newSeed } from "./rng.server";
import { assertRate } from "./rate";
import { needsRealityAck } from "./reality";
import { TABLE_MIN } from "@/lib/blackjack/money";

interface ProfileRow {
  age_attested: boolean;
  rg_loss_limit: number;
  rg_cooloff_until: string | null;
  self_excluded_until: string | null;
  device_id: string | null;
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

function hashRules(pack: string): string {
  return createHash("sha256").update(pack).digest("hex");
}

function packOf(s: PitSession): { pack: string; hash: string } {
  const pack = rulesFingerprint(s.engine.rules);
  return { pack, hash: hashRules(pack) };
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
  s.prevSeedCommit = s.seedCommit;
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
  const now = Date.now();
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
    prevSeedCommit: null,
    handId: null,
    counter: new HiLoCounter(),
    seen: new Set(),
    version: 1,
    sessionAnchor: PLAY_GRANT,
    sessionStartedAt: now,
    lastRealityAckAt: now,
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

async function loadProfile(sql: Sql, userId: string): Promise<ProfileRow | null> {
  const rows = await sql<ProfileRow>`
    select age_attested, rg_loss_limit, rg_cooloff_until, self_excluded_until, device_id
    from player_profile where user_id = ${userId}
  `;
  return rows[0] ?? null;
}

async function loadTable(sql: Sql, userId: string): Promise<TableRow | null> {
  const rows = await sql<TableRow>`
    select version, bankroll, live_json, session_anchor, session_started_at
    from casino_tables where user_id = ${userId}
  `;
  return rows[0] ?? null;
}

async function writeLedger(
  sql: Sql,
  userId: string,
  amount: number,
  balanceAfter: number,
  kind: string,
  ref: string | null,
): Promise<void> {
  if (amount === 0) return;
  await sql`
    insert into wallet_ledger (user_id, amount, balance_after, kind, ref)
    values (${userId}, ${amount}, ${balanceAfter}, ${kind}, ${ref})
  `;
}

async function saveTable(sql: Sql, userId: string, s: PitSession, expectedVersion: number): Promise<boolean> {
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

async function insertTable(sql: Sql, userId: string, s: PitSession): Promise<void> {
  const blob = JSON.stringify(dumpSession(s));
  await sql`
    insert into casino_tables (user_id, version, bankroll, live_json, session_anchor, session_started_at)
    values (${userId}, ${s.version}, ${s.engine.bankroll}, ${blob}, ${s.sessionAnchor}, to_timestamp(${s.sessionStartedAt / 1000}))
  `;
}

async function recordAction(sql: Sql, userId: string, handId: string | null, action: string): Promise<void> {
  await sql`
    insert into casino_actions (hand_id, user_id, seq, action)
    values (${handId}, ${userId}, ${0}, ${action})
  `;
}

async function openHand(sql: Sql, userId: string, s: PitSession, main: number, plus3: number): Promise<void> {
  if (!s.handId) return;
  const { pack, hash } = packOf(s);
  await sql`
    insert into casino_hands (id, user_id, seed_commit, main_bet, plus3_bet, status, rules_hash, rules_pack)
    values (${s.handId}, ${userId}, ${s.seedCommit}, ${main}, ${plus3}, ${"open"}, ${hash}, ${pack})
  `;
}

async function voidHand(sql: Sql, userId: string, handId: string | null): Promise<void> {
  if (!handId) return;
  await sql`
    update casino_hands
    set status = ${"void"}, settled_at = now()
    where id = ${handId} and user_id = ${userId} and status = ${"open"}
  `;
}

async function closeHand(sql: Sql, userId: string, s: PitSession): Promise<void> {
  if (!s.handId) return;
  const e = s.engine;
  const fig = e.roundFigures();
  await sql`
    update casino_hands
    set settled_at = now(),
        insurance_bet = ${e.lastInsuranceBet},
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

function extra(profile: ProfileRow | null, s: PitSession) {
  const last = s.prevSeedCommit;
  const reveal = s.prevSeedReveal;
  const seedOk = !reveal || !last || commitSeed(reveal) === last;
  return {
    lossLimit: profile?.rg_loss_limit ?? 0,
    cooloffUntil: iso(profile?.rg_cooloff_until),
    selfExcludedUntil: iso(profile?.self_excluded_until),
    rulesHash: packOf(s).hash,
    lastSeedCommit: last,
    seedOk,
  };
}

export async function runTable(userId: string, op: PitOp, device = ""): Promise<PitView> {
  assertRate(userId, op.op);
  return withTransaction(async (sql) => {
    let profile = await loadProfile(sql, userId);
    if (device && profile?.device_id && profile.device_id !== device && op.op !== "sync") {
      throw new Error("This seat is bound to another device.");
    }
    const gate = blocked(profile);
    if (gate && op.op !== "sync" && op.op !== "seat") {
      const finish = new Set(["hit", "stand", "double", "split", "surrender", "insure"]);
      if (!finish.has(op.op)) {
        throw new Error(gate === "self-excluded" ? "This seat is self-excluded." : "Cool-off is still running.");
      }
    }

    if (op.op === "seat") {
      await sql`
        insert into player_profile (user_id, age_attested, age_attested_at, device_id)
        values (${userId}, ${true}, now(), ${device || null})
        on conflict (user_id) do update
          set age_attested = true,
              age_attested_at = coalesce(player_profile.age_attested_at, now()),
              device_id = coalesce(player_profile.device_id, excluded.device_id)
      `;
      profile = await loadProfile(sql, userId);
      if (device && profile?.device_id && profile.device_id !== device) {
        throw new Error("This seat is bound to another device.");
      }
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
      profile = await loadProfile(sql, userId);
    }

    if (op.op === "cooloff") {
      await sql`
        insert into player_profile (user_id)
        values (${userId})
        on conflict (user_id) do nothing
      `;
      await sql`
        update player_profile
        set rg_cooloff_until = now() + make_interval(hours => ${op.hours})
        where user_id = ${userId}
      `;
      profile = await loadProfile(sql, userId);
    }

    if (op.op === "selfExclude") {
      await sql`
        insert into player_profile (user_id)
        values (${userId})
        on conflict (user_id) do nothing
      `;
      await sql`
        update player_profile
        set self_excluded_until = now() + make_interval(days => ${op.days})
        where user_id = ${userId}
      `;
      profile = await loadProfile(sql, userId);
    }

    let row = await loadTable(sql, userId);
    let session: PitSession | null = row ? parseBlob(row.live_json, row.bankroll, row.version) : null;

    if (row && !session) throw new Error("Pit snapshot unreadable.");
    if (session && commitSeed(session.seed) !== session.seedCommit) {
      throw new Error("Pit snapshot unreadable.");
    }

    if (!session) {
      if (op.op !== "seat") throw new Error("Sit the pit first.");
      session = freshSession();
      await insertTable(sql, userId, session);
      await writeLedger(sql, userId, PLAY_GRANT, PLAY_GRANT, "grant", "open");
      row = await loadTable(sql, userId);
    }

    if (op.op === "ackReality") {
      session.lastRealityAckAt = Date.now();
    }

    if (op.op === "refill") {
      const left = exposed(session);
      if (left >= TABLE_MIN) throw new Error("Rack still has chips.");
      session.engine.pendingBet = 0;
      session.plus3Pending = 0;
      session.engine.setBankroll(0);
      if (left > 0) {
        await writeLedger(sql, userId, -left, 0, "void", "absorb");
      }
      session.engine.setBankroll(PLAY_GRANT);
      session.sessionAnchor = PLAY_GRANT;
      session.sessionStartedAt = Date.now();
      session.lastRealityAckAt = Date.now();
      await writeLedger(sql, userId, PLAY_GRANT, PLAY_GRANT, "grant", "refill");
    }

    if (op.op === "deal" || op.op === "rebetDeal") {
      if (needsRealityAck(session.sessionStartedAt, session.lastRealityAckAt)) {
        throw new Error("Reality check — confirm you are still playing.");
      }
      const limit = profile?.rg_loss_limit ?? 0;
      if (limit > 0) {
        const cashAtRisk = session.sessionAnchor - session.engine.bankroll;
        const nextLost =
          op.op === "rebetDeal" && !session.engine.canDeal
            ? cashAtRisk + session.lastMainBet + session.lastPlus3Bet
            : cashAtRisk;
        if (nextLost > limit) throw new Error("Session loss limit reached.");
      }
    }

    const seedBefore = session.seed;
    const before = session.engine.bankroll;
    const beforeHand = session.handId;
    const result = applyOp(session, op, { reshuffle, newHandId });
    const after = session.engine.bankroll;
    const delta = after - before;

    if (session.seed !== seedBefore && session.prevSeedReveal) {
      const oldCommit = commitSeed(session.prevSeedReveal);
      await sql`
        update casino_hands
        set seed_reveal = ${session.prevSeedReveal}
        where user_id = ${userId} and seed_commit = ${oldCommit} and seed_reveal is null
      `;
    }

    if (op.op === "newSession") await voidHand(sql, userId, beforeHand);

    if ((op.op === "deal" || op.op === "rebetDeal") && session.handId && session.handId !== beforeHand) {
      await openHand(sql, userId, session, session.lastMainBet, session.lastPlus3Bet);
    }
    if (result.settled) await closeHand(sql, userId, session);

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
      const plus3Pay =
        (op.op === "deal" || op.op === "rebetDeal") && session.plus3Last && session.plus3Last.returned > 0
          ? session.plus3Last.returned
          : 0;
      if (plus3Pay > 0 && plus3Pay !== delta) {
        await writeLedger(sql, userId, plus3Pay, before + plus3Pay, "plus3_payout", session.handId);
        const rest = delta - plus3Pay;
        if (rest !== 0) {
          await writeLedger(sql, userId, rest, after, rest < 0 ? "wager" : "payout", session.handId);
        }
      } else {
        await writeLedger(sql, userId, delta, after, kind, session.handId);
      }
    }

    if (op.op !== "sync") await recordAction(sql, userId, session.handId, op.op);

    if (op.op !== "sync" && row) {
      const ok = await saveTable(sql, userId, session, row.version);
      if (!ok) throw new Error("Table is busy. Try again.");
    }

    return toView(session, extra(profile, session));
  });
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
    rules_hash: string;
    rules_pack: string;
    status: string;
  }>`
    select id, started_at, settled_at, main_bet, plus3_bet, net, outcomes,
           seed_commit, seed_reveal, rules_hash, rules_pack, status
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
    rulesHash: r.rules_hash,
    rulesPack: r.rules_pack,
    status: r.status,
  }));
}

export async function listStats(userId: string): Promise<PitStats> {
  const sql = await getSql();
  const rows = await sql<{
    hands: number;
    wagered: number;
    returned: number;
    net: number;
    voids: number;
    last_hour: number;
  }>`
    select
      count(*)::int as hands,
      coalesce(sum(wagered), 0)::int as wagered,
      coalesce(sum(returned), 0)::int as returned,
      coalesce(sum(net), 0)::int as net,
      (select count(*)::int from casino_hands v where v.user_id = ${userId} and v.status = 'void') as voids,
      count(*) filter (where started_at > now() - interval '1 hour')::int as last_hour
    from casino_hands
    where user_id = ${userId} and status = ${"settled"}
  `;
  const r = rows[0] ?? { hands: 0, wagered: 0, returned: 0, net: 0, voids: 0, last_hour: 0 };
  const packRows = await sql<{ rules_pack: string; rules_hash: string }>`
    select rules_pack, rules_hash from casino_hands
    where user_id = ${userId} and rules_pack <> ''
    order by started_at desc
    limit 1
  `;
  const pack = packRows[0]?.rules_pack || rulesFingerprint(createRules({ dealerHitsSoft17: false }));
  const hash = packRows[0]?.rules_hash || hashRules(pack);
  return {
    hands: r.hands,
    wagered: r.wagered,
    returned: r.returned,
    net: r.net,
    rtp: r.wagered > 0 ? r.returned / r.wagered : null,
    voids: r.voids,
    lastHourHands: r.last_hour,
    rulesPack: pack,
    rulesHash: hash,
  };
}

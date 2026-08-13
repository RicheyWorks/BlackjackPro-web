-- Pit seat: play-chip ledger + live table + audit. Play chips only.

create table if not exists player_profile (
  user_id text primary key,
  age_attested boolean not null default false,
  age_attested_at timestamptz,
  rg_loss_limit integer not null default 0,
  rg_cooloff_until timestamptz,
  self_excluded_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists wallet_ledger (
  id bigserial primary key,
  user_id text not null,
  amount integer not null,
  balance_after integer not null,
  kind text not null,
  ref text,
  created_at timestamptz not null default now()
);
create index if not exists wallet_ledger_user_idx on wallet_ledger (user_id, id desc);

create table if not exists casino_tables (
  user_id text primary key,
  version integer not null default 1,
  bankroll integer not null,
  live_json text not null,
  session_anchor integer not null,
  session_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists casino_hands (
  id text primary key,
  user_id text not null,
  started_at timestamptz not null default now(),
  settled_at timestamptz,
  seed_commit text not null,
  seed_reveal text,
  main_bet integer not null,
  plus3_bet integer not null default 0,
  insurance_bet integer not null default 0,
  wagered integer not null default 0,
  returned integer not null default 0,
  net integer not null default 0,
  outcomes text not null default '',
  player_json text not null default '[]',
  dealer_json text not null default '{}',
  status text not null default 'open'
);
create index if not exists casino_hands_user_idx on casino_hands (user_id, started_at desc);

create table if not exists casino_actions (
  id bigserial primary key,
  hand_id text,
  user_id text not null,
  seq integer not null default 0,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists casino_actions_user_idx on casino_actions (user_id, id desc);

-- Phase 2: rules hash on every hand (immutable pack id).

alter table casino_hands add column if not exists rules_hash text not null default '';
alter table casino_hands add column if not exists rules_pack text not null default '';

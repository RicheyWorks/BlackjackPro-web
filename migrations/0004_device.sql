-- Bind a pit seat to the browser that opened it.

alter table player_profile add column if not exists device_id text;

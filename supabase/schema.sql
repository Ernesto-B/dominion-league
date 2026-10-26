-- Dominion Night: players, games, game_results, groups, seasons schema + RLS + admin RPCs.
-- Run once against a fresh Supabase project (SQL editor, or `supabase db push`).
-- Safe to commit: contains no secrets, no real player data.
--
-- After running this, the only thing it cannot do for you is set the first
-- admin (RLS blocks writes before any players row has is_admin = true) and
-- create the actual player accounts — see scripts/migrate.mjs for both.

create table if not exists players (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  group_id text not null,
  is_admin boolean not null default false,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);
-- A player can belong to more than one friend group (e.g. someone who plays
-- with two separate circles) — group_ids replaces the single group_id above,
-- which stays only so existing rows have something to backfill from and
-- isn't written to by the app anymore.
alter table players add column if not exists group_ids text[] not null default '{}'::text[];
update players set group_ids = array[group_id] where group_ids = '{}'::text[] and group_id is not null;
alter table players alter column group_id drop not null;

create table if not exists games (
  id bigserial primary key,
  date date not null,
  type text not null default '',          -- '', 'Playoff', or 'Friendly'
  sets text,
  strategy text,
  winner_vp int,
  minutes int,
  notes text,
  created_by uuid references players(id),
  created_at timestamptz not null default now()
);
-- Which group this table was played for — chosen explicitly by the admin
-- when logging the game (add_game/edit_game validate every player listed
-- actually belongs to it), not inferred from the players. That's what makes
-- two groups' stats genuinely independent (each group's ranking is computed
-- from only its own games) and what the RLS policy below keys off to keep
-- a group's games invisible to anyone not in it. Null means "no group" —
-- the whole-site-is-one-league case when no groups are configured at all.
alter table games add column if not exists group_id text;
create index if not exists games_group_id_idx on games(group_id);

create table if not exists game_results (
  id bigserial primary key,
  game_id bigint not null references games(id) on delete cascade,
  player_id uuid not null references players(id),
  place int not null,                     -- ties share the same place number
  vp int,                                 -- this player's own VP, not just the winner's
  unique (game_id, player_id)
);
alter table game_results add column if not exists vp int;

-- One-time best-effort backfill for games logged before games.group_id
-- existed: a game gets the one group every one of its players shares, if
-- there's exactly one. Ambiguous (shares more than one, or none) is left
-- null for the admin to fix via Edit Game (or delete_group, if the whole
-- group's getting removed). Only ever touches rows still null, and needs
-- game_results to already exist, so it runs after both tables are created
-- rather than right after games — on a brand-new install this is a no-op,
-- there's nothing to backfill yet.
with shared as (
  select gr.game_id, arr.grp,
    count(distinct gr.player_id) as players_in_game,
    (select count(*) from game_results gr2 where gr2.game_id = gr.game_id) as total_players
  from game_results gr
  join players pl on pl.id = gr.player_id
  cross join lateral unnest(pl.group_ids) as arr(grp)
  group by gr.game_id, arr.grp
), candidates as (
  select game_id, grp from shared where players_in_game = total_players
), unambiguous as (
  select game_id, min(grp) as grp from candidates group by game_id having count(*) = 1
)
update games g set group_id = u.grp
from unambiguous u
where g.id = u.game_id and g.group_id is null;

-- Deliberately no FK from players.group_id to groups.id: adding one
-- retroactively is an ordering headache (it's checked against existing data
-- the moment it's added), and the admin UI is the only place group_id ever
-- gets set, via a dropdown of real groups. A mismatch still gets surfaced —
-- js/app.js warns if a group_id doesn't match any row here.
create table if not exists groups (
  id text primary key,
  name text not null
);

create table if not exists seasons (
  id bigserial primary key,
  group_id text not null,
  name text not null,
  start_date date not null,
  weeks int not null,
  target_games int not null default 8,
  qualify_pct numeric not null default 0.6,
  playoff_spots int not null default 4,
  champion_player_id uuid references players(id),
  notes text,
  created_at timestamptz not null default now()
);

-- Single-row table (the `id boolean primary key default true` trick forces
-- exactly one row) for small site-wide admin toggles. Currently just which
-- Dominion expansions are "owned" — unticking one hides it from the Add A
-- Game set picker without touching any already-logged game.
create table if not exists settings (
  id boolean primary key default true,
  enabled_sets text[] not null default array['Base','Intrigue','Seaside','Prosperity','Hinterlands','Dark Ages','Cornucopia & Guilds','Adventures','Empires','Renaissance','Menagerie','Plunder','Rising Sun'],
  constraint settings_single_row check (id)
);
insert into settings (id) values (true) on conflict (id) do nothing;

create index if not exists games_date_idx on games(date);
create index if not exists game_results_game_id_idx on game_results(game_id);
create index if not exists game_results_player_id_idx on game_results(player_id);
create index if not exists seasons_group_id_idx on seasons(group_id);

alter table players enable row level security;
alter table games enable row level security;
alter table game_results enable row level security;
alter table groups enable row level security;
alter table seasons enable row level security;
alter table settings enable row level security;

-- Inserting into a bigserial column calls nextval() on its backing sequence,
-- which needs its own grant separate from the table's. games/game_results
-- are only ever written through the SECURITY DEFINER functions below (which
-- run as the function owner, sidestepping this), but groups/seasons are
-- written directly by the authenticated admin, so they need it explicitly.
grant usage on sequence seasons_id_seq to authenticated;

-- SECURITY DEFINER so this never depends on (or risks recursing into) the
-- players RLS policies below. Reads only the caller's own id — never a
-- caller-supplied one.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce((select p.is_admin from players p where p.id = auth.uid()), false);
$$;

-- SECURITY DEFINER for the same reason as is_admin(): must never depend on
-- (or risk recursing into) the players RLS policies it's used from. This is
-- what the group-scoped SELECT policies below key off, so a user genuinely
-- cannot read another group's rows through the API, not just have them
-- hidden in the UI.
create or replace function my_groups()
returns text[]
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce((select p.group_ids from players p where p.id = auth.uid()), '{}'::text[]);
$$;

-- True only in the no-groups-configured, whole-site-is-one-league case —
-- that's when a null group_id (on a game or season) should stay visible to
-- everyone. Once any group exists, a null group_id instead means "not yet
-- assigned" (an old pre-migration game the backfill couldn't resolve, or one
-- genuinely spanning groups) and should be admin-only until resolved, not
-- broadly readable just because it happens to be unassigned.
create or replace function no_groups_configured()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select not exists (select 1 from groups);
$$;

-- Unlike tables/functions, CREATE POLICY has no IF NOT EXISTS — drop-then-
-- create is what keeps this file safely re-runnable against an already-
-- deployed database (re-running it bare used to abort here with "policy
-- already exists", which silently skipped every change below this point,
-- including RPC updates. Caught running this file against a second,
-- already-migrated database as part of testing the per-player-VP change).

-- Read access: scoped to the groups a player actually belongs to — a game,
-- season, or group with group_id/id outside my_groups() genuinely doesn't
-- come back from the API, not just get filtered out client-side. The admin
-- bypasses this everywhere (they manage the whole site). A row with no
-- group at all (null) stays visible to everyone — that's the no-groups-
-- configured, whole-site-is-one-league case. No anonymous access at all —
-- that's what makes the whole site login-gated.
drop policy if exists players_select on players;
create policy players_select on players for select to authenticated
  using (is_admin() or id = auth.uid() or group_ids && my_groups());
drop policy if exists games_select on games;
create policy games_select on games for select to authenticated
  using (is_admin() or (group_id is null and no_groups_configured()) or group_id = any(my_groups()));
drop policy if exists game_results_select on game_results;
create policy game_results_select on game_results for select to authenticated
  using (is_admin() or exists (
    select 1 from games g where g.id = game_id
      and ((g.group_id is null and no_groups_configured()) or g.group_id = any(my_groups()))
  ));
drop policy if exists groups_select on groups;
create policy groups_select on groups for select to authenticated
  using (is_admin() or id = any(my_groups()));
drop policy if exists seasons_select on seasons;
create policy seasons_select on seasons for select to authenticated
  using (is_admin() or (group_id is null and no_groups_configured()) or group_id = any(my_groups()));
drop policy if exists settings_select on settings;
create policy settings_select on settings for select to authenticated using (true);

-- Write access: admin only, as a defense-in-depth backstop. The real write
-- path is the RPCs below, which re-check is_admin() themselves so a dangling
-- games row can't be left behind by a partially-failed two-step client write.
drop policy if exists players_write on players;
create policy players_write on players for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists games_write on games;
create policy games_write on games for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists game_results_write on game_results;
create policy game_results_write on game_results for all to authenticated using (is_admin()) with check (is_admin());

-- groups and seasons are single-row writes (no child table to keep in sync),
-- so the RLS policy alone is the right place to gate them — no RPC wrapper
-- needed the way add_game/edit_game need one.
drop policy if exists groups_write on groups;
create policy groups_write on groups for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists seasons_write on seasons;
create policy seasons_write on seasons for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists settings_write on settings;
create policy settings_write on settings for all to authenticated using (is_admin()) with check (is_admin());

-- Deliberately NOT a general self-row UPDATE policy on players: RLS is
-- row-level, not column-level, so "let a player update their own row" would
-- also let them set is_admin = true on themselves via a raw client call.
-- This RPC flips only must_change_password, for the caller's own row only.
create or replace function mark_password_changed()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update players set must_change_password = false where id = auth.uid();
$$;

-- Changing a function's parameter list creates a new overload rather than
-- replacing it — drop the pre-group_id signatures explicitly so re-running
-- this file doesn't leave a stale duplicate behind.
drop function if exists add_game(date, text, text, text, int, int, text, jsonb);
drop function if exists edit_game(bigint, date, text, text, text, int, int, text, jsonb);

create or replace function add_game(
  p_date date, p_type text, p_sets text, p_strategy text,
  p_winner_vp int, p_minutes int, p_notes text,
  p_group_id text, -- null only valid when no groups are configured at all
  p_results jsonb -- [{"player_id": "...", "place": 1}, ...]
) returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game_id bigint;
  v_bad int;
begin
  if not is_admin() then
    raise exception 'only the admin can add games';
  end if;

  if p_group_id is not null then
    select count(*) into v_bad from jsonb_array_elements(p_results) r
    join players pl on pl.id = (r->>'player_id')::uuid
    where not (p_group_id = any(pl.group_ids));
    if v_bad > 0 then
      raise exception 'every player must belong to the selected group';
    end if;
  end if;

  insert into games (date, type, sets, strategy, winner_vp, minutes, notes, group_id, created_by)
  values (p_date, coalesce(p_type, ''), p_sets, p_strategy, p_winner_vp, p_minutes, p_notes, p_group_id, auth.uid())
  returning id into v_game_id;

  insert into game_results (game_id, player_id, place, vp)
  select v_game_id, (r->>'player_id')::uuid, (r->>'place')::int, (r->>'vp')::int
  from jsonb_array_elements(p_results) r;

  return v_game_id;
end;
$$;

create or replace function edit_game(
  p_game_id bigint, p_date date, p_type text, p_sets text, p_strategy text,
  p_winner_vp int, p_minutes int, p_notes text, p_group_id text, p_results jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bad int;
begin
  if not is_admin() then
    raise exception 'only the admin can edit games';
  end if;

  if p_group_id is not null then
    select count(*) into v_bad from jsonb_array_elements(p_results) r
    join players pl on pl.id = (r->>'player_id')::uuid
    where not (p_group_id = any(pl.group_ids));
    if v_bad > 0 then
      raise exception 'every player must belong to the selected group';
    end if;
  end if;

  update games set
    date = p_date, type = coalesce(p_type, ''), sets = p_sets, strategy = p_strategy,
    winner_vp = p_winner_vp, minutes = p_minutes, notes = p_notes, group_id = p_group_id
  where id = p_game_id;

  delete from game_results where game_id = p_game_id;

  insert into game_results (game_id, player_id, place, vp)
  select p_game_id, (r->>'player_id')::uuid, (r->>'place')::int, (r->>'vp')::int
  from jsonb_array_elements(p_results) r;
end;
$$;

create or replace function delete_game(p_game_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'only the admin can delete games';
  end if;
  delete from games where id = p_game_id; -- game_results cascades
end;
$$;

create or replace function delete_group(p_group_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'only the admin can delete groups';
  end if;
  -- Everything that only exists within this group goes with it: its games
  -- (game_results cascades), its seasons, and the group itself. Players
  -- just lose this one membership, not their account — array_remove leaves
  -- their other groups (and their stats there) untouched.
  delete from games where group_id = p_group_id;
  delete from seasons where group_id = p_group_id;
  update players set group_ids = array_remove(group_ids, p_group_id) where p_group_id = any(group_ids);
  delete from groups where id = p_group_id;
end;
$$;

revoke execute on function add_game(date, text, text, text, int, int, text, text, jsonb) from anon;
revoke execute on function edit_game(bigint, date, text, text, text, int, int, text, text, jsonb) from anon;
revoke execute on function delete_game(bigint) from anon;
revoke execute on function delete_group(text) from anon;
revoke execute on function mark_password_changed() from anon;

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

create table if not exists game_results (
  id bigserial primary key,
  game_id bigint not null references games(id) on delete cascade,
  player_id uuid not null references players(id),
  place int not null,                     -- ties share the same place number
  unique (game_id, player_id)
);

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

create index if not exists games_date_idx on games(date);
create index if not exists game_results_game_id_idx on game_results(game_id);
create index if not exists game_results_player_id_idx on game_results(player_id);
create index if not exists seasons_group_id_idx on seasons(group_id);

alter table players enable row level security;
alter table games enable row level security;
alter table game_results enable row level security;
alter table groups enable row level security;
alter table seasons enable row level security;

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

-- Read access: any authenticated player sees the full roster/games/results
-- (needed for rankings, standings, head-to-head). No anonymous access at all
-- on any of the three tables — that's what makes the whole site login-gated.
create policy players_select on players for select to authenticated using (true);
create policy games_select on games for select to authenticated using (true);
create policy game_results_select on game_results for select to authenticated using (true);
create policy groups_select on groups for select to authenticated using (true);
create policy seasons_select on seasons for select to authenticated using (true);

-- Write access: admin only, as a defense-in-depth backstop. The real write
-- path is the RPCs below, which re-check is_admin() themselves so a dangling
-- games row can't be left behind by a partially-failed two-step client write.
create policy players_write on players for all to authenticated using (is_admin()) with check (is_admin());
create policy games_write on games for all to authenticated using (is_admin()) with check (is_admin());
create policy game_results_write on game_results for all to authenticated using (is_admin()) with check (is_admin());

-- groups and seasons are single-row writes (no child table to keep in sync),
-- so the RLS policy alone is the right place to gate them — no RPC wrapper
-- needed the way add_game/edit_game need one.
create policy groups_write on groups for all to authenticated using (is_admin()) with check (is_admin());
create policy seasons_write on seasons for all to authenticated using (is_admin()) with check (is_admin());

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

create or replace function add_game(
  p_date date, p_type text, p_sets text, p_strategy text,
  p_winner_vp int, p_minutes int, p_notes text,
  p_results jsonb -- [{"player_id": "...", "place": 1}, ...]
) returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game_id bigint;
begin
  if not is_admin() then
    raise exception 'only the admin can add games';
  end if;

  insert into games (date, type, sets, strategy, winner_vp, minutes, notes, created_by)
  values (p_date, coalesce(p_type, ''), p_sets, p_strategy, p_winner_vp, p_minutes, p_notes, auth.uid())
  returning id into v_game_id;

  insert into game_results (game_id, player_id, place)
  select v_game_id, (r->>'player_id')::uuid, (r->>'place')::int
  from jsonb_array_elements(p_results) r;

  return v_game_id;
end;
$$;

create or replace function edit_game(
  p_game_id bigint, p_date date, p_type text, p_sets text, p_strategy text,
  p_winner_vp int, p_minutes int, p_notes text, p_results jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'only the admin can edit games';
  end if;

  update games set
    date = p_date, type = coalesce(p_type, ''), sets = p_sets, strategy = p_strategy,
    winner_vp = p_winner_vp, minutes = p_minutes, notes = p_notes
  where id = p_game_id;

  delete from game_results where game_id = p_game_id;

  insert into game_results (game_id, player_id, place)
  select p_game_id, (r->>'player_id')::uuid, (r->>'place')::int
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

revoke execute on function add_game(date, text, text, text, int, int, text, jsonb) from anon;
revoke execute on function edit_game(bigint, date, text, text, text, int, int, text, jsonb) from anon;
revoke execute on function delete_game(bigint) from anon;
revoke execute on function mark_password_changed() from anon;

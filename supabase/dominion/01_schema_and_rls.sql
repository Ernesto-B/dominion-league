-- Dominion collection catalog: tables, constraints, RLS and read-only catalog views.
--
-- * Everything is prefixed `dominion_` and lives beside — never inside — the Elo/league tables
--   (players, games, game_results, groups, seasons, settings); nothing in supabase/schema.sql is touched.
-- * Safe to re-run: every statement is `create ... if not exists`, `create or replace`, or a
--   drop-then-create pair (the repo convention for policies). It never drops a table or deletes a row.
-- * Read-only for the public: RLS is on, the only policy is SELECT, and INSERT/UPDATE/DELETE are not
--   even granted to anon/authenticated. The catalog is edited only by re-running 02_seed_data.sql from
--   the SQL editor / CLI (which run as the table owner), never from the browser.
-- * Needs PostgreSQL 15+ (`security_invoker` views). Supabase projects are 15 or 17.
--
-- Derived from the supplied dominion_supabase_react_bundle_v1 schema (same tables and columns) with these
-- additions, all checked against the packaged data before being added:
--   - kingdom_cards (expansion, pile_id) -> kingdom_piles foreign key (so a card can't point at a pile
--     that doesn't exist), and UNIQUE (expansion, name)
--   - CHECK constraints (non-negative costs, overpay yes/no, copies >= 1, landscape type is one of the
--     five, edition can only be 'Second Edition' or 'Original (only edition)' — i.e. a removed First
--     Edition card cannot be stored)
--   - NOT NULL on columns the data always fills
--   - indexes for the mechanic / expansion lookups the UI performs
--
-- Landscape and Artifact mechanic tags use a DIFFERENT vocabulary from the Kingdom taxonomy (most landscape
-- tag ids are not in dominion_taxonomy), so dominion_landscape_mechanics / dominion_artifact_mechanics
-- deliberately have no foreign key to dominion_taxonomy.

begin;

-- ---------------------------------------------------------------- taxonomy
create table if not exists public.dominion_taxonomy (
  mechanic_id text primary key,
  definition  text not null,
  status      text not null
);

-- ------------------------------------------------------------------- piles
-- One row per Kingdom supply pile. A split pile (e.g. "Catapult / Rocks") or a mixed pile (Knights,
-- Castles) is ONE pile holding several card names, so names >= piles.
create table if not exists public.dominion_kingdom_piles (
  expansion       text    not null,
  pile_id         text    not null,
  distinct_names  integer not null check (distinct_names >= 1),
  physical_copies integer not null check (physical_copies >= 1),
  card_ids        text    not null,            -- '|'-separated dominion_kingdom_cards.card_id values
  primary key (expansion, pile_id)
);

-- ------------------------------------------------------------------- cards
create table if not exists public.dominion_kingdom_cards (
  card_id                        text primary key,
  expansion                      text    not null,
  edition                        text    not null check (edition in ('Second Edition', 'Original (only edition)')),
  name                           text    not null,
  cost_raw                       text    not null,            -- as printed, e.g. '4', '2+', '0D4'
  cost_coins                     integer not null check (cost_coins >= 0),
  cost_debt                      integer not null default 0 check (cost_debt >= 0),
  overpay                        text    not null check (overpay in ('yes', 'no')),
  printed_types                  text    not null,            -- '|'-separated; see dominion_kingdom_printed_types
  type_verification              text    not null,
  physical_copies                integer not null check (physical_copies >= 1),
  pile_id                        text    not null,
  edition_added                  text    check (edition_added in ('True', 'False')),
  previous_name                  text,
  mechanics_verification         text    not null,
  type_source_url                text,
  review_priority                text,
  type_review_note               text,
  functional_mechanics_candidate text,
  unique (expansion, name),
  foreign key (expansion, pile_id) references public.dominion_kingdom_piles (expansion, pile_id)
);
create index if not exists dominion_kingdom_cards_expansion_idx on public.dominion_kingdom_cards (expansion);

create table if not exists public.dominion_kingdom_printed_types (
  card_id             text not null references public.dominion_kingdom_cards (card_id) on delete cascade,
  printed_type        text not null,
  verification_status text not null,
  primary key (card_id, printed_type)
);

create table if not exists public.dominion_kingdom_mechanics (
  card_id       text not null references public.dominion_kingdom_cards (card_id) on delete cascade,
  expansion     text not null,
  name          text not null,
  mechanic_id   text not null references public.dominion_taxonomy (mechanic_id) on delete cascade,
  evidence_url  text,
  review_status text not null,
  scope_note    text,
  primary key (card_id, mechanic_id)
);
create index if not exists dominion_kingdom_mechanics_mechanic_id_idx on public.dominion_kingdom_mechanics (mechanic_id);

-- -------------------------------------------------------------- landscapes
create table if not exists public.dominion_landscapes (
  object_id            text primary key,
  expansion            text    not null,
  name                 text    not null,
  object_type          text    not null check (object_type in ('Event', 'Landmark', 'Project', 'Way', 'Trait')),
  physical_copies      integer not null check (physical_copies >= 1),
  effect_category      text,
  "trigger"            text,
  verification_status  text    not null,
  notes                text,
  source_url           text,
  classification_scope text,
  unique (expansion, name)
);
create index if not exists dominion_landscapes_type_idx on public.dominion_landscapes (object_type);

create table if not exists public.dominion_landscape_mechanics (
  object_id           text not null references public.dominion_landscapes (object_id) on delete cascade,
  mechanic_id         text not null,
  verification_status text not null,
  source_url          text,
  primary key (object_id, mechanic_id)
);

-- --------------------------------------------------------------- artifacts
-- Renaissance Artifacts are tokens, not Kingdom cards and not landscapes: kept in their own table.
create table if not exists public.dominion_artifacts (
  object_id               text primary key,
  expansion               text    not null,
  name                    text    not null,
  object_kind             text    not null check (object_kind = 'Artifact'),
  physical_copies         integer not null check (physical_copies >= 1),
  cost_coins              integer check (cost_coins >= 0),   -- Artifacts have no cost
  persistent_or_contested text,
  source_url              text,
  initial_effect_tags     text,
  verification_status     text    not null,
  unique (expansion, name)
);

create table if not exists public.dominion_artifact_mechanics (
  object_id           text not null references public.dominion_artifacts (object_id) on delete cascade,
  mechanic_id         text not null,
  verification_status text not null,
  source_url          text,
  primary key (object_id, mechanic_id)
);

-- --------------------------------------------------------------- card text
-- Printed card text, one row per record. record_id is the data package's own key: it matches a catalog id for
-- most Kingdom cards, landscapes and Artifacts, but not all (Plunder uses 'dominion-plunder:<name>'), and some
-- records (Loot, Rewards, Ruins, Shelters, ...) have no catalog row at all — so there is deliberately no foreign
-- key. The app resolves record_id -> catalog object (src/dominion/model.js).
create table if not exists public.dominion_card_text (
  record_id            text primary key,
  name                 text not null,
  expansion            text not null,
  record_kind          text not null,
  card_text            text not null,
  text_source          text,
  text_status          text not null,
  symbol_normalization text,
  source_image_group   text
);

-- ------------------------------------------------- row level security
-- Public reference data: anyone (anon or signed in) may READ, nobody may write through the API.
-- Supabase grants ALL on new public tables to anon/authenticated by default, so revoke first.
do $$
declare t text;
begin
  foreach t in array array[
    'dominion_taxonomy', 'dominion_kingdom_piles', 'dominion_kingdom_cards', 'dominion_kingdom_printed_types',
    'dominion_kingdom_mechanics', 'dominion_landscapes', 'dominion_landscape_mechanics',
    'dominion_artifacts', 'dominion_artifact_mechanics', 'dominion_card_text'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists "dominion_public_read" on public.%I', t);
    execute format('create policy "dominion_public_read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end $$;

-- ------------------------------------------------------------------- views
-- security_invoker: the views run with the CALLER's rights, so they inherit the tables' RLS and grants.
-- (Without it a view runs as its owner and would bypass RLS.)
create or replace view public.dominion_card_catalog with (security_invoker = true) as
select c.*,
  coalesce((select array_agg(t.printed_type order by t.printed_type)
              from public.dominion_kingdom_printed_types t where t.card_id = c.card_id), array[]::text[]) as printed_types_list,
  coalesce((select array_agg(m.mechanic_id order by m.mechanic_id)
              from public.dominion_kingdom_mechanics m where m.card_id = c.card_id), array[]::text[]) as mechanic_ids,
  coalesce((select jsonb_agg(jsonb_build_object('id', m.mechanic_id, 'review_status', m.review_status) order by m.mechanic_id)
              from public.dominion_kingdom_mechanics m where m.card_id = c.card_id), '[]'::jsonb) as mechanics_detail
from public.dominion_kingdom_cards c;

create or replace view public.dominion_landscape_catalog with (security_invoker = true) as
select l.*,
  coalesce((select array_agg(m.mechanic_id order by m.mechanic_id)
              from public.dominion_landscape_mechanics m where m.object_id = l.object_id), array[]::text[]) as mechanic_ids
from public.dominion_landscapes l;

revoke all on public.dominion_card_catalog, public.dominion_landscape_catalog from anon, authenticated;
grant select on public.dominion_card_catalog, public.dominion_landscape_catalog to anon, authenticated;

comment on table public.dominion_kingdom_cards is 'Owned Kingdom card names (one row per name). Mechanic tags are POSITIVE-only and NOT exhaustive: a missing tag is not a confirmed negative.';
comment on table public.dominion_kingdom_piles is 'Kingdom supply piles. A pile can hold several card names (split piles, Knights, Castles).';
comment on table public.dominion_landscapes is 'Events, Landmarks, Projects, Ways and Traits. Not Kingdom cards.';
comment on table public.dominion_artifacts is 'Renaissance Artifacts. Not Kingdom cards and not landscapes.';

commit;

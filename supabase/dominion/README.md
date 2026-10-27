# Dominion collection catalog — database

Read-only reference data for the Dominion section of the site: the Kingdom cards, landscapes and Artifacts of the
boxes we own (Base Game, Intrigue, Hinterlands, Seaside, Prosperity — all Second Edition — Cornucopia & Guilds
Second Edition, Menagerie, Dark Ages, Empires, Plunder, Renaissance). It lives in ten `dominion_*` tables plus two
views, completely separate from the Elo/league tables, and **does not touch `supabase/schema.sql`'s tables**.

| File | What it is |
|---|---|
| `01_schema_and_rls.sql` | Tables, constraints, indexes, RLS, the two catalog views. Safe to re-run. |
| `02_seed_data.sql` | **Generated** from `seed_csv/` by `npm run dominion:seed`. Replaces the ten tables' contents in one transaction. Safe to re-run. |
| `seed_csv/*.csv` + `seed_csv.sha256` | The source data, exactly as supplied in the data package (checksummed). |
| `expected_counts.json` | The package's reference row counts. Tests compare against it; never edit it to make a test pass. |

## What the schema guarantees

- **Public can read, nobody can write through the API.** RLS is on for every table; the only policy is `SELECT` for
  `anon` and `authenticated`; `INSERT/UPDATE/DELETE/TRUNCATE` are not even granted to them (Supabase grants them by
  default, so the schema revokes first). The catalog changes only by re-running the seed as the project owner.
- **Valid keys.** `cards (expansion, pile_id) → piles`, `printed_types/mechanics → cards`, Kingdom mechanics → taxonomy.
  Landscape/Artifact tags have **no** foreign key to the taxonomy on purpose: they use a different vocabulary (87 of
  121 landscape tag ids aren't Kingdom taxonomy ids).
- **Only owned editions.** `edition` is constrained to `Second Edition` or `Original (only edition)`, so a removed
  First Edition card cannot be stored.
- **Mechanics are positive-only.** A missing tag is not a confirmed "no" (the table comment says so too).
- Import order respects the keys (taxonomy → piles → cards → printed types → mechanics → landscapes → …); the delete
  order is the reverse.

## Status

**Applied to the live project (Dominion-League, `hwwwpddinirdrxvvphgl`) on 2026-10-27**, with approval, via
`supabase db query --linked`. Verified afterwards with `npm run dominion:check-live` (all 9 tables and both views
read correctly with the public key; every write attempt refused), by confirming both views are
`security_invoker=true` on the live Postgres 17, and by loading the live data through the app's own loader and
comparing it field-by-field to `seed_csv/`. `supabase db advisors` reports nothing about the `dominion_*` objects.

## Apply it (needs your approval — this changes the live database)

The migration is **additive**: it creates new tables and never alters or deletes anything that exists. The seed only
deletes/inserts rows in the new `dominion_*` tables.

```bash
# 0. (optional but recommended) prove it locally first — builds a throwaway Postgres, never touches Supabase
npm run dominion:test-db

# 1. schema, then data — through the CLI's existing login (no database password needed)
supabase db query --linked -f supabase/dominion/01_schema_and_rls.sql
supabase db query --linked -f supabase/dominion/02_seed_data.sql

# 2. verify what actually landed, read-only, using the public (anon) key exactly as the website does
npm run dominion:check-live
```

Alternatives: paste the two files into **Supabase → SQL Editor** (the seed is ~650 KB; if the editor refuses it, use
the CLI), or `psql "$DATABASE_URL" -f …` with your connection string. If the linked project isn't the one you want,
add `--project-ref <ref>`.

After applying, `supabase db advisors --linked` is a good extra security check.

### Smoke test (SQL editor)

```sql
select (select count(*) from public.dominion_kingdom_cards)     as cards,       -- 331
       (select count(*) from public.dominion_kingdom_piles)     as piles,       -- 310
       (select count(*) from public.dominion_landscapes)        as landscapes,  -- 124
       (select count(*) from public.dominion_artifacts)         as artifacts,   -- 5
       (select count(*) from public.dominion_kingdom_mechanics) as mechanic_relationships,  -- 1634
       (select count(*) from public.dominion_card_text)         as card_text;  -- 500
```

### Undo

Nothing else depends on these tables, so removing the feature is just:

```sql
drop view if exists public.dominion_card_catalog, public.dominion_landscape_catalog;
drop table if exists public.dominion_artifact_mechanics, public.dominion_artifacts, public.dominion_landscape_mechanics,
  public.dominion_landscapes, public.dominion_kingdom_mechanics, public.dominion_kingdom_printed_types,
  public.dominion_kingdom_cards, public.dominion_kingdom_piles, public.dominion_taxonomy;
```

## Updating the data

Edit a CSV in `seed_csv/`, then `npm run dominion:seed` (regenerates `02_seed_data.sql`), `npm test` (the checks include
"the seed matches the CSVs" and the row counts), and re-run the seed against Supabase.

## Card text and the mechanics snapshot

- `dominion_card_text` (`seed_csv/card_text.csv`, 500 records) holds the printed text of Kingdom cards, landscapes and
  Artifacts, plus records that have no catalog row (Loot, Rewards, Ruins, Shelters, ...). It has no foreign key: its
  `record_id` is the data package's own key and equals the catalog id except for Plunder (`dominion-plunder:<name>`),
  which `src/dominion/model.js` maps. The text is a hand transcription (`text_status` says "pending second pass"),
  so the card page says so.
- `kingdom_mechanics.csv` is **Mechanics Batch 81**, a full cumulative snapshot (1,634 rows) — it replaces the earlier
  file wholesale; the seed replaces the table's contents, so there is no incremental patch to apply.
- The site tolerates the text table being absent (card pages say text isn't available yet), so deploying the site
  before applying the SQL is safe.

## Checks

| Command | What it proves |
|---|---|
| `npm test` | The data package's counts and integrity, the data layer (pagination can't truncate), filters, the pages, routes, secrets and SQL safety. |
| `npm run dominion:test-db` | Applies schema + seed (twice) to a throwaway local Postgres and tests constraints, RLS and privileges as `anon`/`authenticated`, and that the data equals the original bundle's own import. Needs `initdb`/`psql`. Postgres < 15 can't create `security_invoker` views, so on an older local Postgres that one option is skipped — check the views on the real project (step 2 above does). |
| `npm run dominion:check-live` | Read-only, anon-key check of the live project: row counts, and that writes are refused. |
| `npm run check:build` | After `npm run build`: relative asset paths, no secrets in `dist/`. |

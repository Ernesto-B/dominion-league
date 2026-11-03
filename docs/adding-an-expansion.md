# Adding or switching an expansion

## Turning a set on or off (no code)

**Admin > Settings > Sets.** Tick the sets you own. An unticked set is left out of:

- the set pickers (Add Game, Game night) and the Games set filter,
- the Collection (Cards, Landscapes, Insights, the card pages' lists) and the Randomizer, Game night's kingdom step and snake draft,
- the badges and XP: its expansion badges are hidden, "Master of All Realms" and the other Collection badges stop counting its cards, and a card from it
  counts for nothing in any other badge (so XP can drop).

Nothing is deleted. A game keeps its kingdom (cards from an unticked set still show their names and pictures in old games and reports), and a player's badges are
never stored: they are worked out from the games on every load. **Tick the set again and everything comes back exactly as it was**, including the badges. (The "New
badge" card on the front page never announces a badge that returned this way; it only remembers more, never less.)

How it works, for whoever maintains this: `scopeCatalog()` in `src/dominion/model.js` filters the catalog once, `catalogStore.setScope()` hands it the league's
enabled sets, and every screen reads the filtered catalog. `catalog.strict` (used by badges, XP and the game report's counts) also forgets the ids of switched-off
cards; the plain catalog keeps knowing them so old games still display.

## Adding a NEW expansion (one that is not in the site yet)

Three things have to exist: its **rows in the catalog**, its **icon**, and **one line in the registry**. Everything else (the Admin tick box, the set filters, the
badge tracks, the Randomizer chips, the Insights charts) is built from those.

1. **Catalog rows (the only part that is real work).** The catalog is the owner's data package, loaded from ten CSVs in `supabase/dominion/seed_csv/`
   (`kingdom_cards`, `kingdom_piles`, `kingdom_printed_types`, `kingdom_mechanics`, `landscapes`, `landscape_mechanics`, `artifacts`, `artifact_mechanics`,
   `card_text`, `taxonomy`). Get the new expansion's rows in the same format (the same columns, `edition` = `Second Edition` or `Original (only edition)`), and
   never invent card data or text. Then:
   - add the rows to the CSVs,
   - update `supabase/dominion/seed_csv.sha256` (`cd supabase/dominion/seed_csv && shasum -a 256 *.csv > ../seed_csv.sha256`) and `expected_counts.json` (the new
     totals, from the package's reference counts),
   - `npm run dominion:seed` (regenerates `02_seed_data.sql`), then `npm test` (the data tests check counts, keys and checksums),
   - `npm run db:apply -- catalog` (asks for confirmation, then re-seeds the live catalog). Browsers refresh their saved copy on their own; there is no cache to bump
     unless the SHAPE of the rows changed.
2. **Icon.** The owner supplies the artwork. Resize it (`sips -Z 128 <file>`) into `public/icons/sets/<name in kebab-case>.png` (`Rising Sun` -> `rising-sun.png`).
   `npm test` fails with the file name if it is missing.
3. **Registry.** Add one entry to `EXPANSIONS` in `src/dominion/constants.js`:
   `'<catalog expansion name>': { label: '…', icon: '<set key>', order: N, badges: ['half badge name', 'full badge name'] }`.
   `badges` is optional: without it the two expansion badges are called "<label> Explorer" and "<label> Master" until you pick names. `icon` is the set key the
   league stores (it can differ from the catalog name: the catalog says `Dominion Base Game`, the league says `Base`).
   Adventures and Rising Sun are already listed (no cards in the catalog yet, so they do nothing until step 1 is done).
4. **Tick it** in Admin > Settings > Sets. A set that is not in the saved list starts unticked, which is also how you stage a new expansion before the group has it.
5. Optional: its card pictures (`npm run cards:build -- <folder>`, `npm run cards:upload`, see `card-images.md`), and add the name to the default list in
   `supabase/schema.sql` (`settings.enabled_sets`) so a brand-new database starts with it.

`npm test` has a test that every expansion in the catalog has a registry entry and every registry entry has its icon, so a missed step fails before it ships.

# AGENTS.md — Dominion Night

Instructions for AI coding agents working on this repo. For end-user setup/operations (Supabase setup, how seasons work, etc.), see `README.md` — this file is about how the *code* is built and the conventions already established, so changes stay consistent with what's here rather than introducing a second style.

## What this is

A static Dominion board-game league tracker: Elo rankings, seasons, head-to-head, records, a game log. No build step, no bundler, no framework — plain HTML/CSS/JS, hosted on GitHub Pages. Supabase (Postgres + Auth + Edge Functions) is the entire backend; the browser talks to it directly over its REST/Auth/Functions APIs.

## Hard constraints — read before changing architecture

- **GitHub Pages only, by explicit owner preference.** Never introduce another hosting/deploy target. Any server-side need goes through Supabase (Postgres RLS/RPCs, or an Edge Function), not a separate platform — Edge Functions deploy to Supabase's own infrastructure, not GitHub Pages, so they don't conflict with this.
- **React + Vite, built and deployed by GitHub Actions.** The site used to be no-build vanilla JS; the owner chose to move it to React (branch `react-migration`). `npm run build` produces `dist/`, which `.github/workflows/deploy.yml` publishes to GitHub Pages (Pages source must be set to "GitHub Actions" — "Deploy from a branch" would publish unbuilt source). Still no TypeScript in the browser code, and still hash routing (`#/<route>`), which keeps GitHub Pages working without a 404 fallback. `vite.config.js` uses `base: './'` so it works from a repo subpath or a custom domain. Static assets (`icons/`, `images/`, `data/`) live in `public/` and are copied through untouched.
- **Icons are never invented.** The owner generates all icon/image assets themselves and drops them in `~/Downloads/...`; an agent's job is to resize (`sips -Z <px>`) and wire them in. Never substitute a default emoji as a placeholder — ask, or leave the slot as plain text until an asset exists.

## Architecture

```
src/lib/engine.js — pure computation, single-league only (no group concept at all — see
                 Group scoping below). compute(config, rows, today) -> {ranked, seasons,
                 seasonStandings(), h2h(), records, ...}. No DOM, no fetch, runs in
                 Node or the browser identically (ES module). Treat this as the "model" layer.
src/lib/       — framework-free modules: engine.js, format.js (esc/f0/pc/... helpers),
                 supabase.js (client + public URL/anon key), data.js (fetchConfig/loadData:
                 Supabase queries -> engine row shape), league.js (buildLeague: one
                 Eng.compute() per group), route.js (parseHash/hashFor), sets.js.
src/League.jsx — React context + the session state machine (loading -> login | pwchange |
                 ready | error). boot() refetches and recomputes while staying 'ready'.
src/App.jsx, src/components/ — the shell (Header/nav, footer, skip link, document title),
                 Login, PasswordChange. src/useHash.js is the hash router.
src/pages/, src/components/, src/PageContext.js — the pages. src/pages/index.js maps route ->
                 component; App renders the current one inside PageContext (D already scoped to the
                 group, gid, arg, me, allGroups, hashFor, reload...). Pages run inside PageBoundary,
                 so a render error shows a message
                 in <main> instead of unmounting the whole app. Shared pieces: TierIcon, SetIcon,
                 NameIcon, PlayerLink, GroupSwitcher, Banner, TypePill, LandscapePills, DateAnchor,
                 GameFinish/GameDetail/GamesTable (expandable game rows), SeasonTable/SeasonRecap,
                 RatingChart, StatTile/HoverPopup/PopLayer (the shared hover popup, one node on <body>),
                 TierProgressBar, GameModal (the Add/Edit Game dialog), and SortableTable (click-to-sort
                 tables; supports expandable detail rows).
src/dominion/  — the Dominion collection section (#/dominion[/cards[/<id>] | /landscapes[/<id>]]).
                 api.js is the ONLY file that knows table/view names (fetchAllRows pages with .range() and
                 THROWS on a count mismatch; describeError turns any failure into a fixed safe message);
                 model.js normalizes rows; filters.js / stats.js are pure; the browsers' filter state lives in the URL
                 hash query (`#/dominion/cards?type=Attack`; filters.js has the codec, urlState.js writes it with
                 replaceState, useUrlFilters.js is the hook, scrollMemory.js restores the list scroll on return);
                 randomizer.js is the PURE Kingdom draw (rules, locks, re-rolls, the link codec, setup notes);
                 kingdom.js (a game's kingdom items, name search), kingdomDraft.js (the Randomizer -> Add Game hand-off),
                 sunburst.js (pure geometry + data for the sunburst view of "Card types by expansion", incl. zoomData() for the
                 click-to-zoom down to individual cards, drawn by components/SunburstChart.jsx in the type-pill colours — the `--t-*` variables in style.css);
                 playStats.js (pure play counts / insights) and useLeagueGames.js (the viewer's group's games, from
                 PageContext; null outside the league) tie the Collection to the league;
                 views/ + components/ are presentational (they read the catalog from
                 CatalogContext, so tests can render them with real data). Data: supabase/dominion/ (SQL,
                 generated seed, CSVs). `dominion` is a GLOBAL route like `admin` (route.js GLOBAL_ROUTES): it
                 never carries a group segment.
style.css      — one file, CSS custom properties for theming, light/dark via
                 prefers-color-scheme.
index.html     — the shell Vite builds from: #root (React mounts here), #modalRoot (the
                 modal's portal target) and one module script. No per-page HTML files;
                 everything routes through #/<route>/<arg> in src/App.jsx.
```

**The rating model** is chosen by `config.elo.model` in `public/data/config.json`. `classic` (the engine's default when the key is absent, and what the
spreadsheet verified) is pairwise Elo, K=200. The league runs `steady` (`src/lib/steadyElo.js`): K=100 (200 while provisional), a points-per-finish
table that pays the top half first and the win second, half the top-half bonus for the exact middle of an odd table, and a table that pays `target`
(0.52) of the points on average, which is the deliberate slow upward drift. Tier thresholds in `config.json` are the K=200 ones scaled by K/200
(1125 / 1275 / 1475 / 1700): change K and the tiers together. Ratings are recomputed from the games on every load, so changing the model rewrites history.

**Season score** = the average of each Regular game's season points (finish points 1 -> 0, plus a win-streak bonus and a VP bonus, both set in
`config.season`; see `g.sp` in the engine) with `prior` imaginary average games. The VP bonus is a table-centred ratio to the winner's VP, so it
never depends on how many VP an expansion produces. There is no Head to head page: its matrix (`components/H2HMatrix.jsx`) is on each Player page,
and `#/h2h` redirects to Players.

**Data flow**: `boot()` in `src/League.jsx` → Supabase queries (`loadData()` in `src/lib/data.js`) (`players`, `games`,
`game_results`, `groups`, `seasons`) → `loadData()` reconstructs them into the exact
row shape `engine.js` has always expected (a `finish` string like `"Jose > Bob = Cara"`,
reconstructed from the normalized `game_results.place` column) → `buildLeague()` → `Eng.compute(cfg, rows)`
→ `App` parses the hash and renders that route's page component, which reads the scoped model through `usePage()`.

This adapter-in-the-middle design is deliberate: `engine.js` was written once, verified
against a spreadsheet, and has never needed to change for any of the Supabase/auth/admin
work layered on top of it. Keep extending it that way — add fields to the row shape
`loadData()` builds rather than changing what `engine.js` assumes about its input, unless
the change is genuinely about the math/model itself.

## Conventions that exist for a reason

- **`<StatTile icon big label popup>`** (`src/components/StatTile.jsx`) builds the icon+number+label
  tiles used across the Players/Season/Records pages. `icon` is optional — a tile without one
  renders identically to a plain `.stat` tile, so it's safe to reuse everywhere. Icons are
  **unconditional** even when the stat is 0 (a tile that hides its icon at zero looks broken, not
  clean — this was a real bug, fixed once already).
- **Every game has a permanent id** — `games.id` in the database, exposed as `game.line` everywhere
  in the model. A link to one game is `hashFor('games', gid, game.line)` → `#/games/<group>/<id>`:
  the Games page clears any filter that would hide it (on arrival only), opens the row, scrolls to
  it and tints it (`tr.grow.hl`). Records and Players link their dates this way; do the same for any
  new "this game" mention. Engine records that point at a game must carry `line` (Elo gain/drop do).
- **Group scoping: each group is a fully separate league, not a filtered view of one
  shared dataset.** `buildLeague()` in `src/lib/league.js` calls `Eng.compute()` once per group the
  viewer belongs to, each time with only that group's players/games/seasons —
  `computedByGroup[groupId]`. `render()` picks the right one into the module-level `D`
  before calling a page function, so page functions read `D.ranked`/`D.players`/
  `D.records`/etc. directly with **no group filtering of their own** — if you're adding
  a new per-group view, trust that `D` is already scoped; filtering it again is a sign
  something's wrong upstream, not a thing to add. `engine.js` itself has zero concept of
  groups — don't reintroduce one there; group-splitting belongs in `buildLeague()`. The one
  cross-group page is **Admin** (`pageAdmin`), which manages the whole site and reads
  `allGroups`/`rawPlayers`/`rawSeasons` (unfiltered, built once by `buildLeague()`) instead of
  `D`. A game belongs to exactly one group (`games.group_id`, chosen implicitly by
  `curGid` when the admin logs it, validated server-side in `add_game`/`edit_game`) —
  not inferred from who's at the table. Group membership (`players.group_ids`, an
  array) lets one player belong to several groups with **completely independent** Elo
  per group — real separation, not the same number viewed two ways.
- **Group visibility is enforced by RLS, not the client.** `my_groups()` (SQL function)
  returns the caller's `group_ids`; `games_select`/`seasons_select`/`groups_select`/
  `players_select` all key off it, so a row for a group the viewer isn't in never comes
  back from Supabase at all — `loadData()` only ever sees what the viewer is allowed to
  see. Don't add client-side-only group filtering anywhere and consider it a security
  boundary; the boundary is the database policy.
- **Admin writes go through RPCs, not raw table inserts**, wherever a write touches more
  than one table (`add_game`/`edit_game`/`delete_game` in `supabase/schema.sql` keep
  `games` and `game_results` in sync atomically, re-checking `is_admin()` server-side —
  never trust client-side admin checks alone). Single-table writes (`groups`, `seasons`)
  are fine as direct RLS-gated client calls — don't add an RPC for those, it'd be pure
  ceremony.
- **The modal pattern** (`src/components/GameModal.jsx`): the page that opens a modal owns its
  open/closed state (`const [modal, setModal] = useState(null)`) and renders `<GameModal onClose=…>`
  itself, which portals into the static `#modalRoot`. Form state is local `useState`, not the URL
  hash, so a route change unmounts (closes) the modal for free. Escape / overlay click / ✕ all call
  `onClose`; the body scroll lock is set on mount and released on unmount. Because the portal stays
  inside the React tree it keeps `PageContext` — unlike `PopLayer`, which doesn't. Writes still go
  through the `add_game`/`edit_game`/`delete_game` RPCs, then `reload()` refetches. Follow this
  shape for the next modal rather than routing modal state through the URL hash.
- **Dark-mode-only visual effects** (the background image, frosted-glass panels) are
  scoped under `@media (prefers-color-scheme:dark)` and placed **last** in `style.css`
  intentionally — see the gotcha below.

## Verifying a change by parity (how the React migration was checked)

The whole migration was done page by page, each checked against the page it replaced. The same
technique is the best way to prove any refactor *doesn't* change what users see:

1. Use the previous commit as the oracle: `git archive <commit> | tar -x` into a scratch dir, build
   both trees with the fake-Supabase config (see Testing #4) on different ports, and diff `#main`
   after normalizing (sort attributes, merge adjacent text nodes, ignore `onerror`/`onclick`).
   Then click every sortable header on both and diff the row order. Two real bugs this caught the
   first time: tie-break order (the old sorter sorts from the *displayed* order) and sort keys (it
   sorts on visible text, e.g. "not decided"). Make the fake data rich enough that every section
   renders — check the section headings, an identical half-empty page proves nothing. Count the
   conditional bits too (`querySelectorAll` for crowns, rank arrows, ...): e.g. rank-move arrows
   need >= 2 game nights *and* a rank change on the last one, so the fake has an opt-in `?data=swing`
   scenario. Serialize the **live** DOM without mutating it (never `normalize()` it — that breaks
   React's node refs), compare `<select>`s by `.value`, inputs by live value, and `style` by
   `cssText`, and click row chevrons, not row centers (a player link sits in the middle).
2. Drive the interactions on both builds and snapshot after each step (expand, sort, filter, hover,
   modals, forms); a static diff alone misses state bugs. For anything that writes, make the fake
   record every write — `rpc(name, args)`, `from(t).insert/update`, `functions.invoke` — and offer a
   one-shot `window.__failNext`, then diff the payload logs between builds. That is the check that
   protects data, more than any DOM comparison. Behavior that *intentionally* differs gets noted in
   the commit message.
3. Type like a browser: set input values through the **native** value setter and dispatch `input`
   (and `change` for selects). Assigning `el.value = …` bypasses what React tracks, so React rightly
   ignores it.

4. **Popup/portal content has no context.** A React element carries no context with it — context is
   resolved where it is *rendered*. `PopLayer` renders popup content outside `PageContext`, so a
   component used as popup content must not call `usePage()`; pass what it needs as props. (This
   crashed the whole app on hover until a parity run caught it.)
5. **Deleting dead helpers:** `node --check` can't see a missing identifier, and a word-count of
   references is fooled by comments, prose, and long template strings. After deleting, diff the set
   of top-level definitions against the previous version and search every removed name for a
   *call site per line* (`name(`), including inside `${...}`. Then exercise the paths that used them
   (open Add Game and pick players so the preview renders; open every Admin section).
6. Adjacent text nodes shape separately in the browser: `{n} game{s}` can be a pixel wider than the
   same text as one string. Build short label strings with a template literal when exact layout
   parity matters. Fake-data scenarios in the test harness: `swing` (rank movement), `odd` (undated
   season, no-seasons group, friendly-only player, empty group), `rich` (landscape tiles + both rivals + a tied game), `nogroups` (a site with no groups yet).

## Phones (most visitors use one)

- The touch-size rules are the **last block of `style.css`** (`@media (pointer:coarse)`: 44px targets) so they beat the earlier
  size rules — keep new controls at 44px there rather than in each component's rule. Layout rules for a narrow screen live in
  the `max-width:720px` blocks; that is also where `.dn-hide-sm` hides non-essential columns.
- Phone patterns already in use: browser filters fold into `<FilterFold>` (open on desktop, closed on a phone); a crowded
  list shows just the set's icon (`.dn-browse` hides `.dn-exp-label`; `SortHeaders` takes a short heading); a game's less
  important columns move into its expanded row; an expanded row must never widen its table (`tr.gdetail>td{max-width:0}`).
- Headless Chrome will not go below 500px wide, so `--window-size=390` silently tests 500. Drive it over the DevTools protocol
  instead (`Emulation.setDeviceMetricsOverride` with `mobile:true`, touch on, a phone user agent; Node's built-in
  `WebSocket` is enough, no packages). Useful audit per page: horizontal overflow (`documentElement.scrollWidth`), interactive
  elements under 40px, text under 12px, tables that still scroll sideways.
- The Collection catalog is cached in `localStorage` (`catalogStore.js`, stale-while-revalidate, key `dl.catalog.v1`): bump the
  key whenever the shape of the raw catalog rows changes. `React.lazy` splits the Collection, Admin, the Add Game dialog and a
  game's kingdom list out of the main bundle; `vite.config.js` gives React and the Supabase client their own long-cached chunks.

## UX experiments (branch `ux-experiment`)

- Every experiment sits behind a flag in `src/ux.js` (`?ux=none|all|nav,home,...`, remembered in localStorage, switchable from the footer),
  and becomes a class on `<html>` (`ux-nav`, `ux-lists`, ...). With the flags off the site must behave exactly as on `main` — the CSS is all
  keyed on those classes, and the old Add Game dialog was verified to send the identical payload.
- `npm run dev:fake` runs the whole site on in-memory data (`dev/fakeSupabase.js`, swapped in by `vite.fake.config.js`; never part of the
  real build). `dev/cdp.mjs` + `dev/ab-tasks.mjs` drive an emulated phone to compare A and B.
- The `lists` flag also swaps the phone's game tables for `components/GameCards.jsx` (Last night and the Games page share the open/closed
  state with the table beside them), shows the form dots under each ladder name, and draws `RatingChart` at phone width with tappable name
  chips.
- `dominion/components/RandomizerOptions.jsx` is the one options panel (expansions, counts, rules, include/exclude) used by the Randomizer
  page and the Game night Kingdom step. Rules in `REQUIRE_RULES` are either mechanic `tags` (positive-only) or an exact printed `coins` cost.
- The `redesign` flag: Rankings opens with you (`MeCard`), then `SinceVisit` (what changed since the viewer last looked, from `lib/lastVisit.js`;
  a snapshot per group in localStorage `dl.seen.<group>`, shown until dismissed, never nudging), the ladder, last night, the chart and highlights,
  with the explanations folded into "How ratings and tiers work". The Games filters fold on a phone (`components/FilterFold.jsx`), the desktop
  ladder's bar becomes a thin line under the name, and "Game saved" says what the game did (`gameSummary` in `lib/night.js`). The Season table
  keeps six columns on a phone under `lists`.
- Shared pieces extracted so the dialog and the Game night flow can't drift: `src/lib/gameForm.js` (VP sort, results, RPC arguments),
  `components/FinishOrder.jsx`, `components/EloPreview.jsx`. Flow state: `src/lib/night.js`.

## Game kingdoms (the Collection <-> the league)

- A game's kingdom lives in `game_kingdom` (`supabase/schema.sql`): one row per card/landscape, `item_id` a Dominion catalog
  id, `on_id` the card a Plunder Trait sits on. **No foreign key to the catalog**: the catalog is re-seeded by delete-then-
  insert, which a FK would block. `write_game_kingdom` (internal, not callable by clients) validates the ids and the caps
  (12 cards, 6 landscapes) inside `add_game`/`edit_game`, so a bad id fails the whole save atomically.
- `p_kingdom` is an optional trailing argument: omitted/null = leave as is, `[]` = clear. The client therefore **sends it
  only when there is something to say** (a new game with cards, or an edit that touched the kingdom), which keeps an older
  database working with a newer site. The game rows the engine sees carry `kingdom` (display only, never read by the maths).
- A split pile (Knights, Gladiator / Fortune) is ONE kingdom slot and is logged as one card id; `displayName()` shows the pile.
- The randomizer's rules: *excluding* uses printed types (complete); *requiring* uses mechanic tags (positive-only — a card can
  be missed, never wrongly counted). Keep it that way. Setup notes (Bane, Platinum/Colony, Shelters, Ruins) follow the official rules.
- Filters AND the rolled kingdom live in the URL hash query (`urlState.js` writes with `replaceState`; `useHash` only scrolls
  to the top when the *path* changes). Anything new on the Collection that has state worth sharing should follow suit.
- Play counts/insights are for the group the viewer last picked (`page.gid`); the Collection itself has no group in its URL.

## Dominion collection conventions

- **Never conflate the counts.** Card *names* (one per `dominion_kingdom_cards` row), supply *piles* (a split
  pile, Knights and Castles are ONE pile with several names, so names >= piles), *physical* cards (sum of pile
  copies), landscapes and Artifacts are five different things. Landscapes and Artifacts are never Kingdom cards.
- **Mechanic tags are positive-only and non-exhaustive.** A missing tag is NOT a confirmed "no". There is
  deliberately no "without"/"exclude" filter anywhere (a test enforces this), the owner removed the on-page disclaimers and the
  review-status table as clutter (the *behaviour* — never a "without" filter, rules that require tags only ever add cards — is
  what keeps this honest). Landscape/Artifact
  tags use a *different vocabulary* from the Kingdom taxonomy — never join them to it.
- **A multi-type card has several printed types** and is listed/counted under each (122 of the 331 names).
- **Supabase silently truncates responses (1,000 rows by default).** Anything that could grow past that goes
  through `fetchAllRows` (count first, page with a stable order, throw on mismatch) — never a bare `.select()`.
  Client-side filtering is only valid because the complete set was fetched and verified.
- **Never invent card text, artwork, descriptions or strategy.** Card text comes only from `dominion_card_text`
  (a hand transcription, flagged as such on the page); the dataset has no artwork or strategy, so the UI omits those
  and says so. The landscape `notes` are a classification summary and are labelled as not official text.
- **Ownership isn't hardcoded.** The owned expansions are whatever the catalog contains; `constants.js` only
  labels and orders the known ones. The schema forbids First Edition rows.
- The data package is authoritative. Row counts live in `supabase/dominion/expected_counts.json`; if a test fails
  on a count, investigate the data — don't edit the reference to fit.
- The nav link is labelled **Collection** (the route/URL stays `#/dominion`; the tab title comes from `ROUTE_TITLES` in
  `route.js`). Its icon is the owner's `public/icons/nav/collection.png` (128×128, like the other nav icons).
- The "why the numbers differ" explanation is a closed `<details className="help">` (the site's existing ⓘ help pattern)
  under the title, not a permanent block and not a custom popover.
- Popup/portal content has no PageContext, and these views read `CatalogContext` — keep that in mind if you
  ever render catalog content outside `DominionData`/`CatalogProvider`.

## Gotchas already paid for — don't rediscover these

- **Write `backdrop-filter` once, unprefixed — never also `-webkit-backdrop-filter`.** Vite's CSS
  minifier (lightningcss) keeps the hand-written `-webkit-` line and silently drops the standard one,
  so the built site had *no blur* in Chrome and Firefox while looking fine in `npm run dev`
  and in Safari. The build adds the `-webkit-` prefix itself. After touching glass/blur CSS, check
  the **built** output: `grep -o "[^}]*backdrop-filter[^}]*}" dist/assets/*.css` should show both,
  and `getComputedStyle(el).backdropFilter` in a real Chrome should not be `none`.

- **`CREATE POLICY` has no `IF NOT EXISTS`.** Re-running `schema.sql` against an
  already-migrated database used to abort partway through on a "policy already exists"
  error, silently skipping every statement after it — including function updates. Every
  policy is now `drop policy if exists X; create policy X ...` in pairs. Keep that pattern
  for any new policy.
- **`SECURITY DEFINER` RPCs bypass RLS, including the sequence grant RLS would normally
  need.** `groups`/`seasons` are written directly by the client (no RPC), which means they
  needed an explicit `grant usage on sequence ... to authenticated` that `games`/
  `game_results` never needed (those only get written through RPCs owned by the schema
  deployer). If a new table gets admin-only direct writes, it needs this grant too — this
  was only caught by actually running the schema against a throwaway local Postgres and
  testing an insert as a non-owner role, not by reading the SQL.
- **CSS cascade order matters more than it looks like it should.** The glass-panel
  overrides are placed at the very end of `style.css`, not near the components they
  theme, specifically so they reliably beat each component's own earlier dark-mode
  background rule (e.g. `.top`'s hardcoded `#0B1015`). Adding a new dark-mode override
  near its component instead of at the end is a likely silent no-op.
- **`background-attachment:fixed` is unreliable on iOS Safari** (often just ignored,
  scrolls anyway) and is sized relative to the element's own box, which varies by page
  content height. The background is a `position:fixed` pseudo-element instead — pinned to
  the viewport unconditionally, consistent on every page, no mobile-specific fallback
  needed.
- **Pages with a vertical scrollbar render centered content a few px narrower** than pages
  without one, which reads as "things shift when I navigate." Fixed globally with
  `html{overflow-y:scroll}` (always reserve the gutter) rather than per-page.
- **GitHub Pages is case-sensitive**; local macOS development isn't. A path that works
  locally can 404 live if the case doesn't match the committed filename exactly. Worth a
  `git ls-files` check after adding assets, not just a local preview.
- **Browser caching on GitHub Pages can make a real fix look like it didn't work** — a
  hard refresh resolved what looked like a bug at least once this session. If a described
  symptom doesn't match what the code clearly does, ask whether it's been hard-refreshed
  before assuming the code is wrong.

## Testing — what's actually available

**`npm test`** (Vitest, Node only — no browser) runs ~265 tests on the REAL Dominion data: dataset counts and
integrity, the data layer (including the 1,000-row truncation trap), filters, every Dominion view rendered with
`react-dom/server`, routing (existing routes included), no-secrets-in-source, and SQL safety. **`npm run
dominion:test-db`** builds a throwaway local Postgres and tests the schema, seed, constraints and RLS/privileges
(Postgres < 15 can't make `security_invoker` views, so that one option is skipped locally). **`npm run kingdom:test-db`** builds a throwaway Postgres with Supabase's `auth` schema stubbed and tests `game_kingdom`, the
`p_kingdom` argument of `add_game`/`edit_game` (atomic rejection, older-client compatibility), who can read/write it, and that
re-seeding the catalog isn't blocked. There is no linter or
type checker in this project, so none is run. The browser-level checks below are still ad hoc (not committed).

There is no interactive browser available to the agent. What's actually been used
to verify changes, in order of how often (a real headless Chrome *is* usable for DOM dumps,
see the end of this list):

1. `npm run build` — catches syntax and import errors, every change. (`node --check` can't see a
   missing identifier; see gotcha 5 below.)
2. Direct `node -e "..."` scripts importing `src/lib/engine.js` (plain ES module, works in Node) to
   assert on real computed output — e.g. feeding synthetic games through `compute()` and
   checking standings/Elo/records match hand-computed expectations. This is the main way
   engine-layer changes get real verification, not just "it parses."
3. For schema/RLS changes: a **throwaway local Postgres** (`initdb`/`pg_ctl` into
   `/tmp`, stubbed `auth.users`/`auth.uid()`/roles to approximate Supabase), with
   `schema.sql` applied and RLS tested by `SET ROLE authenticated` + a settable
   `test.uid()` to simulate specific users — table-owner sessions silently bypass RLS, so
   testing as `postgres` proves nothing. Always tear the cluster down afterward
   (`pg_ctl stop`, `rm -rf` the data dir) — it's disposable, not part of the repo.
4. Real-browser tests without a Supabase login: build a throwaway variant (config kept
   **outside** the repo, e.g. in the scratchpad) whose Vite plugin `resolveId`-swaps
   `src/lib/supabase.js` for an in-memory fake (`getSession`, `from().select/order/range/eq/
   single/maybeSingle/insert`, `rpc`). A plain `resolve.alias` is NOT enough — it matches the
   import *specifier*, so relative imports slip past it. Serve that build, then drive it with
   `puppeteer-core` pointed at `/Applications/Google Chrome.app` (npm-installed outside the
   repo): click through the nav, groups, modal, mobile menu, login, and check for page errors.
   For a quick look without clicks, `Google Chrome --headless=new --virtual-time-budget=8000
   --dump-dom <url>` works too. (jsdom does **not** run `type=module` scripts.)
   For the Collection, a faster variant worked well: a throwaway harness INSIDE the repo (a `.harness/` folder, deleted
   afterwards) whose Vite plugin swaps `src/lib/supabase.js` for an in-memory fake built from the seed CSVs, mounting the
   REAL `src/main.jsx`, plus a scenario script that drives the live DOM and writes PASS/FAIL lines into the page; run it with
   `Google Chrome --headless=new --virtual-time-budget=90000 --dump-dom <url>` and grep the lines. Headless Chrome barely
   fires `scroll` events, so record scroll positions at navigation time, not from scroll listeners.
5. Visual/UX verification is **always** the owner's — say so explicitly rather than
   claiming a styling or layout change "looks right."

## Deployment

- `main` → GitHub Pages, built and published by `.github/workflows/deploy.yml` (Vite build → `dist/`) on every push.
- `supabase/schema.sql` is meant to be safely re-run in the Supabase SQL editor after any
  change to it (that's the whole point of the `drop policy if exists` pattern and
  `create table if not exists` / `add column if not exists` throughout) — confirm new
  additions keep that property before committing.
- `npm run db:apply -- <catalog|league|all>` applies the SQL files to the linked project (confirmation prompt, `--dry-run`, then the
  read-only live check). It uses the Supabase CLI's own login; `supabase/.temp/` (the CLI's link state) is gitignored and untracked.
- `supabase/functions/create-player/` deploys via the Supabase CLI
  (`supabase functions deploy create-player`), separately from the site. Already linked
  locally (`supabase/.temp/` holds the CLI's link state — not secret, but not meant to be
  committed either; gitignored going forward).
- `scripts/migrate.mjs` is a one-time bootstrap script (service-role key via env var,
  never committed, never pasted in chat) — not part of the regular deploy flow.

## Secrets

- Service-role key: local env var only, for `migrate.mjs` and nothing else. Never in a
  file, never in client code, never in chat.
- Anon/publishable key (`src/lib/supabase.js`) and the project ref are meant to be
  public — that's how Supabase's client-side model works. Don't treat them as secrets or
  warn about committing them.

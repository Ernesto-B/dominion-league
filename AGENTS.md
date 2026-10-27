# AGENTS.md — Dominion Night

Instructions for AI coding agents working on this repo. For end-user setup/operations (Supabase setup, how seasons work, etc.), see `README.md` — this file is about how the *code* is built and the conventions already established, so changes stay consistent with what's here rather than introducing a second style.

## What this is

A static Dominion board-game league tracker: Elo rankings, seasons, head-to-head, records, a game log. No build step, no bundler, no framework — plain HTML/CSS/JS, hosted on GitHub Pages. Supabase (Postgres + Auth + Edge Functions) is the entire backend; the browser talks to it directly over its REST/Auth/Functions APIs.

## Hard constraints — read before changing architecture

- **GitHub Pages only, by explicit owner preference.** Never introduce another hosting/deploy target. Any server-side need goes through Supabase (Postgres RLS/RPCs, or an Edge Function), not a separate platform — Edge Functions deploy to Supabase's own infrastructure, not GitHub Pages, so they don't conflict with this.
- **Migrating to React + Vite (branch `react-migration`).** The owner has chosen to drop the old "no build step" rule. `npm run build` now produces `dist/`, deployed to GitHub Pages by `.github/workflows/deploy.yml` (Pages source must be set to "GitHub Actions"). Still no TypeScript in the browser code, and still hash routing (`#/<route>`), which keeps GitHub Pages working without a 404 fallback. The migration is incremental: the legacy `src/legacy/pages.js` keeps rendering everything not yet ported, while React (`src/`) takes over page by page. Static assets (`icons/`, `images/`, `data/`, legacy `js/`) live in `public/` and are copied through untouched.
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
                 Login, PasswordChange, and LegacyPage. src/useHash.js is the hash router.
src/pages/, src/components/, src/PageContext.js — ported pages. src/pages/index.js maps route ->
                 component; App renders those inside PageContext (D already scoped to the group,
                 gid, arg, me, allGroups, hashFor, reload...) and sends every other route to
                 LegacyPage. Ported pages run inside PageBoundary, so a render error shows a message
                 in <main> instead of unmounting the whole app. Shared pieces: TierIcon, SetIcon,
                 NameIcon, PlayerLink, GroupSwitcher, Banner, TypePill, LandscapePills, DateAnchor,
                 GameFinish/GameDetail/GamesTable (expandable game rows), SeasonTable/SeasonRecap,
                 RatingChart, StatTile/HoverPopup/PopLayer (the shared hover popup, one node on <body>),
                 TierProgressBar, and SortableTable (React replacement for the old DOM-mutating
                 makeSortable; supports expandable detail rows).
src/legacy/pages.js — what's left of the old renderers: the Admin page and the Add/Edit Game
                 modal (opened from React via openGameModal(ctx, editId)). Template-literal strings
                 written into <main>/#modalRoot. Rankings, Season, Players, Head to head, Records and
                 Games are all React now; this file shrinks as Admin and the modal are ported.
style.css      — one file, CSS custom properties for theming, light/dark via
                 prefers-color-scheme.
index.html     — static shell + script tags. No per-page HTML files; everything
                 routes through #/<route>/<arg> in app.js.
```

**Data flow**: `boot()` in `src/League.jsx` → Supabase queries (`loadData()` in `src/lib/data.js`) (`players`, `games`,
`game_results`, `groups`, `seasons`) → `loadData()` reconstructs them into the exact
row shape `engine.js` has always expected (a `finish` string like `"Jose > Bob = Cara"`,
reconstructed from the normalized `game_results.place` column) → `buildLeague()` → `Eng.compute(cfg, rows)`
→ `App` parses the hash and `LegacyPage` calls `renderLegacyPage()`, which picks a page function and swaps `main.innerHTML`.

This adapter-in-the-middle design is deliberate: `engine.js` was written once, verified
against a spreadsheet, and has never needed to change for any of the Supabase/auth/admin
work layered on top of it. Keep extending it that way — add fields to the row shape
`loadData()` builds rather than changing what `engine.js` assumes about its input, unless
the change is genuinely about the math/model itself.

## Conventions that exist for a reason

- **`statTile(iconSrc, big, label, iconClass)`** (`src/legacy/pages.js`) builds the icon+number+label
  tiles used across Player/Season/Records pages. Icon is optional — tiles without one
  render identically to plain `.stat` tiles elsewhere, so it's safe to reuse everywhere.
  Icons are **unconditional** even when the stat is 0 (a tile that hides its icon at zero
  looks broken, not clean — this was a real bug, fixed once already).
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
- **The modal pattern** (`openAddModal`/`renderAddModal`/`closeAddModal` in `src/legacy/pages.js`):
  state lives in module-level `bs`, re-renders call `renderAddModal()` directly rather
  than the hash router's `render()`. If you add another modal, follow this shape rather
  than trying to route modal state through the URL hash.
- **Dark-mode-only visual effects** (the background image, frosted-glass panels) are
  scoped under `@media (prefers-color-scheme:dark)` and placed **last** in `style.css`
  intentionally — see the gotcha below.

## Porting a legacy page to React (the recipe that's been working)

0. Port in this order of dependency: shared components first, then pages. Legacy helpers that
   other legacy pages still call (`finishText`, `gameDetail`, `gamesTable`, `ratingChart`, ...)
   must stay until their last caller is ported — grep before deleting.
1. Translate the template string to a component in `src/pages/`, reading `usePage()`; reuse
   `src/components/` rather than re-deriving markup. Register it in `src/pages/index.js`; delete the
   legacy function and its `pages` entry in `src/legacy/pages.js`.
2. Prove parity instead of eyeballing it: `git archive <last-commit-with-the-legacy-page> | tar -x`
   into a scratch dir, build both trees with the fake-Supabase config (see Testing #4) on
   different ports, and diff `#main` after normalizing (sort attributes, merge adjacent text
   nodes, ignore `onerror`). Then click every sortable header on both and diff the row order.
   This caught real bugs the first time: tie-break order (legacy sorts from the *displayed* order)
   and sort keys (legacy sorts on visible text, e.g. "not decided"). Make the fake data rich enough
   that every section renders — check the section headings, an identical half-empty page proves nothing.
   Count the conditional bits too (`querySelectorAll` for crowns, rank arrows, ...): e.g. rank-move
   arrows need >= 2 game nights *and* a rank change on the last one, so the fake has an opt-in
   `?data=swing` scenario. Serialize the **live** DOM without mutating it (never `normalize()` it —
   that breaks React's node refs), compare `<select>`s by `.value` and `style` by `cssText`, and
   click row chevrons, not row centers (a player link sits in the middle).
3. Drive the interactions on both builds and snapshot after each step (expand, sort, filter, hover,
   modals); a static diff alone misses state bugs. Behavior that *intentionally* differs (e.g. an
   unknown route now behaves exactly like Home) gets noted in the commit message.

4. **Popup/portal content has no context.** A React element carries no context with it — context is
   resolved where it is *rendered*. `PopLayer` renders popup content outside `PageContext`, so a
   component used as popup content must not call `usePage()`; pass what it needs as props. (This
   crashed the whole app on hover until a parity run caught it.)
5. **Deleting legacy helpers:** `node --check` can't see a missing identifier, and a word-count of
   references is fooled by comments, prose, and long template strings. After deleting, diff the set
   of top-level definitions against the previous version and search every removed name for a
   *call site per line* (`name(`), including inside `${...}`. Then run the modal/Admin parity test
   (open Add Game, pick players so the preview renders, snapshot `#/admin`).
6. Adjacent text nodes shape separately in the browser: `{n} game{s}` can be a pixel wider than the
   same text as one string. Build short label strings with a template literal when exact layout
   parity matters. Fake-data scenarios in the test harness: `swing` (rank movement), `odd` (undated
   season, no-seasons group, friendly-only player, empty group), `rich` (landscape tiles + both rivals).

## Gotchas already paid for — don't rediscover these

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

There is no interactive browser available to the agent. What's actually been used
to verify changes, in order of how often (a real headless Chrome *is* usable for DOM dumps,
see the end of this list):

1. `node --check src/legacy/pages.js src/lib/*.js` — syntax only, every change; `npm run build` too.
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
5. Visual/UX verification is **always** the owner's — say so explicitly rather than
   claiming a styling or layout change "looks right."

## Deployment

- `main` → GitHub Pages, auto-published on push. No CI build step.
- `supabase/schema.sql` is meant to be safely re-run in the Supabase SQL editor after any
  change to it (that's the whole point of the `drop policy if exists` pattern and
  `create table if not exists` / `add column if not exists` throughout) — confirm new
  additions keep that property before committing.
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

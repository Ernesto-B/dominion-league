# Dominion Night

A website for our Dominion league: Elo rankings, seasons, head-to-head, records and a full game log. It's a static React site (built with Vite, hosted on GitHub Pages) with no server of its own — the page does all the maths in the visitor's browser — but the roster and the game log now live in [Supabase](https://supabase.com) (a hosted Postgres database) instead of a CSV file, and the whole site requires signing in.

- **Everyone gets their own account.** No anonymous visitors — names and results aren't exposed to scrapers or randoms who stumble onto the URL.
- **Only the admin can add, edit or delete games**, from a page on the site itself.
- **Friend groups**: if you run more than one group of friends who never play each other, each group gets its own rankings, seasons, head-to-head and records, on one site.

## Publish on GitHub Pages (one time)

The site is a [Vite](https://vite.dev) + React app. GitHub builds it for you on every push to `main` (see `.github/workflows/deploy.yml`) and publishes the result — there's nothing to build or upload by hand.

1. Create a new repository on GitHub (public, since free Pages needs that) and push everything in this folder, including `src`, `public`, `supabase` and `.github`. **Do not** commit a `.env` file or anything containing your Supabase service-role key — see the setup below.
2. Open Settings, then Pages. Under "Build and deployment", set **Source** to **GitHub Actions** (not "Deploy from a branch" — that would publish the unbuilt source and show a blank page).
3. Push to `main`. The "Deploy to GitHub Pages" workflow runs (watch it on the Actions tab); after a minute or two the site is live at `https://YOUR-NAME.github.io/REPO-NAME/`.

## Working on it locally

You need [Node.js](https://nodejs.org) 20.19+ or 22.12+ (the range this version of Vite supports; GitHub's build uses 22).

```
npm install        # once
npm run dev        # live-reloading dev server (http://localhost:5173)
npm run build      # the same production build GitHub runs; output goes to dist/
npm run preview    # serve dist/ locally to check the built site
```

## One-time Supabase setup

The site needs a free [Supabase](https://supabase.com) project for accounts and game data.

1. Create a Supabase project. Under Project Settings → API, copy the **Project URL** and the **anon / publishable key** into `src/lib/supabase.js` (both are safe to commit — they're meant to be public; real security comes from the database policies, not from hiding them).
2. Open the SQL editor and run everything in `supabase/schema.sql`. This creates the `players`, `games`, `game_results`, `groups`, `seasons` and `settings` tables, turns on Row Level Security, and adds the admin-only functions the site calls to add/edit/delete games. It's safe to re-run after pulling a newer version of this file — already-applied changes are skipped.
3. Under Authentication → Providers → Email, you can leave "Confirm email" on — the migration script below confirms each account directly through the Admin API, so players never need a real inbox.
4. Run the one-time migration script from your own computer (not from the browser):
   ```
   SUPABASE_URL=https://xxxx.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=paste-it-here-only-for-this-one-command \
   node scripts/migrate.mjs
   ```
   This creates a login for everyone listed in the `PLAYERS` array at the top of `scripts/migrate.mjs` (edit that list first — names, friend group, and which one is the admin), gives them the preset password `dominion`, seeds the starting friend group and season (edit the `GROUPS`/`SEASONS` arrays in the same file if yours differ), and imports the rows already in `data/games.csv`. The **service-role key** (Project Settings → API) bypasses all security — use it for this one local command and nowhere else. Never commit it, never put it in client code (`src/`), never paste it in a chat.
5. Tell everyone their name and the preset password. The site forces a real password on first sign-in.

Once this is done, `data/games.csv` is no longer read by the live site — it only matters for the one-time import above.

## Players and accounts

Signing in asks for a **name and password**, not an email — under the hood each player has a fixed, internal-only login address derived from their name, but nobody needs to know or type it.

Everyone starts with the password `dominion`. The site won't let anyone past that first sign-in without choosing a real password — if you ever see the "Set a password" screen, that's why.

**Adding a brand-new player later:** from the Admin page — type their name, pick their group, and save. This creates their login (preset password `dominion`, same as everyone's first sign-in) and their `players` row in one step. It needs the one-time Edge Function setup below; until that's done, the fallback is still the Supabase dashboard (Authentication → Users → Add user with `email_confirm` checked and password `dominion`, then a matching row in the `players` table).

Only the admin (`is_admin = true` in the `players` table) sees the "Add a game" and "Admin" links and can add players, groups, seasons, or games. Everyone else is read-only.

## One-time setup: creating players from the site

Creating a login for someone else needs Supabase's Auth Admin API, which requires the project's service-role key — far too sensitive to ever put in the browser, even for the admin. The fix is a small function that runs on Supabase's own servers (not GitHub Pages — this doesn't change how or where the site itself is hosted) and holds that key on our behalf: `supabase/functions/create-player/index.ts`. It independently checks the caller is really the admin before doing anything, the same way every other write in this project is gated.

To deploy it (once, and again after any future edit to that file):
1. Install the Supabase CLI — `brew install supabase/tap/supabase` on macOS.
2. `supabase login` (opens a browser to connect the CLI to your Supabase account).
3. From the repo root: `supabase link --project-ref hwwwpddinirdrxvvphgl`.
4. `supabase functions deploy create-player`.

No key needs to be typed anywhere for this — Supabase automatically gives every deployed function its own project URL, anon key, and service-role key at runtime.

## Seasons and groups: the Admin page

Seasons and friend groups are managed from the **Admin** page on the site (admin only) — not by editing a file. `data/config.json` only holds things that essentially never change: title/subtitle, Elo constants, and rank tiers (below).

**Groups are fully separate leagues.** Each one gets its own independent Elo, rankings, standings, records and head-to-head — a player in two groups has two completely unrelated stat lines, not one number shared two ways. A group is also a privacy boundary: a player only ever sees groups they belong to (groups, games, seasons, and even other players outside your shared groups are invisible, enforced by the database itself via Row Level Security — not just hidden in the UI). The admin bypasses this and sees everything, for managing the whole site.

**Groups**: type a name and save; the id shown underneath (auto-generated, e.g. "Group B" → `group-b`) is what a player's row lists in the Supabase `players` table's `group_ids` column.

**Players**: the "Add player" form on the Admin page lets you tick more than one group when creating someone — useful for a player who plays with two separate friend circles (they'll have two independent Elos, one per group). The table below it lists every existing player with a checkbox per group, so you can add or remove a group from someone after the fact too (each checkbox saves immediately, no separate save step).

**Games belong to exactly one group**, chosen implicitly by which group's page you're on when you click "Add A Game" — there's no separate picker, just navigate to the right group first. The site only lists that group's own players to pick from, and the save is rejected server-side if it somehow isn't (defense in depth). A game logged before groups existed, or that genuinely can't be resolved to one group, is only visible to the admin until fixed via Edit Game.

**Seasons**: pick the group, name, start date, length in weeks, target games, qualify % (0 to 1, e.g. `0.6` for 60%), playoff spots, and — once decided — the champion, from a dropdown of that group's players (no more typos matching a name by hand). A game belongs to the season whose dates contain its date (start through start + weeks); games needed to qualify = target games × qualify %, rounded up. Two groups can run their own seasons at the same time, including identical date ranges — each group's standings only ever see that group's own games.

With more than one group, every page grows a small pill switcher — but only listing groups you're actually in.

`elo` in `config.json` holds the rating model (`steady` or the original `classic`), K, the provisional K and window, the start rating, the scale and (for `steady`) `target`, the slow upward drift. The tier thresholds in the same file go with K: change one, change the other. `season.prior` is the season-score smoothing (3 means three imaginary average games) — these are the rare-change settings still worth a conscious file edit rather than a casual web form, since changing them recomputes every historical Elo.

## Rank titles and icons

Every player has a title from their current Elo: Peasant, Knight, Lord, Duke, Emperor. Everyone starts at 1000 as a Peasant and climbs. The icons are the PNG files in `icons/`; replace any of them with your own square PNG of the same name (`peasant.png`, `knight.png`, `lord.png`, `duke.png`, `emperor.png`). The little trophy (`champion.png`) marks players who have won a season; it isn't a rank. If a PNG is ever missing, the site falls back to `icons/<name>.svg` if one exists — that's why the original `champion.svg` is still in the folder, as a fallback.

Defaults: Peasant under 1040, Knight 1040, Lord 1090, Duke 1150, Emperor 1225. To change names or cut-offs, add a `tiers` list to `data/config.json`. The first tier's `min` is `null`, and each `id` needs a matching `icons/<id>.png` (or give an `icon` path):

```json
"tiers": [
  { "id": "peasant", "name": "Peasant", "min": null },
  { "id": "knight",  "name": "Knight",  "min": 1040 },
  { "id": "emperor", "name": "Emperor", "min": 1225 }
]
```

## What's on each page

- **Rankings:** Elo ladder with title icons, last night's results with the Elo change per player, the tier key, rating history, and the current season's top five.
- **Season:** week-of-season progress, standings with qualification and playoff seeds, and the season's games.
- **Players:** title and progress to the next one, season titles, top-half finishes, last places, longest run without a win, nemesis and favourite victim, rating history, record against each opponent, every result.
- **Head to head, Records, Games:** the matrix; league and single-game records (biggest Elo swing, longest game, highest score); the full log with season, type and player filters. Admins get Edit/Delete links on each row of the Games page.
- **Add a game** (admin only): pick who played and in what order, fill in the optional details, and save — it writes straight to the database. The same page shows each player's expected score and the Elo at stake ("Before you play"), which is handy for balancing seating.
- **Admin** (admin only): add friend groups, and add/edit seasons — see above.
- **Collection** (everyone, not tied to a friend group): our Dominion card collection — see below.
- Click any table heading to sort by that column.

## The Collection page

The **Collection** tab (`#/dominion`) is a browsable catalog of the Dominion boxes we own: **Overview** (totals, breakdowns and statistics: cost, card types by expansion, mechanics), **Kingdom cards** (search plus expansion, printed type, coin/Debt cost and recorded-mechanic filters), **Landscapes** (Events, Landmarks, Projects, Ways, Traits, with the Renaissance Artifacts shown separately), and a page for each card and landscape.

The data lives in nine `dominion_*` tables, separate from the Elo/season tables, and is **public to read, read-only through the website** (Row Level Security; nobody can edit it from the browser). The numbers it shows are kept apart on purpose: *card names* (331), *supply piles* (310 — a split pile holds two names), and *physical cards* (3,132); landscapes (124) and Artifacts (5) are never counted as Kingdom cards.

Two honest limits: the **mechanic tags are recorded positives, not an exhaustive list** (a card without a tag may still have that effect, so there is no "without" filter, and the statistics are marked provisional), and the data has no card text or artwork, so none is shown.

**To set it up** (one time — it needs your approval because it changes the live database): follow `supabase/dominion/README.md`. In short: `supabase db query --linked -f supabase/dominion/01_schema_and_rls.sql`, then `…/02_seed_data.sql`, then `npm run dominion:check-live`. Until that's done, the Dominion pages show a polite "isn't available yet" message and the rest of the site is unaffected.

```
npm test                      # data, data layer, filters, pages, routes, secrets, SQL safety
npm run dominion:test-db      # schema + seed + RLS in a throwaway local Postgres (never touches Supabase)
npm run dominion:check-live   # read-only check of the live project with the public key
npm run dominion:seed         # regenerate the seed SQL after editing a CSV in supabase/dominion/seed_csv/
npm run check:build           # after `npm run build`: relative asset paths, no secrets in dist/
```

## How the numbers work

- **Elo**: each table is treated as head-to-head matchups; change = K ÷ (players − 1) × sum of (actual − expected). K is 48 for a player's first 10 rated games, then 32.
- **Season score** = (points + prior × 0.5) ÷ (games + prior), where points run from 1 for a win to 0 for last, so table size doesn't matter and ties split.
- The calculation code is in `src/lib/engine.js` and was checked against the league spreadsheet on randomized multi-season data (Elo, standings, seeds, head-to-head, streaks and attendance all matched).

## Preview on your computer

Browsers block data loading from `file://`, so run `python3 -m http.server` in this folder and open http://localhost:8000. You'll still need a real Supabase project set up as above — the site has no offline/demo mode, since it's login-gated by design.

## Good to know

- Only the admin can change game data, seasons or groups; everyone else can view once signed in, and nobody can view anything signed out.
- The static files (`index.html`, the built JS bundle, `public/data/config.json`) are still technically public on GitHub Pages the way any static site is — but they contain no player names or results. All of that lives behind Supabase's Row Level Security and requires a real session to read.
- The only outside requests are Google Fonts and Supabase; the page works without Google Fonts, but it does need Supabase to do anything at all.
- GitHub Pages can take up to ten minutes to refresh the static files after a commit, and your browser may cache for a moment — reload if you don't see a change. Game data itself updates immediately, since it's never cached in the repo.

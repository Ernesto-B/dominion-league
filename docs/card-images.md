# Card images (first version built on branch `image-rework`; the private bucket is not yet)

The owner has an image of every card and wants the site to show them: the randomizer, snake draft and hand-picking show the card itself instead of its name, and card
pages, the game report's Kingdom tab and the Collection get the picture too. Nothing here is built; this is the agreed plan and the constraints.

## Decisions already made
- **Storage: a private Supabase Storage bucket**, for as long as the project can stay on the free plan. Only signed-in league members can load the images (the pages are behind
  the login, but files in `public/` would not be). Check the free plan's storage and monthly bandwidth limits against the real total size before uploading anything.
- **Performance is the top concern.** Whatever is built must not slow the randomizer, the lists or the first paint.

## Design that follows from that
- **Resize once, offline.** A script turns the originals into WebP in two sizes: a small tile (about 300 px wide, roughly 15-25 KB) and a larger one for tap/hover zoom.
  About 400 cards and landscapes at the small size is on the order of 10 MB; the large size is only ever fetched on demand. Never ship the originals.
- **Match files to the catalog by id**, with a script that lists any catalog entry that has no image (and any image that matches nothing), so a gap is known, not a blank tile.
  Landscapes, Artifacts and split piles (Knights, Castles, Gladiator / Fortune) each need an explicit rule.
- **A private bucket needs a signed request.** A plain `<img src>` cannot carry the sign-in, and a signed URL's token changes, which defeats the browser cache. So fetch the
  files with the signed-in client and keep them on the device (Cache Storage or IndexedDB, keyed by card id), then show them from there as object URLs. After the first
  view an image costs no network at all, and the service worker never has to cache a token URL.
- **Load only what is on screen.** Lazy loading (`loading="lazy"` / IntersectionObserver), fixed width and height on every image so nothing shifts, and a quick low-detail
  placeholder. Prefetch only the ten cards in a roll or draft pool.
- **Always fall back to today's text tile** when an image is missing or still loading, so the randomizer never waits on a picture.
- **Where it shows:** Randomizer and Game night tiles (card face; name, cost and rules stay as the accessible text), hand-picker, snake draft, the game report's Kingdom tab, card
  and landscape pages, and a zoom on tap (phone) or hover (desktop).

## What the owner's sample looks like (checked 2026-11-02)
- Folders per expansion (`base_game`, `plunder`, ...), files named `200px-<Card name>~English~2022.jpg`, JPEG, 200 x 320 px, about 17 KB each (a single sample: Abundance).
- That size is right for tiles and lists (about 100-150 CSS px wide, also on a 2x phone screen) and will be re-encoded to WebP; a zoom view would look soft, so if a larger
  copy of each card is wanted for zoom, ask for it at about 400 px wide. The filename is the card name, so matching to the catalog is by normalised name; split piles,
  apostrophes and non-English suffixes need explicit rules (ask for samples: Knights, Castles, Farmer's Market, a landscape).

## Open questions for the owner
- Do the other folders follow the same naming? Are landscapes (Events, Projects, Ways, Landmarks, Traits) included, and in which folders?
- Do the card faces replace the text tiles entirely, or sit beside the name and cost?

## What exists (branch `image-rework`)
- **Build:** `npm run cards:build -- <folder>` (scripts/dominion/build-card-images.mjs, `sharp`) matches every file to the catalog by NAME (the folder does not matter; a card's previous name and a trailing `Old` are
  accepted, pile cards match a multi-name pile such as Knights, Artifacts match too), picks the sharpest file when a card is in several folders, and writes three WebP sizes per card into `public/cards/`
  (gitignored): `x@t.webp` thumbnail (96 px wide, ~3.5 KB), `x.webp` small (300 px, ~22 KB) and `x@big.webp` for the enlarge view (800 px on the long side, ~52 KB, only when the source has the detail), plus
  `manifest.json` (`{ v: 2, items: { id: { w, h, bw?, bh?, k } } }`, `k` = a hash of that card's pictures). It reports catalog entries with no image and files that match nothing (Loot, Prizes' Rewards, basic cards, Ruins,
  Shelters, Colony / Platinum are not in the catalog). All 467 entries are covered: about 34 MB in all.
- **Private bucket:** `supabase/dominion/03_card_images_bucket.sql` makes the private bucket `card-images` (public = false, 2 MB per file, webp + json only) with ONE policy: `select` for `authenticated`.
  There is no write policy: pictures go up with `npm run cards:upload` (the Supabase CLI's own login; folders first, manifest last, confirmation prompt, `--dry-run`). Apply the bucket with `npm run db:apply -- images`
  (its own target: `all` never creates it).
- **Site:** `src/dominion/cardImages.js` is the ONLY place that knows where pictures come from. In production: the bucket first, then the local folder; in `npm run dev`: the local folder first. A private file cannot be
  an `<img src>`, so each picture is downloaded with the member's session (6 at a time, and only when it is near the screen), kept in Cache Storage (`dl-cards-v1`, key = path + hash) and shown as an object URL: one
  download per picture per device, ever, until its hash changes. The manifest is kept in localStorage (`dl.cards.manifest`) and refreshed in the background every 6 hours. Signing out clears both.
  `components/CardFace.jsx` draws a picture (space reserved from its size, nothing jumps) or nothing, so every screen keeps its text fallback.
- **Where pictures show:** the Randomizer and Game night's Kingdom step (Card faces / List switch, `dl.cardview`), the snake draft pool, the enlarge dialog (CardPeek), the card, landscape and Artifact pages, the Kingdom
  cards and Landscapes lists (a small cropped window on each card), the Game night hand-picker (chips and search results), and the game report's Kingdom tab (Card faces / List).
- **Cost on a free plan:** about 34 MB stored (1 GB allowed); a roll costs ~230 KB the first time and nothing after; a device that views everything downloads ~34 MB once (5 GB egress a month).

## Putting it live (the owner's steps; both change the live project)
1. `npm run db:apply -- images`   (type `apply`)
2. `npm run cards:upload`         (type `upload`)
3. Check: signed out, `curl -I <project>/storage/v1/object/card-images/manifest.json` is refused; signed in, a page shows pictures.
Until step 2, a production build shows no pictures (the old text tiles), because the images are not in the repo or on GitHub Pages.

## Not done / ideas
- A larger source for the few 200 / 320 px pictures (Nobles, Cardinal, Livery, Way of the Goat) would sharpen their enlarge view.
- The Loot cards, Rewards, Ruins, Shelters, Colony / Platinum and the basic cards have pictures but no catalog entries, so nothing shows them yet.

## Extra cards a card hands out (Horse, Spoils, Madman, Mercenary, the Loot, Ruins and Reward piles) and Artifacts
- `src/dominion/extras.js` lists the non-catalog cards that get a picture (`extra:horse` ...); the build script matches their files by name like any other card and writes `extra/<name>.webp`. They have no page, only a picture.
- A card or landscape page shows a "Cards it brings into play" section (`components/GivenCards.jsx`): `relatedOf()` reads the item's own printed text for those names and for any Artifact (Treasure Chest on Swashbuckler,
  Flag, Horn, Key, Lantern), so nothing is guessed. An Artifact links to its page. The piles of different cards (Plunder's Loot, 15; Dark Ages' Ruins, 5; Cornucopia & Guilds' Rewards, 6, which Joust gives) are one closed line that opens to show every card; they match only a text that GIVES the pile (`gain a Loot`), so Vagrant, which just looks for Ruins, shows none. On a card or landscape page the section sits beside "In our games" at half width (`.dn-pair`).
- To see the new pictures live: `npm run cards:build -- ~/Downloads/dominion_card_images` then `npm run cards:upload` (the owner's step; it writes to the private bucket).


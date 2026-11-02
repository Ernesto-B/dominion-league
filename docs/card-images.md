# Card images (planned, not built yet)

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

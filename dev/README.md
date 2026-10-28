# Trying the site without Supabase, and comparing layouts

```bash
npm run dev:fake      # the whole site on http://localhost:5199, signed in as Ann (the admin), on made-up data — nothing leaves your machine
npm run build:fake    # a static build into dist-fake/ (for scripted browser tests)
npm run dev:ab        # runs the same phone tasks on the current layout (A) and the new one (B) and prints taps / scrolling
```

`dev/fakeSupabase.js` is an in-memory stand-in for the Supabase client, built from the seed CSVs plus a small made-up league (7 players,
16 games, a season, a few logged kingdoms). `add_game` / `edit_game` / `delete_game` really change it until you reload.

## The UX experiments (branch `ux-experiment`)

Each experiment is a flag (`src/ux.js`), so one build is A and B at once:

| URL | What you get |
|---|---|
| `/?ux=none` | the current layout (A) |
| `/?ux=all` | everything new (B) — the default on this branch |
| `/?ux=nav,home` | any mix: `nav` bottom tab bar · `home` home card · `lists` dense lists + stacked tables · `flow` Game night · `share` share-as-image |

The choice is remembered; the footer has a "UX experiment: new · current · choose…" switch. Open the fake site on your phone
(`npm run dev:fake -- --host`) to feel the difference with a thumb rather than a mouse.

`dev/cdp.mjs` is a dependency-free Chrome DevTools driver (phone emulation, screenshots) used by `ab-tasks.mjs` and handy for your own scripts.

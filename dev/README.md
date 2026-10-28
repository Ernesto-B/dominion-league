# Trying the site without Supabase, and comparing layouts

```bash
npm run dev:fake      # the whole site on http://localhost:5199, signed in as Ann (the admin), on made-up data — nothing leaves your machine
npm run build:fake    # a static build into dist-fake/ (for scripted browser tests)
npm run dev:ab        # runs the same phone tasks on the current layout (A) and the new one (B) and prints taps / scrolling
```

`dev/fakeSupabase.js` is an in-memory stand-in for the Supabase client, built from the seed CSVs plus a small made-up league (7 players,
16 games, a season, a few logged kingdoms). `add_game` / `edit_game` / `delete_game` really change it until you reload.

Open the fake site on your phone (`npm run dev:fake -- --host`) to feel it with a thumb rather than a mouse.

`dev/cdp.mjs` is a dependency-free Chrome DevTools driver (phone emulation, screenshots) handy for your own scripts.

# Backing up the league

The free Supabase plan pauses an idle project (restorable from Studio, for a window Supabase sets) and has no downloadable automatic backups, so the league keeps its own.

```
npm run backup                                  # read-only; writes backups/<date_time>/
npm run restore -- backups/<date_time> --dry-run   # what is in it
npm run restore -- backups/<date_time>             # asks, then fills in what is missing
npm run backup:test-db                          # proves a restore works, on a throwaway local database
```

- **What is saved:** players, groups, seasons, games, results, game kingdoms and settings (`<table>.json`), who can sign in (`accounts.json`: ids and emails, no passwords), a `manifest.json` with the row counts, and `restore.sql`.
- **What is not:** the card catalog (rebuilt from `supabase/dominion/seed_csv`) and the card pictures (rebuilt from your folder of original images, `npm run cards:build`, then `npm run cards:upload`).
- **Safe by design:** a backup changes nothing; a restore only inserts rows that are missing (`on conflict do nothing`), never overwrites or deletes, and skips a player whose sign-in no longer exists (a password can't be stored in a backup): recreate them from Admin > New player, then restore again.
- **`backups/` is gitignored** (it holds names and emails). Copy the newest folder somewhere else too (a cloud drive, a USB stick): a backup that lives only on this computer is not a backup.
- Run it before a big game night and about monthly. Checking the project is not paused is part of the same habit: Supabase emails a warning about a week before pausing.

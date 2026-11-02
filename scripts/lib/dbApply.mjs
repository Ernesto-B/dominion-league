/* What `npm run db:apply` runs, kept pure so it can be tested. Order matters: the league schema validates a game's kingdom
   against the Collection tables, so the Collection goes first. */
export const TARGETS = {
  catalog: ['supabase/dominion/01_schema_and_rls.sql', 'supabase/dominion/02_seed_data.sql'],
  league: ['supabase/schema.sql'],
  images: ['supabase/dominion/03_card_images_bucket.sql'],   // the private bucket for the card pictures; the pictures themselves go up with `npm run cards:upload`
};
TARGETS.all = [...TARGETS.catalog, ...TARGETS.league];   // the card-picture bucket is its own step: `all` never creates it

export function planFor(target) {
  const files = TARGETS[target];
  if (!files) throw new Error(`Unknown target "${target}". Use one of: ${Object.keys(TARGETS).join(', ')}.`);
  return files.map(file => ({ file, args: ['db', 'query', '--linked', '-f', file] }));
}

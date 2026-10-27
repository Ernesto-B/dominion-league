/* Data access for the Dominion catalog. Everything that knows a table or view name lives in this file; the
   UI only ever sees the normalized catalog from model.js.

   Supabase/PostgREST silently caps a response (1000 rows by default), so a plain `.select()` on a larger
   table returns a truncated, plausible-looking list. fetchAllRows() therefore asks for the exact row count
   up front, pages with .range() until it has them all, and THROWS if it ends up with a different number —
   a wrong total must never render as if it were complete. */
import { buildCatalog } from './model.js';

export const PAGE_SIZE = 1000;

export class CatalogError extends Error {
  constructor(kind, message, cause) { super(message); this.name = 'CatalogError'; this.kind = kind; this.cause = cause; }
}

export async function fetchAllRows(client, source, { select = '*', order, pageSize = PAGE_SIZE } = {}) {
  const orders = [].concat(order || []);
  const rows = [];
  let total = null;
  while (total === null || rows.length < total) {
    const from = rows.length;
    let q = client.from(source).select(select, from === 0 ? { count: 'exact' } : undefined);
    for (const col of orders) q = q.order(col);          // a stable order, or pages could overlap or skip rows
    const { data, error, count } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    if (total === null) total = typeof count === 'number' ? count : null;
    if (!data || !data.length) break;                    // the server returned nothing more
    rows.push(...data);                                  // may be fewer than pageSize if the server's own cap is lower
    if (total === null && data.length < pageSize) break; // no count available: a short page means the end
  }
  if (total !== null && rows.length !== total) {
    throw new CatalogError('incomplete', `Loaded ${rows.length} of ${total} rows from ${source}`);
  }
  return rows;
}

async function countRows(client, source, column) {
  const { count, error } = await client.from(source).select(column, { count: 'exact', head: true });
  if (error) throw error;
  return count;
}

/* Card text is supplementary: if its table isn't installed yet (the site can deploy before the SQL is applied),
   the collection still works and the card pages say text isn't available. Any OTHER failure still throws —
   including a short/truncated response, which fetchAllRows already refuses. */
async function loadCardText(client) {
  try {
    return await fetchAllRows(client, 'dominion_card_text', { order: 'record_id' });
  } catch (err) {
    if (describeError(err).kind === 'not-installed') return [];
    throw err;
  }
}

/* One round of reads for the whole catalog — about 700 rows in total, so the browser can filter and chart
   it locally (client-side filtering is only valid because the COMPLETE set was fetched and verified above).
   The two views already join printed types and mechanic ids onto each card/landscape, so the 1,634-row
   mechanics table never has to be paged. Its row count is still fetched, as a cross-check on the join. */
export async function fetchRawCatalog(client) {
  const [cards, piles, landscapes, artifacts, artifactMechanics, taxonomy, mechanicRelationshipCount, cardText] = await Promise.all([
    fetchAllRows(client, 'dominion_card_catalog', { order: 'card_id' }),
    fetchAllRows(client, 'dominion_kingdom_piles', { order: ['expansion', 'pile_id'] }),
    fetchAllRows(client, 'dominion_landscape_catalog', { order: 'object_id' }),
    fetchAllRows(client, 'dominion_artifacts', { order: 'object_id' }),
    fetchAllRows(client, 'dominion_artifact_mechanics', { order: ['object_id', 'mechanic_id'] }),
    fetchAllRows(client, 'dominion_taxonomy', { order: 'mechanic_id' }),
    countRows(client, 'dominion_kingdom_mechanics', 'card_id'),
    loadCardText(client),
  ]);
  return { cards, piles, landscapes, artifacts, artifactMechanics, taxonomy, mechanicRelationshipCount, cardText };
}

export async function loadCatalog(client) { return buildCatalog(await fetchRawCatalog(client)); }

/* Turns anything thrown while loading into a short, fixed, user-safe message. The raw error (which can contain
   SQL fragments, table names or hints) goes to the console only — never into the page. */
export function describeError(err) {
  const code = String(err?.code ?? '');
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  const text = `${err?.message ?? ''}`;
  if (err instanceof CatalogError && err.kind === 'incomplete')
    return { kind: 'incomplete', title: 'The collection didn’t load completely', message: 'Some rows were missing from the response, so nothing is shown rather than showing a partial list. Try again.' };
  if (code === 'PGRST205' || code === '42P01' || status === 404)
    return { kind: 'not-installed', title: 'The collection isn’t available yet', message: 'The catalog hasn’t been set up on this database. Please check back later.' };
  if (code === '42501' || code === 'PGRST301' || status === 401 || status === 403)
    return { kind: 'permission', title: 'You don’t have access to the collection', message: 'The database refused the request. Try signing out and back in.' };
  if (err instanceof TypeError || /failed to fetch|network|load failed/i.test(text))
    return { kind: 'network', title: 'Couldn’t reach the server', message: 'Check your connection and try again.' };
  return { kind: 'unknown', title: 'Something went wrong loading the collection', message: 'Please try again in a moment.' };
}

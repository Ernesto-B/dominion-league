import { describe, it, expect, vi } from 'vitest';
import { fetchAllRows, loadCatalog, describeError, CatalogError } from '../../src/dominion/api.js';
import { rawFromCsv, fakeClient, tablesFromRaw } from './fixtures.js';

const bigTable = n => Array.from({ length: n }, (_, i) => ({ id: String(i).padStart(5, '0'), v: i }));

describe('fetchAllRows — Supabase row limits', () => {
  it('returns all 2,500 rows when the server caps each response at 1,000', async () => {
    const client = fakeClient({ big: bigTable(2500) }, { serverMax: 1000 });
    const rows = await fetchAllRows(client, 'big', { order: 'id' });
    expect(rows).toHaveLength(2500);
    expect(new Set(rows.map(r => r.id)).size).toBe(2500);          // no duplicates from overlapping pages
    expect(rows.map(r => r.id)).toEqual(bigTable(2500).map(r => r.id));
    expect(client.calls.map(c => c.a)).toEqual([0, 1000, 2000]);   // consecutive pages
  });
  it('still gets everything when the server\'s own cap is LOWER than our page size', async () => {
    const client = fakeClient({ big: bigTable(2500) }, { serverMax: 400 });
    expect(await fetchAllRows(client, 'big', { order: 'id' })).toHaveLength(2500);
  });
  it('is not fooled by a table that is exactly one page long', async () => {
    expect(await fetchAllRows(fakeClient({ t: bigTable(1000) }), 't', { order: 'id' })).toHaveLength(1000);
    expect(await fetchAllRows(fakeClient({ t: bigTable(1001) }), 't', { order: 'id' })).toHaveLength(1001);
  });
  it('handles an empty table', async () => {
    expect(await fetchAllRows(fakeClient({ t: [] }), 't', { order: 'id' })).toEqual([]);
  });
  it('REFUSES to return a short list: a count mismatch throws instead of rendering a partial catalog', async () => {
    // the server says there are 3,000 rows but only ever delivers 2,500
    const client = fakeClient({ big: bigTable(2500) }, { lieAboutCount: 3000 });
    await expect(fetchAllRows(client, 'big', { order: 'id' })).rejects.toMatchObject({ name: 'CatalogError', kind: 'incomplete' });
  });
  it('propagates a Supabase error (missing table) rather than swallowing it', async () => {
    await expect(fetchAllRows(fakeClient({}), 'nope', { order: 'id' })).rejects.toMatchObject({ code: 'PGRST205' });
  });
});

describe('loadCatalog', () => {
  const raw = rawFromCsv();
  it('loads the complete real catalog even with a very small server row cap', async () => {
    const client = fakeClient(tablesFromRaw(raw), { serverMax: 100 });
    const c = await loadCatalog(client);
    expect(c.cards).toHaveLength(331);
    expect(c.piles).toHaveLength(310);
    expect(c.landscapes).toHaveLength(124);
    expect(c.artifacts).toHaveLength(5);
    expect(c.taxonomy.size).toBe(98);
    expect(c.meta.mechanicRelationshipCount).toBe(1634);
    expect(c.cards.reduce((s, x) => s + x.mechanicIds.length, 0)).toBe(1634);
  });
  it('does not page the 1,634-row mechanics table (the card view already carries the tags); it only counts it', async () => {
    const client = fakeClient(tablesFromRaw(raw));
    await loadCatalog(client);
    expect(client.calls.some(c => c.name === 'dominion_kingdom_mechanics')).toBe(false);
  });
  it('loads the card text, and the collection still opens if that table is not installed yet', async () => {
    const full = await loadCatalog(fakeClient(tablesFromRaw(raw)));
    expect(full.meta.textRecordCount).toBe(500);
    const t = tablesFromRaw(raw); delete t.dominion_card_text;
    const bare = await loadCatalog(fakeClient(t));
    expect(bare.cards).toHaveLength(331);
    expect(bare.meta.textRecordCount).toBe(0);
    expect(bare.cards.every(c => c.text === null)).toBe(true);
  });
  it('fails (rather than showing partial data) if any one table comes back short', async () => {
    const t = tablesFromRaw(raw);
    const client = fakeClient(t, { lieAboutCount: 10_000 });
    await expect(loadCatalog(client)).rejects.toMatchObject({ kind: 'incomplete' });
  });
});

describe('describeError — what a visitor may see', () => {
  const secret = /dominion_|public\.|select |insert |schema cache|PGRST|hint|details|supabase\.co|key|token|password/i;
  const cases = {
    'missing table': { code: 'PGRST205', message: "Could not find the table 'public.dominion_kingdom_cards' in the schema cache", hint: 'Perhaps you meant ...' },
    'permission denied': { code: '42501', message: 'permission denied for table dominion_kingdom_cards' },
    'network': new TypeError('Failed to fetch'),
    'unknown db error': { code: 'XX000', message: 'select * from secret_table failed at host db.abc.supabase.co' },
    'truncated': new CatalogError('incomplete', 'Loaded 900 of 1000 rows from dominion_card_catalog'),
  };
  for (const [name, err] of Object.entries(cases)) {
    it(`gives a short fixed message for: ${name}, and leaks no internals`, () => {
      const d = describeError(err);
      expect(d.title.length).toBeGreaterThan(5);
      expect(`${d.title} ${d.message}`).not.toMatch(secret);
    });
  }
  it('classifies the cases', () => {
    expect(describeError(cases['missing table']).kind).toBe('not-installed');
    expect(describeError(cases['permission denied']).kind).toBe('permission');
    expect(describeError(cases.network).kind).toBe('network');
    expect(describeError(cases.truncated).kind).toBe('incomplete');
    expect(describeError(cases['unknown db error']).kind).toBe('unknown');
  });
});

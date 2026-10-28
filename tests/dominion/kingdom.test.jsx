import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { realCatalog } from './fixtures.js';
import { toPayload, setNameFor, landscapeGroupFor, primaryType, resolveKingdom, impliedSets, searchKingdom, MAX_CARDS, MAX_LANDSCAPES } from '../../src/dominion/kingdom.js';
import { KingdomChip } from '../../src/dominion/components/KingdomChips.jsx';
import { setKingdomDraft, peekKingdomDraft, takeKingdomDraft } from '../../src/dominion/kingdomDraft.js';
import * as Eng from '../../src/lib/engine.js';

const catalog = realCatalog();
const card = name => catalog.cards.find(c => c.name === name);
const land = name => catalog.landscapes.find(l => l.name === name);

describe('kingdom helpers', () => {
  it('shapes the payload the RPCs take, keeping a Trait\'s card', () => {
    expect(toPayload([{ kind: 'card', id: 'a' }, { kind: 'landscape', id: 'b', on: 'a', extra: 1 }])).toEqual([{ kind: 'card', id: 'a' }, { kind: 'landscape', id: 'b', on: 'a' }]);
  });
  it('knows the caps the database enforces', () => { expect(MAX_CARDS).toBe(12); expect(MAX_LANDSCAPES).toBe(6); });
  it('names sets the way the Add Game picker does', () => {
    expect(setNameFor('Dominion Base Game')).toBe('Base'); expect(setNameFor('Dark Ages')).toBe('Dark Ages'); expect(setNameFor('Cornucopia & Guilds')).toBe('Cornucopia & Guilds');
    expect(landscapeGroupFor('Way')).toBe('Ways'); expect(landscapeGroupFor('Event')).toBe('Events');
  });
  it('colours a card by its most distinctive printed type', () => {
    expect(primaryType(card('Militia'))).toBe('Attack');           // Action - Attack reads as an Attack
    expect(primaryType(card('Village'))).toBe('Action');
    expect(primaryType(card('Province Placeholder') || { types: ['Knight'] })).toBe(null);   // Knight/Castle-only types have no colour
    expect(primaryType(card('Gladiator'))).toBe('Action');
  });
  it('resolves ids to catalog rows, and flags one the catalog no longer has instead of dropping it', () => {
    const r = resolveKingdom(catalog, [{ kind: 'card', id: card('Militia').id }, { kind: 'card', id: 'gone:card' }, { kind: 'landscape', id: land('Way of the Mole').id }]);
    expect(r[0].obj.name).toBe('Militia'); expect(r[1].missing).toBe(true); expect(r[2].obj.name).toBe('Way of the Mole');
  });
  it('derives the Sets from the Kingdom CARDS only, and the landscape groups from the landscapes', () => {
    const r = resolveKingdom(catalog, [{ kind: 'card', id: card('Militia').id }, { kind: 'card', id: card('Village').id }, { kind: 'landscape', id: land('Way of the Mole').id }]);
    expect(impliedSets(r)).toEqual({ sets: ['Base'], landscapes: ['Ways'] });          // the Menagerie Way does NOT make Menagerie a set in play
    expect(impliedSets(resolveKingdom(catalog, [{ kind: 'landscape', id: land('Way of the Mole').id }]))).toEqual({ sets: [], landscapes: ['Ways'] });
    const project = catalog.landscapes.find(l => l.expansion === 'Renaissance' && l.type === 'Project');     // a Renaissance landscape in a Base game
    const mixed = resolveKingdom(catalog, [{ kind: 'card', id: card('Witch').id }, { kind: 'landscape', id: project.id }]);
    expect(impliedSets(mixed)).toEqual({ sets: ['Base'], landscapes: ['Projects'] });                       // Renaissance is NOT a set in play
    expect(impliedSets(resolveKingdom(catalog, [{ kind: 'card', id: 'gone:card' }]))).toEqual({ sets: [], landscapes: [] });
  });
  it('searches cards and landscapes by every word, names starting with the first word first, never re-offering what is taken', () => {
    const hits = searchKingdom(catalog, 'way of the');
    expect(hits.length).toBeGreaterThan(5); expect(hits.every(h => /way of the/i.test(h.obj.name))).toBe(true); expect(hits.every(h => h.kind === 'landscape')).toBe(true);
    const village = searchKingdom(catalog, 'village', [], 30);
    expect(village[0].obj.name.toLowerCase().startsWith('village')).toBe(true);
    const taken = [{ kind: 'card', id: village[0].obj.id }];
    expect(searchKingdom(catalog, 'village', taken, 30).some(h => h.obj.id === village[0].obj.id)).toBe(false);
    expect(searchKingdom(catalog, '   ')).toEqual([]); expect(searchKingdom(catalog, 'zzzzqq')).toEqual([]);
    expect(searchKingdom(catalog, 'é')).toBeTruthy();   // accents are folded, junk is harmless
    expect(searchKingdom(catalog, 'a', [], 8).length).toBeLessThanOrEqual(8);
  });
});

describe('kingdom chips', () => {
  const chip = (item, props) => renderToStaticMarkup(<KingdomChip r={resolveKingdom(catalog, [item])[0]} {...props} />);
  it('links a card to its page, edged in its type colour, with its cost icon', () => {
    const h = chip({ kind: 'card', id: card('Militia').id });
    expect(h).toMatch(/<a class="dn-kchip t-attack" href="#\/dominion\/cards\/[^"]+"/); expect(h).toContain('Militia'); expect(h).toContain('icons/costs/coin-4.png');
  });
  it('links a landscape to its page in its landscape colour', () => { expect(chip({ kind: 'landscape', id: land('Way of the Mole').id })).toMatch(/<a class="dn-kchip t-way" href="#\/dominion\/landscapes\//); });
  it('says which card a Trait is on', () => {
    expect(chip({ kind: 'landscape', id: land('Cheap').id, on: card('Militia').id })).toMatch(/on Militia/);
  });
  it('is a plain chip with a labelled remove button in the editor', () => {
    const h = chip({ kind: 'card', id: card('Militia').id }, { onRemove: () => {} });
    expect(h).not.toContain('<a '); expect(h).toContain('aria-label="Remove Militia"');
  });
  it('shows an id the catalog no longer knows, quietly', () => { expect(chip({ kind: 'card', id: 'gone:card' })).toMatch(/dn-kchip-missing[^>]*>gone:card</); });
});

describe('kingdom draft (Randomizer -> Add Game hand-off)', () => {
  beforeEach(() => { takeKingdomDraft(); });
  it('is handed over exactly once', () => {
    setKingdomDraft({ items: [{ kind: 'card', id: 'x' }], sets: ['Base'], landscapes: [] });
    expect(peekKingdomDraft().items).toHaveLength(1);
    expect(takeKingdomDraft().sets).toEqual(['Base']); expect(takeKingdomDraft()).toBeNull();
  });
  it('survives a reload through sessionStorage, and ignores garbage there', () => {
    const store = {};
    globalThis.sessionStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
    setKingdomDraft({ items: [{ kind: 'card', id: 'x' }] });
    expect(JSON.parse(store['dl.kingdomDraft']).items).toHaveLength(1);
    store['dl.kingdomDraft'] = '{not json'; takeKingdomDraft();   // drop the in-memory copy
    expect(peekKingdomDraft()).toBeNull();
    store['dl.kingdomDraft'] = JSON.stringify({ nope: true }); expect(peekKingdomDraft()).toBeNull();
    delete globalThis.sessionStorage;
  });
});

describe('the game row carries the kingdom', () => {
  it('passes a row\'s kingdom through the engine untouched', () => {
    const kingdom = [{ kind: 'card', id: 'x' }];
    const cd = Eng.compute({ title: 't', players: ['A', 'B'], seasons: [], k: 24 }, [{ _line: 1, date: '2026-01-02', type: '', finish: 'A > B', sets: '', landscapes: '', playerVP: {}, kingdom }], Eng.todayDay());
    expect(cd.games[0].kingdom).toEqual(kingdom);
    const none = Eng.compute({ title: 't', players: ['A', 'B'], seasons: [], k: 24 }, [{ _line: 1, date: '2026-01-02', type: '', finish: 'A > B', sets: '', landscapes: '', playerVP: {} }], Eng.todayDay());
    expect(none.games[0].kingdom).toEqual([]);
  });
});

// loadData reads the league through the one Supabase client; swap it for an in-memory one
const tables = {};
vi.mock('../../src/lib/supabase.js', () => ({
  sb: {
    from: name => {
      const result = () => (tables[name] instanceof Error ? { data: null, error: tables[name] } : { data: tables[name] ?? [], error: null });
      const q = { select: () => q, order: () => q, range: async () => result(), maybeSingle: async () => ({ data: (tables[name] || [])[0] ?? null, error: null }), then: (res, rej) => Promise.resolve(result()).then(res, rej) };
      return q;
    },
  },
}));
describe('loadData and game_kingdom', () => {
  beforeEach(() => {
    Object.assign(tables, {
      players: [{ id: 'p1', name: 'Ann', group_ids: ['g'] }, { id: 'p2', name: 'Bob', group_ids: ['g'] }],
      games: [{ id: 7, date: '2026-01-02', type: '', sets: 'Base', landscapes: null, group_id: 'g' }, { id: 8, date: '2026-01-09', type: '', group_id: 'g' }],
      game_results: [{ game_id: 7, player_id: 'p1', place: 1 }, { game_id: 7, player_id: 'p2', place: 2 }, { game_id: 8, player_id: 'p2', place: 1 }, { game_id: 8, player_id: 'p1', place: 2 }],
      groups: [{ id: 'g', name: 'G' }], seasons: [], settings: [],
      game_kingdom: [
        { game_id: 7, kind: 'landscape', item_id: 'L', position: 2, on_id: 'C1' }, { game_id: 7, kind: 'card', item_id: 'C2', position: 1, on_id: null }, { game_id: 7, kind: 'card', item_id: 'C1', position: 0, on_id: null },
      ],
    });
  });
  it('attaches each game\'s kingdom, in the order it was entered, with a Trait\'s card', async () => {
    const { loadData } = await import('../../src/lib/data.js');
    const { rows } = await loadData();
    expect(rows.find(r => r._line === 7).kingdom).toEqual([{ kind: 'card', id: 'C1' }, { kind: 'card', id: 'C2' }, { kind: 'landscape', id: 'L', on: 'C1' }]);
    expect(rows.find(r => r._line === 8).kingdom).toEqual([]);
  });
  it('still loads the league when the table is not installed yet', async () => {
    tables.game_kingdom = Object.assign(new Error('Could not find the table'), { code: 'PGRST205' });
    const { loadData } = await import('../../src/lib/data.js');
    expect((await loadData()).rows.every(r => r.kingdom.length === 0)).toBe(true);
  });
  it('still fails loudly on any other error reading it', async () => {
    tables.game_kingdom = Object.assign(new Error('permission denied'), { code: '42501' });
    const { loadData } = await import('../../src/lib/data.js');
    await expect(loadData()).rejects.toMatchObject({ code: '42501' });
  });
});

import { describe, it, expect } from 'vitest';
import { realCatalog } from './fixtures.js';
import {
  generate, rerollSlot, rerollLandscape, seededRng, sortSlots, slotCardId, pileKeyOf, REQUIRE_RULES,
  optionsToParams, optionsFromParams, kingdomToParams, kingdomFromParams, toGameItems, DEFAULT_OPTIONS, rollSeeded, newSeed, parseSeed, formatSeed,
} from '../../src/dominion/randomizer.js';

const catalog = realCatalog();
const card = name => catalog.cards.find(c => c.name === name);
const roll = (opts, seed = 1, extra = {}) => generate(catalog, opts, { rng: seededRng(seed), ...extra });
const rolls = (opts, n = 150, extra = {}) => Array.from({ length: n }, (_, i) => roll(opts, i + 1, extra));
const attacks = r => r.slots.filter(s => s.cards.some(c => c.types.includes('Attack'))).length;
const has = (r, rule) => r.slots.some(s => s.cards.some(c => (REQUIRE_RULES[rule].coins != null
  ? c.coins === REQUIRE_RULES[rule].coins && c.debt === 0
  : c.mechanicIds.some(t => REQUIRE_RULES[rule].tags.includes(t)))));

describe('the draw', () => {
  it('rolls ten distinct supply piles, cheapest first, and is repeatable for one seed', () => {
    const r = roll({});
    expect(r.ok).toBe(true); expect(r.slots).toHaveLength(10); expect(new Set(r.slots.map(s => s.key)).size).toBe(10);
    expect(r.slots).toEqual(sortSlots(r.slots));
    expect(roll({}, 5).slots.map(s => s.key)).toEqual(roll({}, 5).slots.map(s => s.key));
    expect(roll({}, 5).slots.map(s => s.key)).not.toEqual(roll({}, 6).slots.map(s => s.key));
  });
  it('honours the number of cards', () => { for (const n of [5, 10, 12]) expect(roll({ cards: n }).slots).toHaveLength(n); });
  it('stays inside the chosen expansions', () => {
    for (const r of rolls({ expansions: ['Seaside', 'Plunder'] }, 40)) expect(r.slots.every(s => ['Seaside', 'Plunder'].includes(s.expansion))).toBe(true);
  });
  it('treats a split pile as ONE slot that shows all its names', () => {
    const r = roll({ include: [card('Fortune').id] });
    const pile = r.slots.find(s => s.cards.some(c => c.name === 'Fortune'));
    expect(pile.name).toBe('Gladiator / Fortune'); expect(pile.cards.map(c => c.name).sort()).toEqual(['Fortune', 'Gladiator']); expect(r.slots).toHaveLength(10);
    const k = roll({ include: [card('Dame Anna').id] }).slots.find(s => s.name === 'Knights'); expect(k.cards).toHaveLength(10);
  });
});

describe('rules that exclude', () => {
  it('"No Attacks" never rolls one, in any of 200 kingdoms', () => { for (const r of rolls({ maxAttacks: 0 }, 200)) expect(attacks(r)).toBe(0); });
  it('"At most N Attacks" is respected', () => { for (const n of [1, 2]) for (const r of rolls({ maxAttacks: n }, 100)) expect(attacks(r)).toBeLessThanOrEqual(n); });
  it('a Reaction always accompanies an Attack when asked', () => {
    let withAttack = 0;
    for (const r of rolls({ reaction: true }, 300)) { if (attacks(r)) { withAttack++; expect(r.slots.some(s => s.cards.some(c => c.types.includes('Reaction')))).toBe(true); } }
    expect(withAttack).toBeGreaterThan(50);   // the rule was really exercised
  });
  it('excluding a card removes its whole pile', () => {
    for (const r of rolls({ exclude: [card('Fortune').id, card('Militia').id] }, 100)) {
      expect(r.slots.some(s => s.name === 'Gladiator / Fortune' || s.name === 'Militia')).toBe(false);
    }
  });
});

describe('rules that require', () => {
  it('guarantees each of Village, drawing, trashing and +Buy, and all four together', () => {
    for (const rule of Object.keys(REQUIRE_RULES)) for (const r of rolls({ require: [rule] }, 100)) expect(has(r, rule), rule).toBe(true);
    for (const r of rolls({ require: Object.keys(REQUIRE_RULES) }, 100)) for (const rule of Object.keys(REQUIRE_RULES)) expect(has(r, rule), rule).toBe(true);
  });
  it('combines with the exclusions', () => {
    for (const r of rolls({ require: ['village', 'trash'], maxAttacks: 0, reaction: true }, 100)) { expect(attacks(r)).toBe(0); expect(has(r, 'village')).toBe(true); expect(has(r, 'trash')).toBe(true); }
  });
});

describe('include, keep and the impossible', () => {
  it('always includes the cards asked for', () => {
    const ids = [card('Village').id, card('Witch').id, card('Moat').id];
    for (const r of rolls({ include: ids }, 60)) for (const id of ids) expect(r.slots.some(s => s.cards.some(c => c.id === id))).toBe(true);
  });
  it('keeps locked piles when re-rolling the rest', () => {
    const first = roll({}, 3), keep = first.slots.slice(0, 4).map(s => s.key);
    const again = roll({}, 99, { keep });
    expect(again.ok).toBe(true); keep.forEach(k => expect(again.slots.some(s => s.key === k)).toBe(true)); expect(again.slots).toHaveLength(10);
  });
  it('says why instead of returning a bad kingdom', () => {
    expect(roll({ include: [card('Witch').id, card('Militia').id, card('Bandit').id], maxAttacks: 1 })).toMatchObject({ ok: false, message: expect.stringMatching(/Attacks/) });
    expect(roll({ include: Array.from({ length: 11 }, (_, i) => catalog.cards[i * 7].id) })).toMatchObject({ ok: false, message: expect.stringMatching(/only 10/) });
    const base = catalog.cards.filter(c => c.expansion === 'Dominion Base Game').map(c => c.id);
    expect(roll({ expansions: ['Dominion Base Game'], exclude: base.slice(0, 20), cards: 10 })).toMatchObject({ ok: false, message: expect.stringMatching(/only have \d+ cards that fit/) });
  });
  it('fails cleanly when an expansion has nothing for a requirement', () => {
    // four different requirements cannot all be met by a one-card kingdom
    expect(roll({ cards: 1, require: ['village', 'draw', 'trash', 'buy'] })).toMatchObject({ ok: false, message: expect.stringMatching(/room/) });
  });
});

describe('landscapes', () => {
  it('rolls the asked-for number, from the chosen types only', () => {
    for (const r of rolls({ landscapes: 2, landscapeTypes: ['Way', 'Event'] }, 60)) {
      expect(r.landscapes).toHaveLength(2);
      r.landscapes.forEach(l => expect(['Way', 'Event']).toContain(l.landscape.type));
    }
    expect(roll({ landscapes: 0 }).landscapes).toEqual([]);
  });
  it('draws landscapes from ANY expansion, whichever expansions the Kingdom cards are limited to', () => {
    const seen = new Set();
    for (const r of rolls({ expansions: ['Dominion Base Game'], landscapes: 4 }, 120)) {
      expect(r.slots.every(s => s.expansion === 'Dominion Base Game')).toBe(true);   // the Kingdom stays inside Base...
      r.landscapes.forEach(l => seen.add(l.landscape.expansion));                       // ...the landscapes don't
    }
    expect([...seen].sort()).toEqual(['Empires', 'Menagerie', 'Plunder', 'Renaissance']);   // every expansion that has landscapes
    expect(seen.has('Dominion Base Game')).toBe(false);                                      // (Base has none)
  });
  it('re-rolling a landscape also looks beyond the chosen expansions', () => {
    const opts = { expansions: ['Dominion Base Game'], landscapes: 2 }, r = roll(opts, 3);
    const next = rerollLandscape(catalog, opts, r, 0, { rng: seededRng(8) });
    expect(next.ok).toBe(true); expect(next.landscapes).toHaveLength(2);
    const outside = new Set(); for (let i = 0; i < 60; i++) { const n = rerollLandscape(catalog, opts, r, 0, { rng: seededRng(i + 100) }); n.landscapes.forEach(l => outside.add(l.landscape.expansion)); }
    expect(outside.size).toBeGreaterThan(1);
  });
  it('puts every Trait on a different Kingdom pile in the kingdom', () => {
    for (const r of rolls({ landscapes: 4, landscapeTypes: ['Trait'] }, 40)) {
      const hosts = r.landscapes.map(l => l.on);
      expect(hosts.every(Boolean)).toBe(true); expect(new Set(hosts).size).toBe(4);
      hosts.forEach(h => expect(r.slots.some(s => s.cards.some(c => c.id === h))).toBe(true));
    }
    expect(roll({ landscapes: 2, landscapeTypes: ['Way'] }).landscapes.every(l => l.on === null)).toBe(true);
  });
});

describe('setup notes', () => {
  it('adds a Bane for Young Witch: a single card costing $2 or $3, never one already in the kingdom', () => {
    for (const r of rolls({ include: [card('Young Witch').id] }, 80)) {
      const b = r.setup.bane; expect(b).toBeTruthy();
      expect(b.cards).toHaveLength(1); expect([2, 3]).toContain(b.cards[0].coins); expect(b.cards[0].debt).toBe(0);
      expect(r.slots.some(s => s.key === b.key)).toBe(false);
    }
    expect(roll({ exclude: [card('Young Witch').id] }).setup.bane).toBeNull();
  });
  it('decides Platinum/Colony and Shelters by how much of the kingdom comes from that expansion', () => {
    expect(roll({ expansions: ['Prosperity'] }).setup.platinumColony).toBe(true);            // all ten are Prosperity
    expect(roll({ expansions: ['Seaside'] }).setup.platinumColony).toBeNull();               // Prosperity isn't in play
    expect(roll({ expansions: ['Dark Ages'] }).setup.shelters).toBe(true);
    const mixed = rolls({ expansions: ['Prosperity', 'Dominion Base Game'] }, 400).filter(r => r.setup.platinumColony).length;
    expect(mixed).toBeGreaterThan(120); expect(mixed).toBeLessThan(280);                       // about half
  });
  it('asks for the Ruins pile when a Looter is in', () => {
    const looter = catalog.cards.find(c => c.types.includes('Looter'));
    expect(roll({ include: [looter.id] }).setup.ruins).toBe(true);
    expect(roll({ expansions: ['Seaside'] }).setup.ruins).toBe(false);
  });
});

describe('favour the less played', () => {
  it('draws the heavily played card less often', () => {
    const base = catalog.cards.filter(c => c.expansion === 'Dominion Base Game'), heavy = base[0].id;
    const plays = new Map([[pileKeyOf(catalog, heavy), 60]]);
    const count = (favor, id) => rolls({ expansions: ['Dominion Base Game'], cards: 5, favor }, 400, { plays }).filter(r => r.slots.some(s => s.cards.some(c => c.id === id))).length;
    expect(count(true, heavy)).toBeLessThan(count(false, heavy) * 0.5);
  });
});

describe('re-rolling one slot or one landscape', () => {
  it('swaps just that slot, and the rules still hold', () => {
    const opts = { maxAttacks: 0, require: ['village'] };
    for (let i = 0; i < 60; i++) {
      const r = roll(opts, i + 1), idx = i % 10, replaced = r.slots[idx].key;
      const next = rerollSlot(catalog, opts, r, idx, { rng: seededRng(i + 500) });
      if (!next.ok) continue;   // possible when the slot was the only Village
      expect(next.slots.some(s => s.key === replaced)).toBe(false);
      const kept = r.slots.filter((_, j) => j !== idx).map(s => s.key); kept.forEach(k => expect(next.slots.some(s => s.key === k)).toBe(true));
      expect(attacks(next)).toBe(0); expect(has(next, 'village')).toBe(true); expect(next.slots).toHaveLength(10);
    }
  });
  it('reports when nothing else fits', () => {
    const base = catalog.cards.filter(c => c.expansion === 'Dominion Base Game');
    const r = roll({ expansions: ['Dominion Base Game'], exclude: base.slice(10).map(c => c.id), cards: 10 });
    if (r.ok) expect(rerollSlot(catalog, { expansions: ['Dominion Base Game'], exclude: base.slice(10).map(c => c.id) }, r, 0, { rng: seededRng(1) })).toMatchObject({ ok: false });
  });
  it('re-rolls a landscape and keeps the Trait on its card', () => {
    const r = roll({ landscapes: 3, landscapeTypes: ['Trait', 'Way', 'Event'] }, 9), i = r.landscapes.findIndex(l => l.landscape.type !== 'Trait');
    const next = rerollLandscape(catalog, { landscapes: 3, landscapeTypes: ['Trait', 'Way', 'Event'] }, r, i, { rng: seededRng(4) });
    expect(next.ok).toBe(true); expect(next.landscapes).toHaveLength(3);
    expect(next.slots.map(s => s.key)).toEqual(r.slots.map(s => s.key));
    expect(next.landscapes.some(l => l.landscape.id === r.landscapes[i].landscape.id)).toBe(false);
  });
});

describe('the link', () => {
  it('round-trips the options', () => {
    const o = { expansions: ['Seaside', 'Dark Ages'], cards: 8, landscapes: 2, landscapeTypes: ['Way'], maxAttacks: 1, reaction: true, require: ['village', 'buy'], include: ['a:b'], exclude: ['c:d'], favor: true };
    expect(optionsFromParams(new URLSearchParams(optionsToParams(o).toString()))).toEqual(o);
    expect(optionsToParams(DEFAULT_OPTIONS).toString()).toBe('');
    expect(optionsFromParams(new URLSearchParams(''))).toEqual(DEFAULT_OPTIONS);
  });
  it('ignores junk options', () => {
    expect(optionsFromParams(new URLSearchParams('n=99&nl=x&atk=-1&req=nonsense&lt=Spell'))).toEqual(DEFAULT_OPTIONS);
  });
  it('round-trips a whole kingdom: cards, landscapes, a Trait\'s card, the bane and the setup flags', () => {
    const r = roll({ include: [card('Young Witch').id], landscapes: 3, landscapeTypes: ['Trait', 'Way'], expansions: ['Cornucopia & Guilds', 'Plunder', 'Menagerie', 'Prosperity'] }, 11);
    const back = kingdomFromParams(catalog, new URLSearchParams(kingdomToParams(r).toString()));
    expect(back.slots.map(s => s.key)).toEqual(r.slots.map(s => s.key));
    expect(back.landscapes.map(l => [l.landscape.id, l.on])).toEqual(r.landscapes.map(l => [l.landscape.id, l.on]));
    expect(back.setup.bane.key).toBe(r.setup.bane.key); expect(back.setup.platinumColony).toBe(r.setup.platinumColony); expect(back.setup.shelters).toBe(r.setup.shelters);
  });
  it('trusts nothing in a link: unknown ids dropped, a pile counted once, at most 12, a bad Trait host ignored', () => {
    const ids = catalog.cards.slice(0, 40).map(c => c.id);
    const k = kingdomFromParams(catalog, new URLSearchParams([...ids.map(i => ['c', i]), ['c', ids[0]], ['c', 'nope:nothing'], ['l', 'nope:landscape']]));
    expect(k.slots.length).toBeLessThanOrEqual(12); expect(new Set(k.slots.map(s => s.key)).size).toBe(k.slots.length); expect(k.landscapes).toEqual([]);
    expect(kingdomFromParams(catalog, new URLSearchParams('c=nope:nothing'))).toBeNull();
    expect(kingdomFromParams(catalog, new URLSearchParams(''))).toBeNull();
    const trait = catalog.landscapes.find(l => l.type === 'Trait');
    const t = kingdomFromParams(catalog, new URLSearchParams(`c=${ids[0]}&l=${trait.id}&t=${trait.id}~${ids[5]}`));
    expect(t.landscapes[0].on).toBeNull();   // the host isn't in the kingdom
  });
  it('turns a kingdom into the items the game log stores, bane and landscapes included', () => {
    const r = roll({ include: [card('Young Witch').id], landscapes: 2, landscapeTypes: ['Way'] }, 2);
    const items = toGameItems(r);
    expect(items.filter(i => i.kind === 'card')).toHaveLength(11); expect(items.filter(i => i.kind === 'landscape')).toHaveLength(2);
    expect(items.some(i => i.id === slotCardId(r.setup.bane))).toBe(true);
    expect(items.every(i => (i.kind === 'card' ? catalog.cardsById : catalog.landscapesById).has(i.id))).toBe(true);
  });
  it('maps any card of a pile to the pile', () => { expect(pileKeyOf(catalog, card('Fortune').id)).toBe(pileKeyOf(catalog, card('Gladiator').id)); expect(pileKeyOf(catalog, 'nope')).toBeNull(); });
});

describe('re-rolling one card and locking a place', () => {
  const keys = r => r.slots.map(s => s.key);
  it('re-rolling ONE card changes only that card, in the same place — nothing else moves', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = roll({ landscapes: 2 }, seed), i = seed % 10, next = rerollSlot(catalog, {}, r, i, { rng: seededRng(seed + 100) });
      expect(next.ok).toBe(true);
      keys(r).forEach((k, j) => { if (j === i) expect(keys(next)[j], `seed ${seed}`).not.toBe(k); else expect(keys(next)[j], `seed ${seed} slot ${j}`).toBe(k); });
      expect(next.landscapes.map(l => l.landscape.id)).toEqual(r.landscapes.map(l => l.landscape.id));
    }
  });
  it('re-rolling one landscape changes only that landscape, in the same place', () => {
    const r = roll({ landscapes: 3 }, 7), next = rerollLandscape(catalog, {}, r, 1, { rng: seededRng(3) });
    expect(keys(next)).toEqual(keys(r));
    r.landscapes.forEach((l, j) => { if (j === 1) expect(next.landscapes[j].landscape.id).not.toBe(l.landscape.id); else expect(next.landscapes[j].landscape.id).toBe(l.landscape.id); });
  });
  it('a locked card keeps its PLACE across a whole new roll, and the rest fill the other places cheapest first', () => {
    const r = roll({ landscapes: 3 }, 11), lockedSlots = [2, 9], lockedLand = [0];
    const next = roll({ landscapes: 3 }, 12, {
      keep: lockedSlots.map(i => r.slots[i].key), keepLandscapes: lockedLand.map(i => r.landscapes[i].landscape.id),
      lockedAt: new Map(lockedSlots.map(i => [r.slots[i].key, i])), lockedLandscapeAt: new Map(lockedLand.map(i => [r.landscapes[i].landscape.id, i])),
    });
    lockedSlots.forEach(i => expect(next.slots[i].key).toBe(r.slots[i].key));
    lockedLand.forEach(i => expect(next.landscapes[i].landscape.id).toBe(r.landscapes[i].landscape.id));
    const free = next.slots.filter((_, i) => !lockedSlots.includes(i)), cost = s => s.cards[0].coins;
    for (let i = 1; i < free.length; i++) expect(cost(free[i])).toBeGreaterThanOrEqual(cost(free[i - 1]));   // free places stay cheapest-first
    expect(new Set(keys(next)).size).toBe(10);
  });
  it('a rolled kingdom keeps its order in the link, so a locked place survives sharing and reloading', () => {
    const r = roll({}, 3), scrambled = { ...r, slots: [...r.slots.slice(5), ...r.slots.slice(0, 5)] };
    expect(kingdomFromParams(catalog, kingdomToParams(scrambled)).slots.map(s => s.key)).toEqual(keys(scrambled));
  });
});

describe('rolling from a seed', () => {
  const same = (a, b) => { expect(a.slots.map(s => s.key)).toEqual(b.slots.map(s => s.key)); expect(a.landscapes.map(l => [l.landscape.id, l.on])).toEqual(b.landscapes.map(l => [l.landscape.id, l.on])); expect(a.setup).toEqual(b.setup); };
  const OPTS = { landscapes: 2, expansions: ['Seaside', 'Dark Ages', 'Empires'], maxAttacks: 1, reaction: true, require: ['village', 'cost2', 'buy'] };
  it('the same seed and options always roll the same kingdom, down to the landscapes, their hosts and the setup notes', () => {
    for (const seed of [0, 7, 182736, 999999]) same(rollSeeded(catalog, OPTS, seed), rollSeeded(catalog, OPTS, seed));
  });
  it('a different seed rolls a different kingdom', () => {
    const keys = new Set(Array.from({ length: 30 }, (_, i) => rollSeeded(catalog, OPTS, i * 31 + 1).slots.map(s => s.key).join()));
    expect(keys.size).toBeGreaterThan(25);
  });
  it('obeys every rule while being repeatable', () => {
    for (let seed = 1; seed <= 40; seed++) { const r = rollSeeded(catalog, OPTS, seed); expect(r.ok).toBe(true); expect(attacks(r)).toBeLessThanOrEqual(1); expect(has(r, 'village')).toBe(true); expect(has(r, 'cost2')).toBe(true); }
  });
  it('carries its seed for a fresh roll, and none when it cannot be reproduced from it', () => {
    expect(rollSeeded(catalog, {}, 5).seed).toBe(5);
    const r = rollSeeded(catalog, {}, 5);
    expect(rollSeeded(catalog, {}, 6, { keep: [r.slots[0].key] }).seed).toBeNull();                        // a locked card comes from the previous kingdom
    expect(rollSeeded(catalog, {}, 6, { keepLandscapes: [] }).seed).toBe(6);                                 // nothing locked is still a fresh roll
    expect(rollSeeded(catalog, { favor: true }, 6, { plays: new Map([[r.slots[0].key, 9]]) }).seed).toBeNull();   // depends on the games played so far
  });
  it('a failed roll just reports why', () => { const r = rollSeeded(catalog, { expansions: ['Plunder'], cards: 12, include: [card('Fortune').id] }, 3); expect(r.ok === false || r.seed === 3).toBe(true); });
  it('seeds are short numbers: made six digits wide, parsed from what a person types, never anything else', () => {
    for (let i = 0; i < 50; i++) { const s = newSeed(); expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThan(1000000); expect(formatSeed(s)).toMatch(/^\d{6}$/); }
    expect(formatSeed(42)).toBe('000042'); expect(parseSeed('000042')).toBe(42); expect(parseSeed(' 182736 ')).toBe(182736);
    for (const bad of ['', 'abc', '12.5', '-3', '1e5', null, undefined, '1234567890']) expect(parseSeed(bad), String(bad)).toBeNull();
  });
  it('the seed travels in the link: options + seed from a link roll the very same kingdom again', () => {
    const r = rollSeeded(catalog, OPTS, 182736), link = new URLSearchParams(kingdomToParams(r, optionsToParams(OPTS)).toString());
    expect(link.get('seed')).toBe('182736');
    const back = kingdomFromParams(catalog, link);
    expect(back.seed).toBe(182736); same(back, r);
    same(rollSeeded(catalog, optionsFromParams(link), back.seed), r);
  });
  it('a link with no seed, or a junk one, simply has none', () => {
    const r = roll({}, 4); delete r.seed;
    expect(kingdomFromParams(catalog, new URLSearchParams(kingdomToParams(r).toString())).seed).toBeNull();
    const p = new URLSearchParams(kingdomToParams(r).toString()); p.set('seed', 'nope'); expect(kingdomFromParams(catalog, p).seed).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { achievements, grouped, BADGES } from '../src/lib/achievements.js';

let line = 0;
// a game Me sat at: places by name, optional VP by name, optional kingdom (card ids), optional Elo before by name (a rated game)
const game = (places, o = {}) => {
  const names = Object.keys(places), n = names.length;
  return {
    line: ++line, day: o.day ?? line, date: 'D' + line, n, names, places, pts: Object.fromEntries(names.map(x => [x, (n - places[x]) / (n - 1)])),
    playerVP: o.vp || {}, kingdom: (o.cards || []).map(id => ({ kind: 'card', id })), landscapes: [],
    elo: o.elo ? Object.fromEntries(names.map(x => [x, { before: o.elo[x] ?? 1000, after: o.elo[x] ?? 1000 }])) : undefined,
  };
};
const win2 = o => game({ Me: 1, A: 2 }, o);
const run = (games, { catalog = null, baseXp = null, results } = {}) => {
  const rs = results || games.filter(g => g.elo).map(g => ({ game: g, place: g.places.Me, before: g.elo.Me.before, after: g.elo.Me.before }));
  const list = achievements({ name: 'Me', results: rs, titles: 0, peak: 1000 }, [], ['Me', 'A', 'B', 'C', 'D', 'E'], null, { games, catalog, baseXp });
  return Object.fromEntries(list.map(b => [b.id, b]));
};
const earned = (b, id) => b[id] && b[id].earned;

// a stub catalog: ids c1..c60, six expansions' worth of piles
const mkCatalog = () => {
  const cards = [], piles = [];
  ['Seaside', 'Intrigue'].forEach((exp, e) => { for (let i = 0; i < 10; i++) { const id = `${exp[0]}${i}`; cards.push({ id, expansion: exp, pileKey: `${exp}::${id}`, coins: 2 + (i % 4), debt: 0, types: exp === 'Seaside' && i === 0 ? ['Action', 'Attack'] : ['Action'] }); piles.push({ expansion: exp, key: `${exp}::${id}` }); } });
  return { cardsById: new Map(cards.map(c => [c.id, c])), piles, ownedExpansions: [{ name: 'Seaside' }, { name: 'Intrigue' }] };
};
const X = Array.from({ length: 10 }, (_, i) => 'S' + i), Y = Array.from({ length: 10 }, (_, i) => 'I' + i);

describe('count tracks', () => {
  it('wins and lifetime VP step up at their thresholds, in every game type, and keep their running total', () => {
    const games = Array.from({ length: 6 }, (_, i) => win2({ vp: { Me: 50, A: 20 } }));
    const b = run(games);
    expect(earned(b, 'wins-5').date).toBe(games[4].date); expect(earned(b, 'wins-10')).toBeNull(); expect(b['wins-10'].value).toBe(6);
    expect(earned(b, 'vp-250').date).toBe(games[4].date); expect(earned(b, 'vp-500')).toBeNull(); expect(b['vp-500'].value).toBe(300);
  });
});

describe('score badges', () => {
  it('Landslide needs everyone\'s VP and a margin over 20; Twice the Crown at least double every rival', () => {
    expect(earned(run([win2({ vp: { Me: 61, A: 40 } })]), 'landslide')).not.toBeNull();
    expect(earned(run([win2({ vp: { Me: 60, A: 40 } })]), 'landslide')).toBeNull();            // exactly 20 is not over 20
    expect(earned(run([win2()]), 'landslide')).toBeNull();                                      // no VP logged
    expect(earned(run([game({ Me: 1, A: 2, B: 3 }, { vp: { Me: 40, A: 20, B: 5 } })]), 'twice-the-crown')).not.toBeNull();
    expect(earned(run([game({ Me: 1, A: 2, B: 3 }, { vp: { Me: 40, A: 21, B: 5 } })]), 'twice-the-crown')).toBeNull();
  });
  it('Colossus beats the bottom three combined at a table of five or six, and not at four', () => {
    expect(earned(run([game({ Me: 1, A: 2, B: 3, C: 4, D: 5 }, { vp: { Me: 40, A: 20, B: 10, C: 5, D: 4 } })]), 'colossus')).not.toBeNull();   // 40 > 10+5+4
    expect(earned(run([game({ Me: 1, A: 2, B: 3, C: 4, D: 5 }, { vp: { Me: 19, A: 18, B: 10, C: 5, D: 4 } })]), 'colossus')).toBeNull();
    expect(earned(run([game({ Me: 1, A: 2, B: 3, C: 4 }, { vp: { Me: 40, A: 5, B: 4, C: 3 } })]), 'colossus')).toBeNull();
  });
});

describe('table badges', () => {
  it('Unbeaten Blade counts 1v1 games only; King of the Hill two wins in a row at 5+; Apex Predator a six-player win; Shadow three top-half finishes', () => {
    const big = () => game({ Me: 1, A: 2, B: 3, C: 4, D: 5 });
    expect(earned(run([win2(), big(), win2(), win2()]), 'unbeaten-blade')).not.toBeNull();      // the big game between does not break a run of duels
    expect(earned(run([win2(), game({ Me: 2, A: 1 }), win2(), win2()]), 'unbeaten-blade')).toBeNull();
    expect(earned(run([big(), big()]), 'king-of-the-hill')).not.toBeNull();
    expect(earned(run([big(), win2(), big()]), 'king-of-the-hill')).toBeNull();
    expect(earned(run([game({ Me: 1, A: 2, B: 3, C: 4, D: 5, E: 6 })]), 'apex-predator')).not.toBeNull();
    expect(earned(run([game({ Me: 2, A: 1, B: 3, C: 4 }), game({ Me: 2, A: 1, B: 3, C: 4 }), game({ Me: 1, A: 2 })]), 'shadow')).not.toBeNull();
    expect(earned(run([game({ Me: 2, A: 1, B: 3, C: 4 }), game({ Me: 3, A: 1, B: 2, C: 4 }), game({ Me: 1, A: 2 })]), 'shadow')).toBeNull();
  });
  it('World Voyage needs a win at every table size from two to six', () => {
    const at = n => game(Object.fromEntries(['Me', 'A', 'B', 'C', 'D', 'E'].slice(0, n).map((x, i) => [x, i + 1])));
    const five = [2, 3, 4, 5].map(at);
    expect(earned(run(five), 'world-voyage')).toBeNull(); expect(run(five)['world-voyage'].earned).toBeNull();
    expect(earned(run([...five, at(6)]), 'world-voyage')).not.toBeNull();
  });
  it('The Phoenix is a win as the lowest-rated at a table of three or more; God Slayer needs a rival 200 above', () => {
    const g = game({ Me: 1, A: 2, B: 3 }, { elo: { Me: 900, A: 1000, B: 1100 } });
    expect(earned(run([g]), 'phoenix')).not.toBeNull(); expect(earned(run([g]), 'giant-slayer')).not.toBeNull(); expect(earned(run([g]), 'god-slayer')).not.toBeNull();
    expect(earned(run([game({ Me: 1, A: 2, B: 3 }, { elo: { Me: 900, A: 1000, B: 899 } })]), 'phoenix')).toBeNull();   // B is lower
    expect(earned(run([game({ Me: 1, A: 2 }, { elo: { Me: 900, A: 1000 } })]), 'phoenix')).toBeNull();                 // two players is not a table of three
    expect(earned(run([game({ Me: 1, A: 2 }, { elo: { Me: 900, A: 1000 } })]), 'god-slayer')).toBeNull();            // only 100 above
  });
});

describe('kingdom badges (need the catalog)', () => {
  const cat = mkCatalog();
  it('earn nothing without the catalog, or with a half-logged kingdom', () => {
    expect(earned(run([win2({ cards: X })]), 'pure-blood')).toBeNull();
    expect(earned(run([win2({ cards: X.slice(0, 9) })], { catalog: cat }), 'pure-blood')).toBeNull();
  });
  it('Pure Blood: all ten from one expansion; Trial by Fire: a win with 3+ Attack cards; Peaceful Realm: none', () => {
    expect(earned(run([game({ Me: 2, A: 1 }, { cards: X })], { catalog: cat }), 'pure-blood')).not.toBeNull();          // playing is enough
    expect(earned(run([win2({ cards: [...X.slice(0, 5), ...Y.slice(0, 5)] })], { catalog: cat }), 'pure-blood')).toBeNull();
    const attacky = { ...cat, cardsById: new Map([...cat.cardsById].map(([k, c]) => [k, { ...c, types: ['Action', 'Attack'] }])) };
    expect(earned(run([win2({ cards: X })], { catalog: attacky }), 'trial-by-fire')).not.toBeNull();
    expect(earned(run([win2({ cards: X })], { catalog: cat }), 'trial-by-fire')).toBeNull();                            // one Attack card only
    expect(earned(run([game({ Me: 2, A: 1 }, { cards: Y })], { catalog: cat }), 'peaceful-realm')).not.toBeNull();     // no Attack in Y
    expect(earned(run([game({ Me: 2, A: 1 }, { cards: X })], { catalog: cat }), 'peaceful-realm')).toBeNull();         // S0 is an Attack
  });
  it('Gilded Hall by average cost; Humble Means by the dearest card, and a debt card is never cheap', () => {
    const dear = { ...cat, cardsById: new Map([...cat.cardsById].map(([k, c]) => [k, { ...c, coins: 5 }])) };
    expect(earned(run([win2({ cards: X })], { catalog: dear }), 'gilded-hall')).not.toBeNull();
    expect(earned(run([win2({ cards: X })], { catalog: cat }), 'gilded-hall')).toBeNull();                              // averages 3.5
    const cheap = n => ({ ...cat, cardsById: new Map([...cat.cardsById].map(([k, c]) => [k, { ...c, coins: n }])) });
    const b4 = run([win2({ cards: X })], { catalog: cheap(4) }), b3 = run([win2({ cards: X })], { catalog: cheap(3) });
    expect(earned(b4, 'cheap-tricks')).not.toBeNull(); expect(earned(b4, 'fire-sale')).toBeNull();
    expect(earned(b3, 'fire-sale')).not.toBeNull();
    const debt = { ...cheap(2), cardsById: new Map([...cheap(2).cardsById].map(([k, c]) => [k, k === 'S3' ? { ...c, debt: 4, coins: 0 } : c])) };
    expect(earned(run([win2({ cards: X })], { catalog: debt }), 'cheap-tricks')).toBeNull();
  });
  it('every owned expansion is a track (more than half the piles, then all) and Cartographer counts the expansions touched', () => {
    const b = run([win2({ cards: X.slice(0, 5) }), win2({ cards: X.slice(5, 6) }), win2({ cards: Y })], { catalog: cat });
    expect(earned(b, 'exp-seaside-half')).not.toBeNull();   // 6 of 10 on the second game: more than half
    expect(earned(b, 'exp-seaside-full')).toBeNull(); expect(b['exp-seaside-full'].value).toBe(6);
    expect(earned(b, 'exp-intrigue-full')).not.toBeNull();
    expect(earned(b, 'sets-all')).not.toBeNull(); expect(b['sets-5'].earned).toBeNull();   // two expansions in this catalog: not five
    expect(b['exp-seaside-half'].name).toBe('Wanted Pirate'); expect(b['exp-seaside-half'].trackName).toBe('Seaside');
  });
});

describe('Spoils', () => {
  it('counts a game\'s XP before badge payouts: more than 150, then more than 200', () => {
    const a = win2(), b = win2(), c = win2();
    const r = run([a, b, c], { baseXp: new Map([[a.line, 150], [b.line, 151], [c.line, 205]]) });
    expect(r['spoils-150'].earned.line).toBe(b.line); expect(r['spoils-200'].earned.line).toBe(c.line); expect(r['spoils-150'].value).toBe(205);
  });
});

describe('the whole list', () => {
  it('has unique ids, sorts into the documented groups, and keeps tracks together', () => {
    const ids = BADGES.map(b => b.id); expect(new Set(ids).size).toBe(ids.length);
    const secs = grouped(Object.values(run([win2()], { catalog: mkCatalog(), baseXp: new Map() })));
    expect(secs.map(s => s.group)).toEqual(['Winning', 'Comebacks and upsets', 'The table', 'The kingdom', 'Expansions', 'Milestones']);
    const slayer = secs.find(s => s.group === 'Comebacks and upsets').items.find(i => i.id === 'slayer');
    expect(slayer.steps.map(s => s.id)).toEqual(['giant-slayer', 'god-slayer']);
  });
});

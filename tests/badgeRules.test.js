import { describe, it, expect } from 'vitest';
import { achievements, grouped, legendFrom, BADGES, GROUPS, TIERS } from '../src/lib/achievements.js';

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
  it('The Phoenix is a win as the lowest-rated at a table of three or more; Regicide (God Slayer) needs a rival 200 above', () => {
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
    expect(secs.map(s => s.group)).toEqual(['Winning', 'Comebacks and upsets', 'The table', 'The kingdom', 'Landscapes', 'Expansions', 'Milestones']);
    const slayer = secs.find(s => s.group === 'Comebacks and upsets').items.find(i => i.id === 'slayer');
    expect(slayer.steps.map(s => s.id)).toEqual(['giant-slayer', 'god-slayer']);
  });
});

// ---- the second batch ----
const rated = (places, me, others = {}, o = {}) => game(places, { ...o, elo: { Me: me, ...others } });
const winsRated = n => Array.from({ length: n }, () => rated({ Me: 1, A: 2 }, 1000, { A: 1000 }));

describe('streaks, margins and VP quirks', () => {
  it('Unstoppable is five rated wins in a row; Overkill a 50 VP margin; Total Domination more than all rivals combined at 3+', () => {
    expect(earned(run(winsRated(5)), 'unstoppable')).not.toBeNull(); expect(earned(run(winsRated(4)), 'unstoppable')).toBeNull();
    expect(earned(run([...winsRated(2), rated({ Me: 2, A: 1 }, 1000, { A: 1000 }), ...winsRated(3)]), 'unstoppable')).toBeNull();
    expect(earned(run([win2({ vp: { Me: 80, A: 30 } })]), 'overkill')).not.toBeNull(); expect(earned(run([win2({ vp: { Me: 79, A: 30 } })]), 'overkill')).toBeNull();
    expect(run([win2({ vp: { Me: 79, A: 30 } })]).landslide.value).toBe(49);
    expect(earned(run([game({ Me: 1, A: 2, B: 3 }, { vp: { Me: 46, A: 20, B: 25 } })]), 'total-domination')).not.toBeNull();
    expect(earned(run([game({ Me: 1, A: 2, B: 3 }, { vp: { Me: 45, A: 20, B: 25 } })]), 'total-domination')).toBeNull();
    expect(earned(run([win2({ vp: { Me: 80, A: 10 } })]), 'total-domination')).toBeNull();   // two players is not enough
  });
  it('The Centurion, The Unfortunate One and Into the Abyss read your own VP, whatever your place', () => {
    expect(earned(run([game({ Me: 2, A: 1 }, { vp: { Me: 100, A: 101 } })]), 'the-centurion')).not.toBeNull();
    expect(earned(run([game({ Me: 2, A: 1 }, { vp: { Me: 99, A: 101 } })]), 'the-centurion')).toBeNull();
    expect(earned(run([game({ Me: 2, A: 1 }, { vp: { Me: 1, A: 9 } })]), 'unfortunate-one')).not.toBeNull();
    expect(earned(run([game({ Me: 2, A: 1 }, { vp: { Me: -3, A: 9 } })]), 'into-the-abyss')).not.toBeNull();
    expect(earned(run([game({ Me: 2, A: 1 }, { vp: { Me: 0, A: 9 } })]), 'into-the-abyss')).toBeNull();
    expect(earned(run([game({ Me: 2, A: 1 })]), 'unfortunate-one')).toBeNull();   // no VP logged
  });
  it('Lone Wolf counts 1v1 wins and Royal Court wins at 4 or more', () => {
    expect(earned(run(Array.from({ length: 10 }, () => win2())), 'lone-wolf')).not.toBeNull(); expect(earned(run(Array.from({ length: 9 }, () => win2())), 'lone-wolf')).toBeNull();
    const four = () => game({ Me: 1, A: 2, B: 3, C: 4 });
    expect(earned(run(Array.from({ length: 10 }, four)), 'royal-court')).not.toBeNull(); expect(run(Array.from({ length: 9 }, four))['royal-court'].value).toBe(9);
  });
});

describe('rated-table badges', () => {
  it('The Final Boss and The Chosen One are six-player rated wins as the highest- and lowest-rated', () => {
    const six = (me, rest) => rated({ Me: 1, A: 2, B: 3, C: 4, D: 5, E: 6 }, me, { A: rest, B: rest, C: rest, D: rest, E: rest });
    expect(earned(run([six(1100, 1000)]), 'the-final-boss')).not.toBeNull(); expect(earned(run([six(1000, 1000)]), 'the-final-boss')).toBeNull();
    expect(earned(run([six(900, 1000)]), 'the-chosen-one')).not.toBeNull(); expect(earned(run([six(1100, 1000)]), 'the-chosen-one')).toBeNull();
    expect(earned(run([rated({ Me: 1, A: 2, B: 3 }, 900, { A: 1000, B: 1000 })]), 'the-chosen-one')).toBeNull();   // only three at the table
  });
  it('Bounty Hunter counts games where you finished ahead of any higher-rated player, five different ones', () => {
    const ahead = () => rated({ Me: 1, A: 2, B: 3 }, 1000, { A: 1100, B: 900 });
    expect(earned(run(Array.from({ length: 5 }, ahead)), 'bounty-hunter')).not.toBeNull();
    expect(run(Array.from({ length: 4 }, ahead))['bounty-hunter'].value).toBe(4);
    const behind = () => rated({ Me: 3, A: 2, B: 1 }, 1000, { A: 1100, B: 1100 });   // finished behind the higher-rated: no
    expect(earned(run(Array.from({ length: 6 }, behind)), 'bounty-hunter')).toBeNull();
  });
  it('Kingslayer beats whoever led the league going into the game', () => {
    const g0 = rated({ Me: 2, A: 1 }, 1000, { A: 1100 }), g1 = rated({ Me: 1, A: 2 }, 1000, { A: 1100 }), g2 = rated({ Me: 1, A: 2 }, 1000, { A: 1100 });
    [g0, g1, g2].forEach((g, i) => { g.idx = i; });
    g0.snapshot = { Me: 1000, A: 1100, B: 1000 }; g1.snapshot = { Me: 1000, A: 1100, B: 1000 }; g2.snapshot = { Me: 1000, A: 1100, B: 1000 };
    const b = run([g0, g1, g2]);
    expect(b.kingslayer.earned.line).toBe(g1.line);          // g0 was lost, and nothing led before it
    const tied = rated({ Me: 1, A: 2 }, 1000, { A: 1000 }), before = rated({ Me: 3, A: 1 }, 1000, { A: 1000 });
    before.idx = 0; tied.idx = 1; before.snapshot = { Me: 1000, A: 1000 };
    expect(earned(run([before, tied]), 'kingslayer')).toBeNull();   // nobody was clearly on top
  });
  it('The Immortal needs 100 rated wins AND a 1,500 peak; The Unbreakable 20 without finishing last', () => {
    const wins = Array.from({ length: 100 }, (_, i) => rated({ Me: 1, A: 2 }, 1000 + i * 6, { A: 1000 }));
    const rs = wins.map((g, i) => ({ game: g, place: 1, before: 1000 + i * 6, after: 1000 + (i + 1) * 6 }));   // peaks at 1,600
    expect(earned(run(wins, { results: rs }), 'the-immortal')).not.toBeNull();
    const low = rs.map(r => ({ ...r, after: 1100 }));
    expect(earned(run(wins, { results: low }), 'the-immortal')).toBeNull();
    const clean = Array.from({ length: 20 }, () => rated({ Me: 2, A: 1, B: 3 }, 1000, { A: 1000, B: 1000 })), tie = rated({ Me: 3, A: 1, B: 3 }, 1000, { A: 1000, B: 1000 });
    expect(earned(run(clean), 'the-unbreakable')).not.toBeNull(); expect(earned(run([...clean.slice(0, 10), tie, ...clean.slice(10, 19)]), 'the-unbreakable')).toBeNull();   // a shared last place breaks the run
  });
  it('The Grandmaster wins at every size against opponents rated at least as high on average', () => {
    const at = (n, opp) => rated(Object.fromEntries(['Me', 'A', 'B', 'C', 'D', 'E'].slice(0, n).map((x, i) => [x, i + 1])), 1000, Object.fromEntries(['A', 'B', 'C', 'D', 'E'].map(x => [x, opp])));
    expect(earned(run([2, 3, 4, 5, 6].map(n => at(n, 1000))), 'the-grandmaster')).not.toBeNull();
    expect(earned(run([2, 3, 4, 5, 6].map(n => at(n, 999))), 'the-grandmaster')).toBeNull();
  });
});

// a catalog with `exps` expansions of `piles` piles each, ids "e<i>p<j>", plus landscapes of each of the five types
const mkBig = (exps = 11, piles = 6) => {
  const names = ['Dominion Base Game', 'Intrigue', 'Seaside', 'Prosperity', 'Hinterlands', 'Dark Ages', 'Cornucopia & Guilds', 'Empires', 'Renaissance', 'Menagerie', 'Plunder'].slice(0, exps);
  const cards = [], pl = [];
  names.forEach((exp, e) => { for (let j = 0; j < piles; j++) { const id = `e${e}p${j}`; cards.push({ id, expansion: exp, pileKey: `${exp}::${id}`, coins: 4, debt: 0, types: ['Action'] }); pl.push({ expansion: exp, key: `${exp}::${id}` }); } });
  const types = ['Event', 'Landmark', 'Project', 'Way', 'Trait'], lands = [];
  for (let i = 0; i < 60; i++) lands.push({ id: `l${i}`, type: types[i % 5] });
  return { cardsById: new Map(cards.map(c => [c.id, c])), piles: pl, ownedExpansions: names.map(name => ({ name })), landscapesById: new Map(lands.map(l => [l.id, l])), landscapeTypes: types, _cards: cards };
};
const withKingdom = (g, ids, landIds = []) => { g.kingdom = [...ids.map(id => ({ kind: 'card', id })), ...landIds.map(id => ({ kind: 'landscape', id }))]; return g; };

describe('expansion-mix badges (need the catalog)', () => {
  const cat = mkBig();
  const g = (won, ids, lands) => withKingdom(won ? win2() : game({ Me: 2, A: 1 }), ids, lands);
  it('First Expedition, World Traveler and The Melting Pot are about playing with 3, 5 and 7 expansions in one game', () => {
    const b = run([g(false, ['e0p0', 'e1p0', 'e2p0', 'e0p1', 'e1p1', 'e2p1', 'e0p2', 'e1p2', 'e2p2', 'e0p3'])], { catalog: cat });
    expect(earned(b, 'first-expedition')).not.toBeNull(); expect(earned(b, 'world-traveler')).toBeNull();
    const b7 = run([g(false, ['e0p0', 'e1p0', 'e2p0', 'e3p0', 'e4p0', 'e5p0', 'e6p0', 'e0p1', 'e1p1', 'e2p1'])], { catalog: cat });
    expect(earned(b7, 'melting-pot')).not.toBeNull(); expect(b7['melting-pot'].value).toBe(7);
  });
  it('Cultural Exchange and United Kingdoms are WINS with 5 and 8 expansions in one game', () => {
    const five = ['e0p0', 'e1p0', 'e2p0', 'e3p0', 'e4p0', 'e0p1', 'e1p1', 'e2p1', 'e3p1', 'e4p1'];
    expect(earned(run([g(true, five)], { catalog: cat }), 'cultural-exchange')).not.toBeNull();
    expect(earned(run([g(false, five)], { catalog: cat }), 'cultural-exchange')).toBeNull();           // played, not won
    expect(earned(run([g(true, five)], { catalog: cat }), 'united-kingdoms')).toBeNull();
    const eight = ['e0p0', 'e1p0', 'e2p0', 'e3p0', 'e4p0', 'e5p0', 'e6p0', 'e7p0', 'e0p1', 'e1p1'];
    expect(earned(run([g(true, eight)], { catalog: cat }), 'united-kingdoms')).not.toBeNull();
  });
  it('Territorial Expansion is five WINS with 5 or more expansions in the kingdom', () => {
    const five = ['e0p0', 'e1p0', 'e2p0', 'e3p0', 'e4p0', 'e0p1', 'e1p1', 'e2p1', 'e3p1', 'e4p1'];
    const four = ['e0p0', 'e1p0', 'e2p0', 'e3p0', 'e0p1', 'e1p1', 'e2p1', 'e3p1', 'e0p2', 'e1p2'];
    const n = k => run(Array.from({ length: k }, () => g(true, five)), { catalog: cat });
    expect(earned(n(4), 'territorial-expansion')).toBeNull(); expect(n(4)['territorial-expansion'].value).toBe(4);
    expect(earned(n(5), 'territorial-expansion')).not.toBeNull();
    expect(earned(run([...Array.from({ length: 4 }, () => g(true, five)), g(true, four), g(false, five)], { catalog: cat }), 'territorial-expansion')).toBeNull();   // fewer expansions, or lost
  });
  it('The Specialist is ten wins in games featuring the same expansion, a game counting for every expansion in it', () => {
    const wins = n => Array.from({ length: n }, (_, i) => withKingdom(win2(), ['e0p0', `e${1 + (i % 3)}p0`]));
    expect(earned(run(wins(10), { catalog: cat }), 'the-specialist')).not.toBeNull();   // all ten feature expansion 0
    expect(run(wins(9), { catalog: cat })['the-specialist'].value).toBe(9);
    expect(earned(run(wins(10).map((g, i) => (i === 3 ? withKingdom(game({ Me: 2, A: 1 }), ['e0p0']) : g)), { catalog: cat }), 'the-specialist')).toBeNull();   // a loss does not count
  });
  it('Ten Kingdoms needs every pile from a different expansion; A World Divided exactly two expansions of five', () => {
    const tenDiff = Array.from({ length: 10 }, (_, i) => `e${i}p0`);
    expect(earned(run([g(true, tenDiff)], { catalog: cat }), 'ten-kingdoms')).not.toBeNull();
    expect(earned(run([g(true, [...tenDiff.slice(0, 9), 'e0p1'])], { catalog: cat }), 'ten-kingdoms')).toBeNull();
    const two = [...Array.from({ length: 5 }, (_, j) => `e0p${j}`), ...Array.from({ length: 5 }, (_, j) => `e1p${j}`)];
    expect(earned(run([g(true, two)], { catalog: cat }), 'a-world-divided')).not.toBeNull();
    expect(earned(run([g(true, [...two.slice(0, 4), 'e2p0', ...two.slice(5)])], { catalog: cat }), 'a-world-divided')).toBeNull();
  });
  it('Collector, Grand Archivist and Master of All Realms count different piles seen; Jack of All Trades a win with each expansion; The Specialist ten wins with one', () => {
    const small = mkBig(11, 40), all = small._cards.map(c => c.id);
    const games = [];
    for (let i = 0; i < all.length; i += 10) games.push(g(true, all.slice(i, i + 10)));
    const b = run(games, { catalog: small });                          // 440 piles in 44 games, one win each
    expect(earned(b, 'collector').line).toBe(games[9].line); expect(earned(b, 'grand-archivist').line).toBe(games[24].line);
    expect(earned(b, 'master-of-all-realms')).not.toBeNull(); expect(b['master-of-all-realms'].target).toBe(440);
    expect(earned(b, 'jack-of-all-trades')).not.toBeNull();
    expect(earned(b, 'the-specialist')).toBeNull();                    // each expansion shows up in only 4 of those wins
    const half = run(games.slice(0, 20), { catalog: small });
    expect(earned(half, 'jack-of-all-trades')).toBeNull(); expect(earned(half, 'master-of-all-realms')).toBeNull();
  });
});

describe('landscape badges (need the catalog)', () => {
  const cat = mkBig();
  const L = type => ({ Event: 'l0', Landmark: 'l1', Project: 'l2', Way: 'l3', Trait: 'l4' }[type]);
  const w = (...lands) => withKingdom(win2(), [], lands);
  it('five wins featuring a type earn that type\'s badge, and playing without a win does not count', () => {
    const b = run(Array.from({ length: 5 }, () => w(L('Trait'))), { catalog: cat });
    expect(earned(b, 'changing-tides')).not.toBeNull(); expect(earned(b, 'turning-point')).toBeNull();
    expect(earned(run([...Array.from({ length: 4 }, () => w(L('Event'))), withKingdom(game({ Me: 2, A: 1 }), [], [L('Event')])], { catalog: cat }), 'turning-point')).toBeNull();
    expect(run(Array.from({ length: 5 }, () => w(L('Way'))), { catalog: cat })['the-wayfinder'].earned).not.toBeNull();
  });
  it('Shifting Realities and Fortune Favors the Bold are wins with 2 and 3 landscape types; Master of Fate needs a win with each type over time', () => {
    const b = run([w('l0', 'l5', 'l1')], { catalog: cat });          // l0 and l5 are both Events; l1 a Landmark: two types
    expect(earned(b, 'shifting-realities')).not.toBeNull(); expect(earned(b, 'fortune-favors')).toBeNull();
    expect(earned(run([w('l0', 'l1', 'l2')], { catalog: cat }), 'fortune-favors')).not.toBeNull();
    const five = ['l0', 'l1', 'l2', 'l3', 'l4'].map(l => w(l));
    expect(earned(run(five, { catalog: cat }), 'master-of-fate').line).toBe(five[4].line);
    expect(earned(run(five.slice(0, 4), { catalog: cat }), 'master-of-fate')).toBeNull();
  });
  it('Landscape Connoisseur and Beyond the Horizon count different landscape cards seen, in any game', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `l${i}`), games = [];
    for (let i = 0; i < 60; i += 5) games.push(withKingdom(game({ Me: 2, A: 1 }), [], ids.slice(i, i + 5)));
    const b = run(games, { catalog: cat });
    expect(earned(b, 'landscape-connoisseur').line).toBe(games[4].line); expect(earned(b, 'beyond-the-horizon').line).toBe(games[9].line);
  });
});

describe('kingdom-shape badges, second batch', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `e0p${i}`);
  const cat10 = f => { const c = mkBig(1, 10); c._cards.forEach((x, i) => f(x, i)); return c; };
  it('The Great Divide: three cards at 2 or less and three at 6 or more (a debt card is neither)', () => {
    const c = cat10((x, i) => { x.coins = i < 3 ? 2 : i < 6 ? 6 : 4; });
    expect(earned(run([withKingdom(win2(), ids)], { catalog: c }), 'the-great-divide')).not.toBeNull();
    const d = cat10((x, i) => { x.coins = i < 3 ? 2 : i < 6 ? 6 : 4; if (i === 0) x.debt = 3; });
    expect(earned(run([withKingdom(win2(), ids)], { catalog: d }), 'the-great-divide')).toBeNull();
  });
  it('Gold Rush wins with 3 Treasures; War Zone plays with 5 Attacks; The Pacifist wins with none', () => {
    const t = cat10((x, i) => { x.types = i < 3 ? ['Treasure'] : ['Action']; });
    expect(earned(run([withKingdom(win2(), ids)], { catalog: t }), 'gold-rush')).not.toBeNull(); expect(earned(run([withKingdom(game({ Me: 2, A: 1 }), ids)], { catalog: t }), 'gold-rush')).toBeNull();
    const a = cat10((x, i) => { x.types = i < 5 ? ['Action', 'Attack'] : ['Action']; });
    expect(earned(run([withKingdom(game({ Me: 2, A: 1 }), ids)], { catalog: a }), 'war-zone')).not.toBeNull();
    expect(earned(run([withKingdom(win2(), ids)], { catalog: cat10(() => {}) }), 'the-pacifist')).not.toBeNull();
    expect(earned(run([withKingdom(game({ Me: 2, A: 1 }), ids)], { catalog: cat10(() => {}) }), 'the-pacifist')).toBeNull();
  });
});

describe('Dominion Legend and tiers', () => {
  it('is earned only when every non-legendary badge is, on the game that finished the set', () => {
    const a = win2(), b = win2(); a.idx = 0; b.idx = 1;
    const list = [{ id: 'x', tier: 'common', earned: { date: a.date, line: a.line } }, { id: 'y', tier: 'rare', earned: { date: b.date, line: b.line } }, { id: 'z', tier: 'legendary', earned: null }];
    expect(legendFrom(list, [a, b]).line).toBe(b.line);
    expect(legendFrom([...list, { id: 'w', tier: 'epic', earned: null }], [a, b])).toBeNull();
    expect(legendFrom([], [a])).toBeNull();
  });
  it('every badge has one of the five tiers, and each group has a place in the page order', () => {
    const ok = new Set(TIERS.map(t => t.id)), list = Object.values(run([win2()], { catalog: mkBig(), baseXp: new Map() }));
    expect(list.filter(b => !ok.has(b.tier)).map(b => b.id)).toEqual([]);
    expect(list.filter(b => !GROUPS.includes(b.group)).map(b => b.id)).toEqual([]);
    expect(list.find(b => b.id === 'dominion-legend').bonus).toBe(2000);
    expect(list.find(b => b.id === 'the-immortal').bonus).toBe(1000); expect(list.find(b => b.id === 'the-unbreakable').bonus).toBe(600);
    expect(list.find(b => b.id === 'grand-archivist').name).toBe('Grand Archivist');
  });
});

describe('tracks made from single badges', () => {
  it('Big swing and Bigfoot (100+ Elo) share the Elo Swing track; War Zone then Trial by Fire share Warpath; Terraformer is the landscape mix track', () => {
    const list = Object.values(run([win2()], { catalog: mkCatalog(), baseXp: new Map() }));
    const t = id => list.find(b => b.id === id);
    expect([t('big-swing').track, t('bigfoot').track]).toEqual(['swing', 'swing']);
    expect(list.findIndex(b => b.id === 'big-swing')).toBeLessThan(list.findIndex(b => b.id === 'bigfoot'));
    expect(list.findIndex(b => b.id === 'war-zone')).toBeLessThan(list.findIndex(b => b.id === 'trial-by-fire'));
    expect([t('war-zone').track, t('trial-by-fire').track]).toEqual(['warpath', 'warpath']);
    expect(t('shifting-realities').trackName).toBe('Terraformer');
    expect(t('a-world-divided').name).toBe('Crusader');   // the id never changed, only the name
  });
});

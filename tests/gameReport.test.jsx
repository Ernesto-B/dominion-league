import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PageContext } from '../src/PageContext.js';
import GameReport, { Players, Kingdom, Time, Rewards } from '../src/components/GameReport.jsx';
import * as Eng from '../src/lib/engine.js';
import { gameReport, kingdomStats } from '../src/lib/gameReport.js';
import { realCatalog } from './dominion/fixtures.js';
import cfg from '../public/data/config.json';

const catalog = realCatalog();
const id = name => catalog.cards.find(c => c.name === name).id;
let line = 0;
const row = (finish, o = {}) => ({ _line: ++line, date: o.date || '2026-10-10', type: o.type || '', finish, sets: '', landscapes: '', playerVP: o.vp || {}, minutes: o.minutes ?? '', kingdom: (o.cards || []).map(n => ({ kind: 'card', id: id(n) })), savedAt: o.savedAt || null });
const run = rows => Eng.compute({ ...cfg, players: ['Ann', 'Bob', 'Cy', 'Dee'], seasons: [{ name: 'S1', start: '2026-10-01', weeks: 10, targetGames: 4, playoffSpots: 2 }] }, rows, Eng.todayDay());

const K1 = ['Village', 'Smithy', 'Market', 'Moat', 'Chapel', 'Militia', 'Festival', 'Laboratory', 'Workshop', 'Remodel'];
const K2 = ['Village', 'Smithy', 'Cellar', 'Witch', 'Bandit', 'Library', 'Mine', 'Gardens', 'Merchant', 'Poacher'];
const rows = () => {
  line = 0;
  return [
    row('Ann > Bob > Cy > Dee', { vp: { Ann: 40, Bob: 30, Cy: 20, Dee: 10 }, minutes: 40, cards: K1, date: '2026-10-10' }),
    row('Bob > Ann > Cy > Dee', { vp: { Bob: 35, Ann: 33, Cy: 20, Dee: 12 }, minutes: 50, cards: K1, date: '2026-10-17' }),
    row('Ann > Bob > Cy > Dee', { vp: { Ann: 50, Bob: 25, Cy: 22, Dee: 8 }, minutes: 30, cards: K2, date: '2026-10-24' }),
    row('Dee > Ann > Bob > Cy', { vp: { Dee: 41, Ann: 40, Bob: 20, Cy: 18 }, minutes: 45, cards: K2, date: '2026-10-24' }),
  ];
};

describe('the kingdom of a game', () => {
  it('averages the coin cost, counts the Attacks and the cost levels, and groups the expansions', () => {
    const D = run(rows()), k = kingdomStats(D.games[0], catalog);
    expect(k.cards).toHaveLength(10); expect(k.avgCost).toBeCloseTo(k.cards.reduce((t, c) => t + c.coins, 0) / 10, 9);
    expect(k.costBuckets.reduce((a, b) => a + b, 0)).toBe(10); expect(k.attacks).toBe(1);   // Militia
    expect(k.expansions.reduce((n, e) => n + e.n, 0)).toBe(10);
  });
  it('is null without a catalog or a logged kingdom', () => {
    const D = run(rows()); expect(kingdomStats(D.games[0], null)).toBeNull();
    expect(kingdomStats(run([row('Ann > Bob')]).games[0], catalog)).toBeNull();
  });
});

describe('gameReport', () => {
  const D = run(rows()), r = n => gameReport(D, D.games[n], { catalog });
  it('places the game in its night and season, and its length against the group\'s', () => {
    expect(r(2).when).toMatchObject({ nightNo: 1, nightOf: 2 }); expect(r(3).when).toMatchObject({ nightNo: 2, nightOf: 2 });
    const t = r(2).time; expect(t.minutes).toBe(30); expect(t.rankFastest).toBe(1); expect(t.of).toBe(4); expect(t.avgAll).toBeCloseTo(41.25, 9); expect(t.perMinute).toBeCloseTo(1.7, 5);
    expect(gameReport(run([row('Ann > Bob')]), run([row('Ann > Bob')]).games[0], { catalog }).time).toBeNull();
  });
  it('lists the players in finishing order with Elo, VP and XP', () => {
    const rep = r(0);
    expect(rep.players.map(p => p.name)).toEqual(['Ann', 'Bob', 'Cy', 'Dee']);
    const ann = rep.players[0];
    expect(ann).toMatchObject({ place: 1, won: true, vp: 40 }); expect(ann.vpShare).toBe(1); expect(rep.players[1].vpShare).toBeCloseTo(0.75, 9);
    expect(ann.elo.delta).toBeCloseTo(D.games[0].elo.Ann.after - D.games[0].elo.Ann.before, 9);
    expect(ann.xp.total).toBeGreaterThan(0); expect(ann.xp.levelAfter).toBeGreaterThanOrEqual(ann.xp.levelBefore);
    expect(ann.rank.after).toBe(1);
  });
  it('finds the cards and landscapes a player had never sat at a table with, only in the first game that had them', () => {
    expect(r(0).players[0].newCards).toHaveLength(10);
    expect(r(1).players[0].newCards).toHaveLength(0);                      // the same kingdom again
    const ann = r(2).players[0].newCards.map(c => c.name).sort();          // K2 against K1: only what K1 did not have
    expect(ann).toEqual(['Bandit', 'Cellar', 'Gardens', 'Library', 'Merchant', 'Mine', 'Poacher', 'Witch']);
    expect(r(0).players.every(p => p.newCards.length === 10)).toBe(true);  // everyone was new to everything in game one
  });
  it('compares a player with their other games, and only once there are enough of them', () => {
    const two = run([row('Ann > Bob', { vp: { Ann: 30, Bob: 20 }, minutes: 30 }), row('Bob > Ann', { vp: { Bob: 30, Ann: 25 }, minutes: 35 })]);
    expect(gameReport(two, two.games[0], { catalog }).players[0].compare).toEqual([]);   // one other game is too few to call anything usual
    const ann = r(3).players.find(p => p.name === 'Ann'), vp = ann.compare.find(c => c.id === 'vp');
    expect(vp.value).toBe(40); expect(vp.usual).toBeCloseTo((40 + 33 + 50) / 3, 9); expect(vp.good).toBe(false);
    const dee = r(3).players.find(p => p.name === 'Dee'); expect(dee.compare.find(c => c.id === 'vp').good).toBe(true);
  });
  it('says what the Elo odds were, and who was the underdog', () => {
    const ann = r(0).players[0]; expect(ann.table.expected).toBeCloseTo(0.5, 9);                 // an even table going in
    const dee = r(3).players.find(p => p.name === 'Dee'); expect(dee.table.diff).toBeGreaterThan(0); expect(dee.table.actual).toBe(1);   // the lowest-rated player won
    expect(r(3).highlights.some(h => h.title === 'Upset')).toBe(true);
  });
  it('writes a few highlights, best first and never more than five', () => {
    for (let i = 0; i < D.games.length; i++) { const h = r(i).highlights; expect(h.length).toBeLessThanOrEqual(5); h.forEach(x => { expect(x.title).toBeTruthy(); expect(x.text).toBeTruthy(); }); }
    expect(r(0).highlights.some(h => /Fresh cards/.test(h.title))).toBe(true);
  });
});

describe('the XP explanation adds up to the XP paid', () => {
  // a league with streaks, improvements, game nights in a row, friendlies, landscapes-free kingdoms and shared places, so most parts show up
  const finishes = ['Ann > Bob > Cy > Dee', 'Bob > Ann > Dee > Cy', 'Ann > Bob > Cy > Dee', 'Ann > Cy = Bob > Dee', 'Dee > Cy > Bob > Ann', 'Dee > Ann > Cy > Bob', 'Cy > Dee > Ann > Bob', 'Ann > Bob', 'Bob > Ann > Cy', 'Ann > Bob > Cy > Dee', 'Ann > Dee > Bob > Cy', 'Bob > Dee > Cy > Ann'];
  const cards = [K1, K2, K1, K2, [...K1.slice(0, 5), ...K2.slice(5)], K2, K1, K1, K2, K2, K1, K1];
  const league = () => { line = 0; return run(finishes.map((f, i) => row(f, { date: `2026-10-${String(2 + Math.floor(i / 2) * (i < 8 ? 1 : 3)).padStart(2, '0')}`, type: i === 3 ? 'Friendly' : '', vp: Object.fromEntries(f.split(/[>=]/).map(x => x.trim()).map((n, k) => [n, 40 - k * 7 + (i % 3)])), minutes: 30 + i * 3, cards: cards[i] }))); };
  it('every part of every player\'s XP in every game is explained to the exact number', () => {
    const D = league(); let checked = 0; const seen = new Set();
    for (const g of D.games) {
      const rep = gameReport(D, g, { catalog });
      for (const p of rep.players) {
        if (!p.xp) continue;
        for (const [part, amount] of Object.entries(p.xp.parts)) {
          const lines = p.xp.explain[part];
          expect(lines, `${p.name} game ${g.line} ${part}`).toBeTruthy();
          expect(lines.reduce((t, l) => t + (l.amount || 0), 0), `${p.name} game ${g.line} ${part}`).toBe(amount);
          seen.add(part); checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
    for (const part of ['finish', 'win', 'half', 'streak', 'vp', 'cards', 'attendance', 'surprise']) expect(seen.has(part), part + ' never showed up in the test league').toBe(true);
  });
  it('says the real numbers in words', () => {
    const D = league(), rep = gameReport(D, D.games[0], { catalog }), ann = rep.players[0].xp.explain;
    expect(ann.finish[0].text).toMatch(/Last place pays 25/); expect(ann.finish[1].text).toMatch(/3 places above last, 8 XP each \(you finished 1st of 4\)/);
    expect(ann.cards.some(l => l.item === 'Village')).toBe(true);
    expect(ann.badges.every(l => l.tier)).toBe(true);   // each badge line says how rare the badge is
  });
});

describe('what else the kingdom says', () => {
  const D = run((() => { line = 0; return [row('Ann > Bob', { cards: K1, minutes: 30 }), row('Bob > Ann', { cards: K1, minutes: 35 }), row('Ann > Bob', { cards: K2, minutes: 40 })]; })());
  it('counts the types and the tools the cards offer', () => {
    const k = kingdomStats(D.games[0], catalog);
    expect(k.types.find(t => t.name === 'Attack').n).toBe(1);
    expect(k.tools.every(t => t.n > 0)).toBe(true); expect(k.tools.find(t => t.label === '+Buy')).toBeTruthy();
  });
  it('knows which cards the group had never played, and the one it plays most', () => {
    const rep = (n) => gameReport(D, D.games[n], { catalog }).kingdom;
    expect(rep(0).history.firstInGroup).toHaveLength(10); expect(rep(0).history.mostPlayed).toBeNull();
    expect(rep(1).history.firstInGroup).toHaveLength(0);
    expect(rep(2).history.firstInGroup.map(c => c.name).sort()).toEqual(['Bandit', 'Cellar', 'Gardens', 'Library', 'Merchant', 'Mine', 'Poacher', 'Witch']);
    expect(rep(2).history.mostPlayed.before).toBe(2);   // Village and Smithy were in both earlier games
  });
});

describe('when a match began', () => {
  it('uses the real start when there is one, else the save time minus the length (marked approximate), else nothing', async () => {
    const { matchStart, startLabel } = await import('../src/lib/gameTime.js');
    const real = matchStart({ startedAt: '2026-10-29T19:04:00Z', savedAt: '2026-10-29T20:00:00Z', minutes: 40 });
    expect(real).toEqual({ iso: '2026-10-29T19:04:00Z', approx: false });
    const guess = matchStart({ savedAt: '2026-10-29T20:00:00Z', minutes: 40 });
    expect(guess.approx).toBe(true); expect(guess.iso).toBe('2026-10-29T19:20:00.000Z');
    expect(matchStart({ savedAt: '2026-10-29T20:00:00Z' })).toBeNull(); expect(matchStart({ minutes: 40 })).toBeNull(); expect(matchStart({})).toBeNull();
    expect(startLabel({})).toBeNull(); expect(startLabel({ date: '2026-10-29', savedAt: '2026-10-29T20:00:00Z' })).toMatch(/^\d{1,2}:\d{2}/);   // only a save time, close to the game's day: shown as a plain time
    expect(startLabel({ date: '2026-01-10', savedAt: '2026-10-29T20:00:00Z' })).toBeNull();                                                  // a bulk import: the save time says nothing expect(startLabel({ savedAt: '2026-10-29T20:00:00Z', minutes: 40 })).toMatch(/^~\d{1,2}:\d{2}/); expect(startLabel({ startedAt: '2026-10-29T19:04:00Z' })).not.toMatch(/^~/);
    expect(startLabel({ startedAt: 'garbage' })).toBeNull();
  });
});

describe('the game report page', () => {
  const D = run(rows());
  const page = { D, gid: 'a', hashFor: (r, g, x) => `#/${r}/${g}${x != null ? '/' + x : ''}`, me: null, catalog, allGroups: [{ id: 'a' }] };
  const draw = el => renderToString(createElement(PageContext.Provider, { value: page }, el));
  it('renders the page without throwing', () => {
    expect(draw(createElement(GameReport, { game: D.games[3] }))).toContain('gr-player');
  });
  // each tab is a component of its own, with its own scope: render every one of them for every game, with and without a signed-in player
  it('renders every tab for every game', () => {
    D.games.forEach(game => {
      const rep = gameReport(D, game, { catalog });
      [undefined, { name: 'Ann' }].forEach(me => {
        page.me = me || null;
        expect(draw(createElement(Players, { rep, game, me: page.me }))).toContain('gr-player');
        draw(createElement(Kingdom, { rep, game, loaded: true }));
        draw(createElement(Time, { rep }));
        const html = draw(createElement(Rewards, { rep, me: page.me, loaded: true }));
        expect(html).toContain('gr-xp');
        expect(html).toContain('href="#/players/a/');   // a player's name links to their page
      });
    });
  });
});

describe('the report with grace states', () => {
  it('renders every tab when players are held, dropped or saved', () => {
    line = 0;
    const order = ['Ann > Bob > Cy > Dee', 'Ann > Bob > Cy > Dee', 'Ann > Bob > Cy > Dee', 'Ann > Bob > Cy > Dee', 'Dee > Cy > Bob > Ann', 'Dee > Cy > Bob > Ann', 'Dee > Cy > Bob > Ann', 'Bob > Ann > Cy > Dee', 'Dee > Cy > Bob > Ann', 'Ann > Bob > Cy > Dee', 'Dee > Cy > Bob > Ann', 'Dee > Cy > Bob > Ann'];
    const D = run(order.map((f, i) => row(f, { date: `2026-10-${String(i + 1).padStart(2, '0')}`, minutes: 30, cards: K1 })));
    const page = { D, gid: 'a', hashFor: (r, g, x) => `#/${r}/${g}${x != null ? '/' + x : ''}`, me: null, catalog, allGroups: [{ id: 'a' }] };
    const draw = el => renderToString(createElement(PageContext.Provider, { value: page }, el));
    let kinds = new Set();
    D.games.forEach(game => {
      const rep = gameReport(D, game, { catalog });
      rep.players.forEach(p => { if (p.elo && p.elo.grace) kinds.add(p.elo.grace.kind); });
      draw(createElement(Players, { rep, game, me: null }));
    });
    expect(kinds.size).toBeGreaterThan(0);
  });
});

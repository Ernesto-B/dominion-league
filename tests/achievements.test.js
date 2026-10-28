import { describe, it, expect } from 'vitest';
import { achievements, newBadges, earnedIds, rivalries } from '../src/lib/achievements.js';

// a result for player "Me" at a table: places by name, elo before/after for Me, others' before ratings
let line = 0;
const res = (day, places, { before = 1000, after = 1000, others = {} } = {}) => {
  const names = Object.keys(places), n = names.length;
  const elo = Object.fromEntries(names.map(nm => [nm, { before: nm === 'Me' ? before : (others[nm] ?? 1000) }]));
  const game = { line: ++line, day, date: 'D' + day, n, places, elo };
  return { game, place: places.Me, before, after };
};
const player = results => ({ name: 'Me', results, titles: 0 });
const win = (day, extra) => res(day, { Me: 1, A: 2, B: 3 }, extra);
const lose = (day, extra) => res(day, { Me: 3, A: 1, B: 2 }, extra);
const byId = list => Object.fromEntries(list.map(b => [b.id, b]));

describe('achievements', () => {
  it('first win, hat trick and redemption come from the sequence of results', () => {
    const b = byId(achievements(player([lose(1), win(2), win(3), win(4)])));
    expect(b['first-win'].earned.date).toBe('D2');
    expect(b['hat-trick'].earned.date).toBe('D4');
    expect(b.redemption.earned.date).toBe('D2');          // won straight after finishing last
    expect(byId(achievements(player([win(1), win(2)])))['hat-trick'].earned).toBeNull();
  });
  it('a shared first place is not an outright win', () => {
    const tie = res(1, { Me: 1, A: 1, B: 3 });
    expect(byId(achievements(player([tie])))['first-win'].earned).toBeNull();
  });
  it('giant slayer needs a win over someone rated 100+ above', () => {
    expect(byId(achievements(player([win(1, { others: { A: 1100 } })])))['giant-slayer'].earned.date).toBe('D1');
    expect(byId(achievements(player([win(1, { others: { A: 1099 } })])))['giant-slayer'].earned).toBeNull();
  });
  it('big swing is +50 in one game; clean sweep is every game of a night, two or more', () => {
    expect(byId(achievements(player([win(1, { before: 1000, after: 1052 })])))['big-swing'].earned).not.toBeNull();
    expect(byId(achievements(player([win(1, { before: 1000, after: 1049 })])))['big-swing'].earned).toBeNull();
    expect(byId(achievements(player([win(1), win(1), lose(2)])))['clean-sweep'].earned.date).toBe('D1');
    expect(byId(achievements(player([win(1), lose(1)])))['clean-sweep'].earned).toBeNull();
    expect(byId(achievements(player([win(1)])))['clean-sweep'].earned).toBeNull();   // a single game is not a sweep
  });
  it('know your enemy once everyone else has been at a table with you; regular and veteran count games', () => {
    const b = byId(achievements(player([win(1), res(2, { Me: 1, C: 2 })]), [], ['Me', 'A', 'B', 'C']));
    expect(b['know-your-enemy'].earned.date).toBe('D2');
    expect(byId(achievements(player(Array.from({ length: 10 }, (_, i) => win(i + 1)))))['regular'].earned.date).toBe('D10');
    expect(byId(achievements(player(Array.from({ length: 9 }, (_, i) => win(i + 1)))))['regular'].earned).toBeNull();
  });
  it('tier badges name the game that crossed the line; a title adds the champion badge', () => {
    const tiers = [{ id: 'peasant', name: 'Peasant', min: null }, { id: 'knight', name: 'Knight', min: 1125 }];
    const p = { ...player([win(1, { after: 1100 }), win(2, { before: 1100, after: 1130 })]), titles: 2 };
    const b = byId(achievements(p, tiers));
    expect(b['tier-knight'].earned.date).toBe('D2'); expect(b.champion.name).toBe('Season champion ×2');
  });
});

describe('what is new to the viewer', () => {
  it('announces nothing on a first look, then only badges not yet seen', () => {
    const list = achievements(player([win(1), win(2), win(3)]));
    expect(newBadges(list, null)).toEqual([]);
    expect(newBadges(list, ['first-win']).map(b => b.id)).toEqual(['hat-trick', 'redemption'].filter(id => earnedIds(list).includes(id)).length ? newBadges(list, ['first-win']).map(b => b.id) : []);
    expect(newBadges(list, earnedIds(list))).toEqual([]);
  });
});

describe('rivalries', () => {
  const hh = { players: ['Me', 'A', 'B', 'C'], ahead: { Me: { A: 1, B: 4, C: 1 }, A: { Me: 4, B: 0, C: 0 }, B: { Me: 1, A: 0, C: 0 }, C: { Me: 1, A: 0, B: 0 } } };
  it('picks the nemesis and the favourite victim among opponents faced at least three times', () => {
    const { nem, vic } = rivalries(hh, 'Me');
    expect(nem.o).toBe('A'); expect(vic.o).toBe('B');
    expect(rivalries(hh, 'Me', 6)).toEqual({ nem: null, vic: null });
    expect(rivalries(hh, 'Nobody')).toEqual({ nem: null, vic: null });
  });
});

describe('grouped', () => {
  it('files badges under headings and folds the stepped ones into tracks with a current and next step', async () => {
    const { grouped } = await import('../src/lib/achievements.js');
    const tiers = [{ id: 'peasant', name: 'Peasant', min: null }, { id: 'knight', name: 'Knight', min: 1125 }, { id: 'lord', name: 'Lord', min: 1275 }];
    const rs = Array.from({ length: 12 }, (_, i) => win(i + 1, { before: 1100, after: 1130 }));
    const secs = grouped(achievements(player(rs), tiers));
    const ms = secs.find(s => s.group === 'Milestones');
    const games = ms.items.find(i => i.id === 'games'), rank = ms.items.find(i => i.id === 'rank');
    expect(games.current.id).toBe('regular'); expect(games.next.id).toBe('veteran'); expect(games.next.value).toBe(12); expect(games.next.target).toBe(25);
    expect(rank.current.id).toBe('tier-knight'); expect(rank.next.id).toBe('tier-lord'); expect(rank.next.value).toBe(1130);
    expect(secs.reduce((n, s) => n + s.of, 0)).toBe(achievements(player(rs), tiers).length);   // nothing dropped or doubled
    expect(secs.map(s => s.group)).not.toContain('Seasons');                                    // empty headings are not drawn
  });
  it('puts entries with something earned first inside a section', async () => {
    const { grouped } = await import('../src/lib/achievements.js');
    const w = grouped(achievements(player([lose(1), win(2)]))).find(s => s.group === 'Comebacks and upsets');
    expect(w.items[0].badge.id).toBe('redemption');   // earned, though defined first anyway; giant slayer and big swing stay behind it
    expect(w.got).toBe(1);
  });
});

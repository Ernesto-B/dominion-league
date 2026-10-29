import { describe, it, expect } from 'vitest';
import { computeXp, gameXp, levelAt, xpForLevel, XP, badgesFor } from '../src/lib/xp.js';

let line = 0;
const game = (places, o = {}) => {
  const names = Object.keys(places), n = names.length;
  const pts = Object.fromEntries(names.map(x => [x, (n - places[x]) / (n - 1)]));
  return { line: ++line, day: o.day ?? line, date: 'D' + line, n, names, places, pts, playerVP: o.vp || {}, vp: o.vp ? Math.max(...Object.values(o.vp)) : null, landscapes: o.landscapes || [], kingdom: o.kingdom || [], elo: o.elo };
};
const D = (games, extra = {}) => ({ E: { start: 1000, scale: 400 }, games, seasons: [], players: ['Me', 'A', 'B', 'C'].map(name => ({ name })), ...extra });
const king = [{ kind: 'card', id: 1 }, { kind: 'card', id: 2 }, { kind: 'landscape', id: 9 }];

describe('levels', () => {
  it('cost 90 XP up to level 9, then step up every tenth level to a cap of 350, and never skip or go down', () => {
    expect([0, 89, 90, 359, 360, 2394, 2395, 23569, 23570, 58570].map(levelAt)).toEqual([1, 1, 2, 4, 5, 19, 20, 99, 100, 200]);
    expect([2, 10, 20, 50, 100, 200].map(xpForLevel)).toEqual([90, 870, 2395, 8470, 23570, 58570]);
    expect([9, 10, 19, 20, 89, 90, 91, 250].map(L => xpForLevel(L) - xpForLevel(L - 1))).toEqual([90, 150, 150, 175, 325, 350, 350, 350]);
    let last = -1; for (let L = 1; L <= 250; L++) { expect(xpForLevel(L)).toBeGreaterThan(last); last = xpForLevel(L); expect(levelAt(xpForLevel(L))).toBe(L); }
  });
});

describe('computeXp', () => {
  it('pays each part of a four-player game by hand', () => {
    const g = game({ Me: 1, A: 2, B: 3, C: 4 }, { vp: { Me: 40, A: 30 }, landscapes: ['Event'], kingdom: king });
    const x = computeXp(D([g]));
    expect(x.get('Me').perGame[0].parts).toEqual({ finish: 49, win: 15, surprise: 20, vp: 50, landscapes: 10, cards: 10 });   // 3+3 for cards, 4 for the landscape
    expect(x.get('Me').total).toBe(154);
    expect(x.get('A').perGame[0].parts).toMatchObject({ finish: 41, half: 8, surprise: 7, vp: 38 });   // 2nd of four is the top half; 30 VP + 10 x 30/40
    expect(x.get('B').perGame[0].parts).toEqual({ finish: 33, landscapes: 10, cards: 10 });           // 3rd of four: no top-half prize, and it did no better than Elo expected
    expect(x.get('C').total).toBe(25 + 10 + 10);                                                      // last place still earns
  });
  it('doubles finish + win XP on a win streak, up to 100 in all; cards only pay the first time', () => {
    const x = computeXp(D([game({ Me: 1, A: 2, B: 3, C: 4 }, { kingdom: king }), game({ Me: 1, A: 2, B: 3, C: 4 }, { kingdom: king })]));
    const second = x.get('Me').perGame[1].parts;
    expect(second.streak).toBe(36);          // 64 doubled is 128, capped at 100
    expect(second.cards).toBeUndefined();    // seen those already
    expect(x.get('A').perGame[1].parts.streak).toBeUndefined();
  });
  it('pays an improvement bonus for finishing clearly higher than last time, and counts friendly games', () => {
    const x = computeXp(D([game({ Me: 4, A: 1, B: 2, C: 3 }), game({ Me: 2, A: 1, B: 3, C: 4 })]));
    expect(x.get('Me').perGame[1].parts.improve).toBe(20);   // last to 2nd of four: a rise of 2/3 of the table's points
    expect(computeXp(D([game({ Me: 4, A: 1, B: 2, C: 3 }), game({ Me: 3, A: 1, B: 2, C: 4 })])).get('Me').perGame[1].parts.improve).toBe(10);   // last to 2nd last: 1/3
    expect(x.get('Me').perGame).toHaveLength(2);
  });
  it('beating a much higher rating pays more than beating an equal one', () => {
    const elo = { Me: { before: 900, after: 900 }, A: { before: 1100, after: 1100 } };
    const hi = computeXp(D([game({ Me: 1, A: 2 }, { elo })])).get('Me').perGame[0].parts.surprise;
    const eq = computeXp(D([game({ Me: 1, A: 2 })])).get('Me').perGame[0].parts.surprise;
    expect(hi).toBeGreaterThan(eq);
    expect(computeXp(D([game({ Me: 2, A: 1 })])).get('Me').perGame[0].parts.surprise).toBeUndefined();   // losing as the favourite earns none
  });
  it('a badge pays 30, a season title 100 + 30 on the last game of the season, and a level reached pays its badge', () => {
    const g1 = game({ Me: 1, A: 2 }, { day: 1 }), g2 = game({ Me: 2, A: 1 }, { day: 9 });
    const base = computeXp(D([g1, g2])).get('Me').total;
    const badges = new Map([['Me', [{ id: 'first-win', earned: { date: 'D', line: g1.line } }]]]);
    expect(computeXp(D([g1, g2]), badges).get('Me').total).toBe(base + XP.badge);
    const t = computeXp(D([g1, g2], { seasons: [{ champion: 'me', end: 5 }] })).get('Me');
    expect(t.total).toBe(base + XP.season + XP.badge);
    expect(t.perGame[0].parts.season).toBe(XP.season);      // game 2 is after the season ended
    const big = computeXp(D([game({ Me: 1, A: 2 }, { vp: { Me: 1000, A: 5 } })])).get('Me');
    expect(big.steps.filter(s => s.earned).map(s => s.level)).toEqual([5, 10]);
    expect(big.total).toBe(33 + 15 + 20 + 1010 + (30 + 10) + (30 + 20));   // 1,078, then the Apprentice (+10) and Adept (+20) badges on top of their 30 each
    expect(big.level).toBe(11);
  });
  it('is only ever added to', () => {
    const x = computeXp(D([game({ Me: 4, A: 1, B: 2, C: 3 }), game({ Me: 4, A: 1, B: 2, C: 3 })])).get('Me');
    expect(x.perGame.every(g => g.xp > 0)).toBe(true);
  });
});

describe('showing up and improving on yourself', () => {
  it('pays 3 XP more for each game night in a row, once a night, and a missed night starts it over', () => {
    const x = computeXp(D([game({ Me: 1, A: 2 }, { day: 1 }), game({ Me: 1, A: 2 }, { day: 2 }), game({ Me: 2, A: 1 }, { day: 2 }), game({ Me: 1, A: 2 }, { day: 3 }), game({ A: 1, B: 2 }, { day: 4 }), game({ Me: 1, A: 2 }, { day: 5 })]));
    expect(x.get('Me').perGame.map(g => g.parts.attendance)).toEqual([undefined, 3, undefined, 6, undefined]);   // nights 1, 2, 2 again, 3; night 4 missed; night 5 is a fresh start
    expect(x.get('A').perGame.map(g => g.parts.attendance)).toEqual([undefined, 3, undefined, 6, 9, 12]);
  });
  it('improvement compares with your own recent average, not just the last game', () => {
    // 1st, 1st, 1st, then 2nd of four: worse than the average, so no bonus; and last, last, then 2nd of four is a rise of 2/3
    const strong = computeXp(D([...[1, 1, 1].map(() => game({ Me: 1, A: 2, B: 3, C: 4 })), game({ Me: 2, A: 1, B: 3, C: 4 })])).get('Me');
    expect(strong.perGame[3].parts.improve).toBeUndefined();
    const weak = computeXp(D([...[4, 4].map(p => game({ Me: p, A: 1, B: 2, C: 3 })), game({ Me: 2, A: 1, B: 3, C: 4 })])).get('Me');
    expect(weak.perGame[2].parts.improve).toBe(20);
  });
});

describe('gameXp', () => {
  it('lists what one game paid each player in finishing order, and flags a level reached in it', () => {
    const g = game({ Me: 2, A: 1 }, { vp: { Me: 1000, A: 5 } });   // the loser's 1,000 VP is a level-up by itself
    const rows = gameXp(computeXp(D([g])), g);
    expect(rows.map(r => r.name)).toEqual(['A', 'Me']);
    expect(rows[0].levelUp).toBeNull();
    expect(rows[1].levelUp).toBe(11);   // 25 + 1,010 and two level badges expect(rows[1].xp).toBeGreaterThan(1000);
    expect(gameXp(null, g)).toEqual([]); expect(gameXp(computeXp(D([g])), null)).toEqual([]);
  });
  it('pays XP in a friendly game too', () => {
    const g = { ...game({ Me: 1, A: 2 }), type: 'Friendly' };
    expect(gameXp(computeXp(D([g])), g).every(r => r.xp > 0)).toBe(true);
  });
});

describe('badgesFor is worked out once per player, league and catalog', () => {
  const league = () => D([game({ Me: 1, A: 2 })], { tiers: [], ranked: [{ name: 'Me' }, { name: 'A' }], players: ['Me', 'A'].map(name => ({ name, results: [], titles: 0, peak: 1000 })) });
  const cat = () => ({ cardsById: new Map(), piles: [], ownedExpansions: [], landscapesById: new Map(), landscapeTypes: [] });
  it('hands back the same list for the same league and catalog, and recomputes for a new one', () => {
    const d = league(), me = d.players[0], c = cat();
    const first = badgesFor(d, me);
    expect(badgesFor(d, me)).toBe(first);                         // the search box, the front page and the ladder all share it
    expect(badgesFor(d, d.players[1])).not.toBe(first);           // each player has their own
    const withCatalog = badgesFor(d, me, c);
    expect(withCatalog).not.toBe(first);                          // the catalog arriving adds the kingdom badges
    expect(badgesFor(d, me, c)).toBe(withCatalog);
    expect(badgesFor(league(), league().players[0])).not.toBe(first);   // a reloaded league (a new D) starts fresh
  });
});

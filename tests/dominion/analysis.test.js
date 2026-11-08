import { describe, it, expect } from 'vitest';
import { analyseKingdom, concernsOf, verdictOf } from '../../src/dominion/analysis.js';
import { generate, DEFAULT_OPTIONS, seededRng } from '../../src/dominion/randomizer.js';
import { realCatalog } from './fixtures.js';

describe('analyseKingdom', () => {
  const catalog = realCatalog();
  const slotsOf = names => names.map(n => { const c = catalog.cards.find(x => x.name === n); return { key: catalog.piles.find(p => p.id === c.pileId).key, name: c.name, cards: [c] }; });

  it('counts the jobs of the cards and names them', () => {
    const a = analyseKingdom(catalog, slotsOf(['Chapel', 'Village', 'Smithy', 'Militia', 'Market']));
    const row = k => a.rows.find(r => r.key === k);
    expect(a.n).toBe(5);
    expect(row('trash').cards.map(c => c.name)).toContain('Chapel');
    expect(row('village').count).toBeGreaterThanOrEqual(1);
    expect(row('attack').cards.map(c => c.name)).toEqual(['Militia']);
    expect(row('buy').cards.map(c => c.name)).toContain('Market');
  });
  it('says what is missing and what is over the usual', () => {
    const none = analyseKingdom(catalog, slotsOf(['Moat', 'Gardens']));
    expect(none.missing.length).toBeGreaterThan(0);
    expect(verdictOf(none)).toMatch(/None recorded/);
    const two = analyseKingdom(catalog, slotsOf(['Chapel', 'Village', 'Market', 'Smithy', 'Moneylender']));
    expect(verdictOf(two)).not.toMatch(/undefined/);
  });
  it('lists what stands out as short sentences, and nothing for a covered kingdom', () => {
    const gap = concernsOf(analyseKingdom(catalog, slotsOf(['Gardens', 'Moat'])));
    expect(gap.length).toBeGreaterThan(0); expect(gap.join(' ')).toMatch(/No .* in the kingdom/);
    expect(concernsOf(analyseKingdom(catalog, slotsOf(['Village', 'Smithy', 'Chapel', 'Market'])))).toEqual([]);
    expect(concernsOf(analyseKingdom(catalog, []))).toEqual([]);
  });
  it('counts the expansions the Kingdom cards come from, with how many cards each', () => {
    const a = analyseKingdom(catalog, slotsOf(['Cellar', 'Village', 'Smithy', 'Lighthouse', 'Fairgrounds']));
    expect(a.expansions.reduce((t, e) => t + e.count, 0)).toBe(a.n);
    expect(a.expansions.length).toBe(3);
    expect(analyseKingdom(catalog, []).expansions).toEqual([]);
  });
  it('shows the average and the cost shape of the priced cards', () => {
    const a = analyseKingdom(catalog, slotsOf(['Cellar', 'Village', 'Smithy', 'Market']));
    expect(a.cost.avg).toBeCloseTo((2 + 3 + 4 + 5) / 4, 5);
    expect(a.cost.bins.map(b => b.count)).toEqual([1, 1, 1, 1, 0]);
  });
  it('reads any rolled kingdom without a problem, and an empty one', () => {
    const r = generate(catalog, DEFAULT_OPTIONS, { rng: seededRng(37) });
    const a = analyseKingdom(catalog, r.slots);
    expect(a.n).toBe(r.slots.length);
    expect(analyseKingdom(catalog, []).n).toBe(0);
    expect(verdictOf(analyseKingdom(catalog, null))).toMatch(/Nothing/);
  });
});

import { fixIssue, fixPlan, fixChoices, applyFix } from '../../src/dominion/randomizer.js';
describe('fixIssue (the Analyze panel’s Fix)', () => {
  const catalog = realCatalog();
  const fromNames = names => { const slots = names.map(n => { const c = catalog.cards.find(x => x.name === n); return { key: catalog.piles.find(p => p.id === c.pileId).key, name: c.name, cards: [c] }; }); return { slots, landscapes: [], setup: {}, seed: null }; };
  const rows = (st, k) => analyseKingdom(catalog, st.slots).rows.find(r => r.key === k);
  it('swaps one plain card for one with the missing job, and nothing else moves', () => {
    const st = fromNames(['Village', 'Smithy', 'Market', 'Cellar', 'Moat', 'Gardens', 'Workshop', 'Festival', 'Militia', 'Harbinger']);
    expect(rows(st, 'trash').count).toBe(0);
    for (let seed = 1; seed <= 20; seed++) {
      const r = fixIssue(catalog, DEFAULT_OPTIONS, st, 'trash', { rng: seededRng(seed) });
      expect(r.ok).toBe(true);
      expect(r.slots).toHaveLength(10);
      expect(analyseKingdom(catalog, r.slots).rows.find(x => x.key === 'trash').count).toBeGreaterThan(0);
      expect(r.slots.filter(s => st.slots.some(o => o.key === s.key))).toHaveLength(9);
      expect(['Moat', 'Village', 'Market', 'Smithy', 'Militia'].every(n => r.slots.some(s => s.name === n) || r.removed.name === n)).toBe(true);
    }
  });
  it('never swaps out a locked card, or the only one doing a needed job', () => {
    const st = fromNames(['Village', 'Smithy', 'Market', 'Cellar', 'Gardens']);
    const lockAll = st.slots.map(s => s.key);
    expect(fixIssue(catalog, DEFAULT_OPTIONS, st, 'trash', { locked: lockAll }).ok).toBe(false);
    const r = fixIssue(catalog, DEFAULT_OPTIONS, st, 'trash', { rng: seededRng(3) });
    if (r.ok) expect(['Village', 'Smithy', 'Market']).not.toContain(r.removed.name);
  });
  it('reports why when nothing can be swapped', () => {
    const st = fromNames(['Village']);
    const r = fixIssue(catalog, DEFAULT_OPTIONS, st, 'trash');
    expect(r.ok).toBe(false); expect(r.message).toMatch(/doing a job|No other|no card/i);
  });
  it('plans first: says which cards can go and why the others cannot, and suggests one', () => {
    const st = fromNames(['Village', 'Smithy', 'Market', 'Cellar', 'Gardens', 'Workshop']);
    const lock = st.slots.find(x => x.name === 'Gardens').key;
    const plan = fixPlan(catalog, DEFAULT_OPTIONS, st, 'trash', { locked: [lock], rng: seededRng(2) });
    expect(plan.ok).toBe(true);
    expect(plan.cards.find(c => c.name === 'Gardens')).toMatchObject({ ok: false, why: 'Locked' });
    expect(plan.cards.find(c => c.name === 'Village').ok).toBe(false);   // the only village
    expect(plan.cards.find(c => c.key === plan.suggested).ok).toBe(true);
  });
  it('lists the cards that could take a place, each with the missing job, and applies only the one chosen', () => {
    const st = fromNames(['Village', 'Smithy', 'Market', 'Cellar', 'Gardens', 'Workshop']);
    const plan = fixPlan(catalog, DEFAULT_OPTIONS, st, 'trash', { rng: seededRng(2) });
    const choices = fixChoices(catalog, DEFAULT_OPTIONS, st, 'trash', plan.suggested, { rng: seededRng(4) });
    expect(choices.length).toBeGreaterThan(3);
    const pick = choices[1];
    const res = applyFix(catalog, DEFAULT_OPTIONS, st, plan.suggested, pick.key);
    expect(res.ok).toBe(true);
    expect(res.added.key).toBe(pick.key);
    expect(res.removed.key).toBe(plan.suggested);
    expect(analyseKingdom(catalog, res.slots).rows.find(r => r.key === 'trash').count).toBeGreaterThan(0);
    expect(st.slots.map(x => x.key)).toContain(plan.suggested);   // the original kingdom is untouched
    expect(fixChoices(catalog, DEFAULT_OPTIONS, st, 'trash', st.slots.find(x => x.name === 'Village').key)).toEqual([]);   // a card that may not go has no choices
  });
});

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RankMark, { rankState } from '../src/components/RankState.jsx';

const commoner = { id: 'commoner', name: 'Commoner', icon: 'commoner', min: 1075 }, knight = { id: 'knight', name: 'Knight', icon: 'knight', min: 1150 };
const html = el => renderToStaticMarkup(el);

describe('a rank in a trial or in grace is shown as a picture', () => {
  it('has nothing to show for an ordinary player', () => {
    expect(rankState({ name: 'Ann', tier: commoner, trial: null, grace: null })).toBeNull();
    expect(html(createElement(RankMark, { p: { name: 'Ann', tier: commoner, trial: null, grace: null } }))).not.toContain('tmark');
  });
  it('a trial: pips for the games (done ones ticked) and the Elo against the line', () => {
    const p = { name: 'Ann', tier: commoner, elo: 1178, trial: { tier: knight, have: 1, need: 2 }, grace: null };
    const s = rankState(p); expect(s.kind).toBe('trial'); expect(s.short).toBe('Knight trial: 1 of 2');
    const h = html(s.pop);
    expect(h).toContain('Knight trial'); expect((h.match(/class="pip on"/g) || []).length).toBe(1); expect(h).toContain('✓'); expect(h).toContain('1150'); expect(h).toContain('28 over the line');
    expect(html(createElement(RankMark, { p }))).toContain('class="tgem trial"');
  });
  it('grace: pips for the games left, how far under the line, and says when it has run out', () => {
    const left = rankState({ name: 'Ann', tier: commoner, elo: 1051, trial: null, grace: { line: 1075, left: 1, total: 2 } });
    expect(left.kind).toBe('grace'); expect(left.short).toContain('1 more game under the line allowed');
    const h = html(left.pop); expect(h).toContain('Commoner grace'); expect(h).toContain('24 under the line'); expect((h.match(/class="pip on"/g) || []).length).toBe(1); expect(h).toContain('pip used');
    const out = rankState({ name: 'Ann', tier: commoner, elo: 1051, trial: null, grace: { line: 1075, left: 0, total: 2 } });
    expect(out.short).toBe('Commoner grace: the next game under the line drops the rank'); expect(html(out.pop)).toContain('One more game under 1075');
    expect(html(createElement(RankMark, { p: { name: 'Ann', tier: commoner, elo: 1051, trial: null, grace: { line: 1075, left: 1, total: 2 } } }))).toContain('class="tgem grace"');
  });
});

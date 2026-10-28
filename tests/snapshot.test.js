import { describe, it, expect } from 'vitest';
import { saveSnapshot, loadSnapshot, clearSnapshot, ago } from '../src/lib/snapshot.js';

const memory = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } }; };
const snap = { cfg: { title: 'T' }, me: { name: 'Ann' }, data: { rows: [{ a: 1 }], players: [], groups: [], seasons: [] } };

describe('the offline snapshot', () => {
  it('round-trips what was saved and stamps when', () => {
    const s = memory(); saveSnapshot(snap, s);
    const back = loadSnapshot(s);
    expect(back.me.name).toBe('Ann'); expect(back.data.rows).toEqual([{ a: 1 }]); expect(back.at).toBeGreaterThan(0);
  });
  it('is gone after clearSnapshot (sign-out), and absent or damaged storage gives null', () => {
    const s = memory(); saveSnapshot(snap, s); clearSnapshot(s);
    expect(loadSnapshot(s)).toBeNull();
    expect(loadSnapshot(null)).toBeNull();
    s.setItem('dl.snapshot.v1', '{not json'); expect(loadSnapshot(s)).toBeNull();
    s.setItem('dl.snapshot.v1', JSON.stringify({ cfg: {} })); expect(loadSnapshot(s)).toBeNull();   // incomplete copies are not used
  });
  it('never throws when storage is full', () => {
    expect(() => saveSnapshot(snap, { setItem() { throw new Error('quota'); } })).not.toThrow();
  });
  it('says how old it is in plain words', () => {
    const now = 1e12;
    expect(ago(now, now)).toBe('just now'); expect(ago(now - 5 * 60000, now)).toBe('5 min ago');
    expect(ago(now - 3 * 3600000, now)).toBe('3 h ago'); expect(ago(now - 72 * 3600000, now)).toBe('3 days ago');
  });
});

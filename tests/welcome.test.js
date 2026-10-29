import { describe, it, expect } from 'vitest';
import { isWelcomed, markWelcomed } from '../src/lib/welcome.js';

const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };

describe('the first-visit welcome', () => {
  it('shows until it is dismissed, once per player on a device', () => {
    const s = memory();
    expect(isWelcomed(s, 'Ann')).toBe(false);
    markWelcomed(s, 'Ann');
    expect(isWelcomed(s, 'Ann')).toBe(true);
    expect(isWelcomed(s, 'Bob')).toBe(false);          // another account on the same device still gets it
  });
  it('never breaks when storage is missing or blocked: it just shows again', () => {
    const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(isWelcomed(blocked, 'Ann')).toBe(false); expect(() => markWelcomed(blocked, 'Ann')).not.toThrow();
    expect(isWelcomed(null, 'Ann')).toBe(false); expect(() => markWelcomed(null, 'Ann')).not.toThrow();
  });
});

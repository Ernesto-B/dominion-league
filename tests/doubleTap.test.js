import { describe, expect, it } from 'vitest';
import { isDoubleTapToBlock, DOUBLE_TAP_MS } from '../src/lib/doubleTap.js';

const el = pressable => ({ closest: sel => (pressable ? {} : null) });
const tap = (t, x, y) => ({ t, x, y });

describe('the double-tap guard', () => {
  it('never swallows a fast tap on a button, link or field, even on the same spot', () => {
    expect(isDoubleTapToBlock(tap(0, 100, 100), tap(120, 100, 100), el(true))).toBe(false);
  });
  it('never swallows a fast tap somewhere else (a different button)', () => {
    expect(isDoubleTapToBlock(tap(0, 100, 100), tap(120, 260, 400), el(false))).toBe(false);
  });
  it('only blocks a quick second tap on the same spot of plain content (the double-tap zoom gesture)', () => {
    expect(isDoubleTapToBlock(tap(0, 100, 100), tap(150, 108, 104), el(false))).toBe(true);
    expect(isDoubleTapToBlock(tap(0, 100, 100), tap(DOUBLE_TAP_MS + 1, 100, 100), el(false))).toBe(false);   // too slow to be a double tap
    expect(isDoubleTapToBlock(null, tap(10, 1, 1), el(false))).toBe(false);                                // the first tap
  });
});

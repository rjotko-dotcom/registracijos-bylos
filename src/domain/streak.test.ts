import { describe, expect, it } from 'vitest';
import { computeStreak } from './streak';

const day = (offset: number, h = 10) => {
  const d = new Date(2026, 2, 10 + offset, h);
  return d.toISOString();
};

describe('computeStreak', () => {
  const now = new Date(2026, 2, 10, 12);

  it('counts consecutive days including today', () => {
    expect(computeStreak(now, [day(0), day(-1), day(-2)])).toBe(3);
  });

  it('allows today to be pending (counts from yesterday)', () => {
    expect(computeStreak(now, [day(-1), day(-2)])).toBe(2);
  });

  it('breaks on a gap', () => {
    expect(computeStreak(now, [day(0), day(-2), day(-3)])).toBe(1);
  });

  it('empty history is zero', () => {
    expect(computeStreak(now, [])).toBe(0);
  });
});

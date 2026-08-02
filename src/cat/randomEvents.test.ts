import { describe, expect, it, vi } from 'vitest';
import { RandomEventScheduler } from './randomEvents';

describe('RandomEventScheduler', () => {
  it('respects per-event cooldowns', () => {
    let t = 0;
    const run = vi.fn();
    const s = new RandomEventScheduler([{ id: 'blink', weight: 1, cooldownMs: 10_000, run }], {
      now: () => t,
      random: () => 0.5,
      isHidden: () => false,
    });
    expect(s.tick()).toBe('blink');
    t = 5_000;
    expect(s.tick()).toBeNull(); // still cooling down
    t = 11_000;
    expect(s.tick()).toBe('blink');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not run while hidden', () => {
    const run = vi.fn();
    const s = new RandomEventScheduler([{ id: 'x', weight: 1, cooldownMs: 0, run }], {
      now: () => 0,
      random: () => 0.5,
      isHidden: () => true,
    });
    expect(s.tick()).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it('respects `when` gates', () => {
    const run = vi.fn();
    const s = new RandomEventScheduler([{ id: 'moth', weight: 1, cooldownMs: 0, when: () => false, run }], {
      now: () => 0,
      random: () => 0.5,
      isHidden: () => false,
    });
    expect(s.tick()).toBeNull();
  });

  it('picks by weight deterministically with injected random', () => {
    const a = vi.fn();
    const b = vi.fn();
    const s = new RandomEventScheduler(
      [
        { id: 'a', weight: 1, cooldownMs: 0, run: a },
        { id: 'b', weight: 9, cooldownMs: 0, run: b },
      ],
      { now: () => 0, random: () => 0.95, isHidden: () => false },
    );
    expect(s.tick()).toBe('b');
  });
});

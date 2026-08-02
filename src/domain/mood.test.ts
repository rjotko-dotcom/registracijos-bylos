import { describe, expect, it } from 'vitest';
import { computeMood } from './mood';

const now = new Date(2026, 2, 10, 12, 0);

describe('computeMood', () => {
  it('sleeping reads as sleepy, never unhappy', () => {
    const m = computeMood({ now, lastFedAt: null, overdue: true, caredToday: 0, asleep: true });
    expect(m.key).toBe('sleepy');
    expect(m.score).toBe(4);
  });

  it('an overdue meal is the one thing that lowers it', () => {
    expect(computeMood({ now, lastFedAt: null, overdue: true, caredToday: 0, asleep: false }).key).toBe('hungry');
  });

  it('a fresh meal plus care reaches the top', () => {
    const m = computeMood({
      now,
      lastFedAt: new Date(2026, 2, 10, 11, 15),
      overdue: false,
      caredToday: 2,
      asleep: false,
    });
    expect(m.key).toBe('blissful');
    expect(m.score).toBe(5);
  });

  it('an empty day still reads as content, not sad', () => {
    const m = computeMood({ now, lastFedAt: null, overdue: false, caredToday: 0, asleep: false });
    expect(m.key).toBe('content');
    expect(m.score).toBe(3);
  });

  it('score always stays inside 1..5', () => {
    const m = computeMood({
      now,
      lastFedAt: new Date(2026, 2, 10, 11, 59),
      overdue: false,
      caredToday: 9,
      asleep: false,
    });
    expect(m.score).toBeLessThanOrEqual(5);
    expect(m.score).toBeGreaterThanOrEqual(1);
  });
});

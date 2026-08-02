import { describe, expect, it } from 'vitest';
import { applyXp, canAwardXp, levelFraction, xpForLevel } from './xp';

describe('applyXp', () => {
  it('accumulates within a level', () => {
    const p = applyXp({ level: 1, currentXp: 0, lifetimeXp: 0 }, 30);
    expect(p).toEqual({ level: 1, currentXp: 30, lifetimeXp: 30 });
  });

  it('levels up when threshold crossed', () => {
    const p = applyXp({ level: 1, currentXp: 90, lifetimeXp: 90 }, 20);
    expect(p.level).toBe(2);
    expect(p.currentXp).toBe(10);
  });

  it('handles multiple level-ups at once', () => {
    const p = applyXp({ level: 1, currentXp: 0, lifetimeXp: 0 }, 100 + 150 + 5);
    expect(p.level).toBe(3);
    expect(p.currentXp).toBe(5);
  });

  it('never removes XP (ignores non-positive amounts)', () => {
    const start = { level: 2, currentXp: 50, lifetimeXp: 150 };
    expect(applyXp(start, 0)).toEqual(start);
    expect(applyXp(start, -10)).toEqual(start);
  });

  it('xpForLevel grows with level', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(150);
  });

  it('levelFraction is bounded', () => {
    expect(levelFraction({ level: 1, currentXp: 50, lifetimeXp: 50 })).toBeCloseTo(0.5);
  });
});

describe('canAwardXp (anti-farming)', () => {
  const now = new Date('2026-03-10T12:00:00Z');

  it('blocks within cooldown', () => {
    const events = [{ action: 'pet', at: '2026-03-10T11:55:00Z' }];
    expect(canAwardXp('pet', now, events)).toBe(false);
  });

  it('allows after cooldown', () => {
    const events = [{ action: 'pet', at: '2026-03-10T11:40:00Z' }];
    expect(canAwardXp('pet', now, events)).toBe(true);
  });

  it('enforces daily limit', () => {
    const events = Array.from({ length: 6 }, (_, i) => ({
      action: 'pet',
      at: new Date(Date.UTC(2026, 2, 10, 2 + i)).toISOString(),
    }));
    expect(canAwardXp('pet', now, events)).toBe(false);
  });

  it('ignores other actions', () => {
    const events = [{ action: 'feed', at: '2026-03-10T11:59:00Z' }];
    expect(canAwardXp('pet', now, events)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { classifyTiming, computeNextMeal, findPlannedFor, isQuietTime, nextFixedOccurrence } from './scheduling';
import type { FeedingLog, FeedingSchedule } from './models';

let seq = 0;
function schedule(partial: Partial<FeedingSchedule>): FeedingSchedule {
  return {
    id: `s${seq++}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deviceId: 'test',
    name: 'Meal',
    mode: 'fixed',
    enabled: true,
    ...partial,
  };
}

function log(fedAt: string, partial: Partial<FeedingLog> = {}): FeedingLog {
  return {
    id: `l${seq++}`,
    createdAt: fedAt,
    updatedAt: fedAt,
    deviceId: 'test',
    foodType: 'dry',
    amountGrams: 40,
    fedAt,
    ...partial,
  };
}

// Local-time helper (tests run in the runner's local TZ; scheduling is wall-clock based).
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0);

describe('nextFixedOccurrence', () => {
  it('returns today when time is still ahead', () => {
    const s = schedule({ time: '08:00' });
    const next = nextFixedOccurrence(s, at(2026, 3, 10, 6, 0))!;
    expect(next.getHours()).toBe(8);
    expect(next.getDate()).toBe(10);
  });

  it('rolls to tomorrow after the time has passed (midnight crossing)', () => {
    const s = schedule({ time: '08:00' });
    const next = nextFixedOccurrence(s, at(2026, 3, 10, 9, 0))!;
    expect(next.getDate()).toBe(11);
  });

  it('respects days of week', () => {
    // 2026-03-10 is a Tuesday (day 2). Allow only Fridays (5).
    const s = schedule({ time: '08:00', daysOfWeek: [5] });
    const next = nextFixedOccurrence(s, at(2026, 3, 10, 9, 0))!;
    expect(next.getDay()).toBe(5);
  });
});

describe('computeNextMeal', () => {
  it('picks the earliest of several fixed schedules', () => {
    const s1 = schedule({ time: '08:00' });
    const s2 = schedule({ time: '14:00' });
    const res = computeNextMeal(at(2026, 3, 10, 9, 0), [s1, s2], log(at(2026, 3, 10, 8, 2).toISOString()));
    expect(res.at!.getHours()).toBe(14);
    expect(res.overdue).toBe(false);
  });

  it('marks a missed fixed meal as overdue within the window', () => {
    const s1 = schedule({ time: '08:00' });
    const res = computeNextMeal(at(2026, 3, 10, 8, 40), [s1], log(at(2026, 3, 9, 20, 0).toISOString()));
    expect(res.overdue).toBe(true);
    expect(res.at!.getHours()).toBe(8);
  });

  it('does not mark overdue when the meal was logged near its time', () => {
    const s1 = schedule({ time: '08:00' });
    const res = computeNextMeal(at(2026, 3, 10, 8, 40), [s1], log(at(2026, 3, 10, 7, 55).toISOString()));
    expect(res.overdue).toBe(false);
  });

  it('computes interval next meal from the last feeding', () => {
    const s = schedule({ mode: 'interval', intervalHours: 6 });
    const res = computeNextMeal(at(2026, 3, 10, 12, 0), [s], log(at(2026, 3, 10, 8, 0).toISOString()));
    expect(res.at!.getHours()).toBe(14);
    expect(res.overdue).toBe(false);
  });

  it('interval overdue when past due', () => {
    const s = schedule({ mode: 'interval', intervalHours: 4 });
    const res = computeNextMeal(at(2026, 3, 10, 13, 0), [s], log(at(2026, 3, 10, 8, 0).toISOString()));
    expect(res.overdue).toBe(true);
  });

  it('interval waits for a first meal', () => {
    const s = schedule({ mode: 'interval', intervalHours: 4 });
    const res = computeNextMeal(at(2026, 3, 10, 13, 0), [s], null);
    expect(res.at).toBeNull();
  });

  it('mixed: interval sooner than fixed wins', () => {
    const f = schedule({ time: '20:00' });
    const i = schedule({ mode: 'interval', intervalHours: 3 });
    const res = computeNextMeal(at(2026, 3, 10, 12, 0), [f, i], log(at(2026, 3, 10, 11, 0).toISOString()));
    expect(res.at!.getHours()).toBe(14);
  });

  it('paused interval is ignored', () => {
    const i = schedule({ mode: 'interval', intervalHours: 3, paused: true });
    const res = computeNextMeal(at(2026, 3, 10, 12, 0), [i], log(at(2026, 3, 10, 8, 0).toISOString()));
    expect(res.at).toBeNull();
  });

  it('deleting the latest entry restarts interval from previous meal', () => {
    const i = schedule({ mode: 'interval', intervalHours: 6 });
    // After deletion the "latest" becomes the older log:
    const res = computeNextMeal(at(2026, 3, 10, 12, 0), [i], log(at(2026, 3, 10, 5, 0).toISOString()));
    expect(res.overdue).toBe(true);
    expect(res.at!.getHours()).toBe(11);
  });

  it('editing the latest entry moves the interval due time', () => {
    const i = schedule({ mode: 'interval', intervalHours: 6 });
    const res = computeNextMeal(at(2026, 3, 10, 12, 0), [i], log(at(2026, 3, 10, 10, 0).toISOString()));
    expect(res.at!.getHours()).toBe(16);
    expect(res.overdue).toBe(false);
  });

  it('crosses midnight for late fixed schedules', () => {
    const s = schedule({ time: '23:30' });
    const res = computeNextMeal(at(2026, 3, 10, 23, 45), [s], log(at(2026, 3, 10, 23, 32).toISOString()));
    expect(res.at!.getDate()).toBe(11);
    expect(res.at!.getHours()).toBe(23);
  });
});

describe('classifyTiming', () => {
  const planned = at(2026, 3, 10, 8, 0);
  it('early', () => expect(classifyTiming(planned, at(2026, 3, 10, 7, 30))).toBe('early'));
  it('on time within tolerance', () => expect(classifyTiming(planned, at(2026, 3, 10, 8, 9))).toBe('onTime'));
  it('late', () => expect(classifyTiming(planned, at(2026, 3, 10, 8, 30))).toBe('late'));
  it('unplanned', () => expect(classifyTiming(null, at(2026, 3, 10, 8, 0))).toBe('unplanned'));
});

describe('findPlannedFor', () => {
  it('attaches nearest fixed occurrence', () => {
    const s = schedule({ time: '08:00' });
    const { plannedAt, schedule: sc } = findPlannedFor(at(2026, 3, 10, 8, 20), [s], null);
    expect(plannedAt!.getHours()).toBe(8);
    expect(sc!.id).toBe(s.id);
  });
  it('returns null when nothing is near', () => {
    const s = schedule({ time: '08:00' });
    const { plannedAt } = findPlannedFor(at(2026, 3, 10, 12, 0), [s], null);
    expect(plannedAt).toBeNull();
  });
});

describe('isQuietTime', () => {
  it('handles over-midnight ranges', () => {
    expect(isQuietTime(at(2026, 3, 10, 23, 0), '22:00', '07:00')).toBe(true);
    expect(isQuietTime(at(2026, 3, 10, 6, 0), '22:00', '07:00')).toBe(true);
    expect(isQuietTime(at(2026, 3, 10, 12, 0), '22:00', '07:00')).toBe(false);
  });
  it('handles same-day ranges', () => {
    expect(isQuietTime(at(2026, 3, 10, 13, 0), '12:00', '14:00')).toBe(true);
    expect(isQuietTime(at(2026, 3, 10, 15, 0), '12:00', '14:00')).toBe(false);
  });
});

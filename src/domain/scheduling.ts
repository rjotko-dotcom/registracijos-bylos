// Pure feeding-schedule calculations. All functions take explicit `now`
// so they are deterministic and testable. Local timezone is used for
// fixed "HH:MM" schedules; results are returned as Date objects.

import type { FeedingLog, FeedingSchedule, TimingStatus } from './models';
import { FEEDING } from '../config/constants';

export function parseHHMM(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return { h: h || 0, m: m || 0 };
}

function isActive(s: FeedingSchedule): boolean {
  return s.enabled && !s.deletedAt;
}

/** Next occurrence of a fixed schedule strictly after `from` (local time). */
export function nextFixedOccurrence(s: FeedingSchedule, from: Date): Date | null {
  if (!s.time) return null;
  const { h, m } = parseHHMM(s.time);
  const days = s.daysOfWeek && s.daysOfWeek.length > 0 ? s.daysOfWeek : [0, 1, 2, 3, 4, 5, 6];
  // Search up to 8 days ahead (handles DST shifts because we construct
  // wall-clock local dates rather than adding fixed milliseconds).
  for (let d = 0; d < 8; d++) {
    const cand = new Date(from.getFullYear(), from.getMonth(), from.getDate() + d, h, m, 0, 0);
    if (cand.getTime() > from.getTime() && days.includes(cand.getDay())) return cand;
  }
  return null;
}

/** Most recent occurrence of a fixed schedule at or before `at`. */
export function prevFixedOccurrence(s: FeedingSchedule, at: Date): Date | null {
  if (!s.time) return null;
  const { h, m } = parseHHMM(s.time);
  const days = s.daysOfWeek && s.daysOfWeek.length > 0 ? s.daysOfWeek : [0, 1, 2, 3, 4, 5, 6];
  for (let d = 0; d < 8; d++) {
    const cand = new Date(at.getFullYear(), at.getMonth(), at.getDate() - d, h, m, 0, 0);
    if (cand.getTime() <= at.getTime() && days.includes(cand.getDay())) return cand;
  }
  return null;
}

export interface NextMealResult {
  at: Date | null;
  schedule: FeedingSchedule | null;
  overdue: boolean;
  /** For overdue fixed meals: the missed occurrence time. */
  overdueAt: Date | null;
}

/**
 * Computes the next relevant meal from mixed fixed + interval schedules.
 * - fixed: next wall-clock occurrence (skips occurrences already logged).
 * - interval: lastMeal.fedAt + intervalHours (may be in the past = overdue).
 */
export function computeNextMeal(
  now: Date,
  schedules: FeedingSchedule[],
  lastMeal: FeedingLog | null,
): NextMealResult {
  const active = schedules.filter(isActive);
  let best: { at: Date; schedule: FeedingSchedule } | null = null;
  let overdue = false;
  let overdueAt: Date | null = null;
  let overdueSchedule: FeedingSchedule | null = null;

  for (const s of active) {
    if (s.mode === 'fixed') {
      const next = nextFixedOccurrence(s, now);
      if (next && (!best || next < best.at)) best = { at: next, schedule: s };
      // Overdue: last occurrence within the window and no log at/after it.
      const prev = prevFixedOccurrence(s, now);
      if (prev) {
        const ageMin = (now.getTime() - prev.getTime()) / 60000;
        const logged = lastMeal && new Date(lastMeal.fedAt).getTime() >= prev.getTime() - FEEDING.ON_TIME_TOLERANCE_MIN * 60000;
        if (ageMin <= FEEDING.OVERDUE_WINDOW_MIN && !logged) {
          if (!overdueAt || prev > overdueAt) {
            overdue = true;
            overdueAt = prev;
            overdueSchedule = s;
          }
        }
      }
    } else if (s.mode === 'interval' && !s.paused && s.intervalHours && s.intervalHours > 0) {
      if (!lastMeal) continue; // interval waits for a first logged meal
      const due = new Date(new Date(lastMeal.fedAt).getTime() + s.intervalHours * 3600_000);
      if (due.getTime() <= now.getTime()) {
        overdue = true;
        if (!overdueAt || due > overdueAt) {
          overdueAt = due;
          overdueSchedule = s;
        }
        if (!best || due < best.at) best = { at: due, schedule: s };
      } else if (!best || due < best.at) {
        best = { at: due, schedule: s };
      }
    }
  }

  if (overdue && overdueAt) {
    return { at: overdueAt, schedule: overdueSchedule, overdue: true, overdueAt };
  }
  return { at: best?.at ?? null, schedule: best?.schedule ?? null, overdue: false, overdueAt: null };
}

/** Classifies a feeding against its planned time. */
export function classifyTiming(plannedAt: Date | null, fedAt: Date): TimingStatus {
  if (!plannedAt) return 'unplanned';
  const diffMin = (fedAt.getTime() - plannedAt.getTime()) / 60000;
  if (diffMin < -FEEDING.ON_TIME_TOLERANCE_MIN) return 'early';
  if (diffMin > FEEDING.ON_TIME_TOLERANCE_MIN) return 'late';
  return 'onTime';
}

/**
 * Finds the planned time to attach to a new feeding log: the nearest
 * fixed occurrence within ±90 min, or the interval due time.
 */
export function findPlannedFor(
  fedAt: Date,
  schedules: FeedingSchedule[],
  prevMeal: FeedingLog | null,
): { plannedAt: Date | null; schedule: FeedingSchedule | null } {
  const active = schedules.filter(isActive);
  let best: { at: Date; schedule: FeedingSchedule; dist: number } | null = null;
  for (const s of active) {
    if (s.mode === 'fixed') {
      for (const occ of [prevFixedOccurrence(s, fedAt), nextFixedOccurrence(s, fedAt)]) {
        if (!occ) continue;
        const dist = Math.abs(occ.getTime() - fedAt.getTime());
        if (dist <= 90 * 60000 && (!best || dist < best.dist)) best = { at: occ, schedule: s, dist };
      }
    } else if (s.mode === 'interval' && !s.paused && s.intervalHours && prevMeal) {
      const due = new Date(new Date(prevMeal.fedAt).getTime() + s.intervalHours * 3600_000);
      const dist = Math.abs(due.getTime() - fedAt.getTime());
      if (dist <= 6 * 3600_000 && (!best || dist < best.dist)) best = { at: due, schedule: s, dist };
    }
  }
  return { plannedAt: best?.at ?? null, schedule: best?.schedule ?? null };
}

/** True while `now` falls inside quiet hours (supports over-midnight ranges). */
export function isQuietTime(now: Date, from: string, to: string): boolean {
  const { h: fh, m: fm } = parseHHMM(from);
  const { h: th, m: tm } = parseHHMM(to);
  const cur = now.getHours() * 60 + now.getMinutes();
  const f = fh * 60 + fm;
  const t = th * 60 + tm;
  if (f === t) return false;
  return f < t ? cur >= f && cur < t : cur >= f || cur < t;
}

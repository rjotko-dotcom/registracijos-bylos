// XP / level logic. Positive-only progression: XP is never removed and the
// cat never degrades. Anti-farming via per-action cooldowns + daily limits.

import { LEVEL, XP } from '../config/constants';
import type { LevelProgress, XpEvent } from './models';

export function xpForLevel(level: number): number {
  return LEVEL.xpForLevel(level);
}

/** Applies an XP amount, returning the new progress (handles multi-level-ups). */
export function applyXp(progress: LevelProgress, amount: number): LevelProgress {
  if (amount <= 0) return progress;
  let { level, currentXp } = progress;
  const lifetimeXp = progress.lifetimeXp + amount;
  currentXp += amount;
  while (level < LEVEL.MAX_LEVEL && currentXp >= xpForLevel(level)) {
    currentXp -= xpForLevel(level);
    level += 1;
  }
  if (level >= LEVEL.MAX_LEVEL) currentXp = Math.min(currentXp, xpForLevel(LEVEL.MAX_LEVEL) - 1);
  return { level, currentXp, lifetimeXp };
}

export function xpAmountFor(action: string): number {
  return XP.ACTIONS[action] ?? 0;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Decides whether an XP action may be awarded now, given recent events.
 * Enforces the per-action cooldown and the per-day limit.
 */
export function canAwardXp(action: string, now: Date, recentEvents: Pick<XpEvent, 'action' | 'at'>[]): boolean {
  const cooldown = XP.COOLDOWNS[action] ?? 0;
  const dailyLimit = XP.DAILY_LIMITS[action] ?? 0;
  const mine = recentEvents.filter((e) => e.action === action);
  if (cooldown > 0) {
    const last = mine.reduce<number>((acc, e) => Math.max(acc, new Date(e.at).getTime()), 0);
    if (last && now.getTime() - last < cooldown) return false;
  }
  if (dailyLimit > 0) {
    const today = mine.filter((e) => sameLocalDay(new Date(e.at), now)).length;
    if (today >= dailyLimit) return false;
  }
  return true;
}

/** Progress within the current level, 0..1. */
export function levelFraction(progress: LevelProgress): number {
  const need = xpForLevel(progress.level);
  return need > 0 ? Math.min(1, progress.currentXp / need) : 1;
}

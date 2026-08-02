// Central tuning constants for gestures, XP, animations and reminders.

export const GESTURE = {
  /** Long press threshold before purring starts (ms). */
  LONG_PRESS_MS: 500,
  /** Window in which 5 taps must complete to trigger a meow (ms). */
  TAP_SEQUENCE_WINDOW_MS: 1500,
  /** Taps needed for a meow. */
  MEOW_TAP_COUNT: 5,
  /** Taps for the small double-tap affection reaction. */
  DOUBLE_TAP_COUNT: 2,
  /** Debounce after a recognized meow before a new sequence may start (ms). */
  MEOW_DEBOUNCE_MS: 1200,
} as const;

export const HAPTICS = {
  /** Soft repeating purr rhythm. */
  PURR_PATTERN: [35, 90, 35, 130] as number[],
  /** Repeat period for the purr rhythm (ms). */
  PURR_REPEAT_MS: 320,
  MEOW_PULSE_MS: 30,
} as const;

export const AUDIO = {
  PURR_FADE_OUT_MS: 250,
  PURR_FADE_IN_MS: 200,
} as const;

export const XP = {
  ACTIONS: {
    feed: 15,
    water: 8,
    litter: 10,
    play: 10,
    brush: 8,
    careCustom: 8,
    easterEgg: 20,
    collectible: 25,
    pet: 5,
    doubleTap: 2,
  } as Record<string, number>,
  /** Cooldown per XP action id (ms). */
  COOLDOWNS: {
    pet: 10 * 60 * 1000,
    doubleTap: 5 * 60 * 1000,
    feed: 0,
    water: 60 * 60 * 1000,
    litter: 60 * 60 * 1000,
    play: 30 * 60 * 1000,
    brush: 60 * 60 * 1000,
    careCustom: 30 * 60 * 1000,
    easterEgg: 0,
    collectible: 0,
  } as Record<string, number>,
  /** Max awards per action per local day (0 = unlimited). */
  DAILY_LIMITS: {
    pet: 6,
    doubleTap: 10,
    feed: 8,
    water: 6,
    litter: 4,
    play: 8,
    brush: 4,
    careCustom: 10,
    easterEgg: 0,
    collectible: 0,
  } as Record<string, number>,
} as const;

export const LEVEL = {
  /** XP needed to advance from `level` to `level + 1`. */
  xpForLevel(level: number): number {
    return 100 + (level - 1) * 50;
  },
  MAX_LEVEL: 50,
} as const;

export const RANDOM_EVENTS = {
  FIRST_DELAY_MS: [20_000, 45_000] as [number, number],
  NEXT_DELAY_MS: [30_000, 90_000] as [number, number],
} as const;

export const FEEDING = {
  /** ± minutes counted as "on time" against the planned meal. */
  ON_TIME_TOLERANCE_MIN: 10,
  /** A fixed meal is shown as overdue for this long after its time (min). */
  OVERDUE_WINDOW_MIN: 120,
  /** Undo window for quick actions (ms). */
  UNDO_MS: 6000,
} as const;

export const STREAK = {
  /** Consecutive active days needed for the streak decoration. */
  CARE_STREAK_DAYS: 7,
} as const;

// Weighted random idle-event scheduler with per-event cooldowns.
// Pauses when the document is hidden; timing is injectable for tests.

import { RANDOM_EVENTS } from '../config/constants';

export interface RandomEventDef {
  id: string;
  /** Relative weight (common ~10, uncommon ~4, rare ~1). */
  weight: number;
  /** Minimum ms between two occurrences of this event. */
  cooldownMs: number;
  /** Optional gate, e.g. only at night. */
  when?: () => boolean;
  run: () => void;
}

export interface SchedulerDeps {
  now?: () => number;
  random?: () => number;
  isHidden?: () => boolean;
  frequencyFactor?: () => number; // 1 = normal, >1 = rarer (calm), <1 = livelier
}

export class RandomEventScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastRun = new Map<string, number>();
  private started = false;
  private now: () => number;
  private random: () => number;
  private isHidden: () => boolean;
  private freq: () => number;

  constructor(
    private events: RandomEventDef[],
    deps: SchedulerDeps = {},
  ) {
    this.now = deps.now ?? (() => Date.now());
    this.random = deps.random ?? Math.random;
    this.isHidden = deps.isHidden ?? (() => typeof document !== 'undefined' && document.visibilityState === 'hidden');
    this.freq = deps.frequencyFactor ?? (() => 1);
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.schedule(RANDOM_EVENTS.FIRST_DELAY_MS);
  }

  stop() {
    this.started = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Call on visibilitychange -> visible to resume. */
  resume() {
    if (this.started && !this.timer) this.schedule(RANDOM_EVENTS.NEXT_DELAY_MS);
  }

  /** Call on visibilitychange -> hidden. */
  pause() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Picks an eligible event by weight; returns its id (test-friendly). */
  tick(): string | null {
    if (this.isHidden()) return null;
    const t = this.now();
    const eligible = this.events.filter((e) => {
      const last = this.lastRun.get(e.id);
      if (last !== undefined && t - last < e.cooldownMs) return false;
      if (e.when && !e.when()) return false;
      return true;
    });
    if (eligible.length === 0) return null;
    const total = eligible.reduce((s, e) => s + e.weight, 0);
    let r = this.random() * total;
    for (const e of eligible) {
      r -= e.weight;
      if (r <= 0) {
        this.lastRun.set(e.id, t);
        e.run();
        return e.id;
      }
    }
    return null;
  }

  private schedule([min, max]: readonly [number, number]) {
    const factor = this.freq();
    const delay = (min + this.random() * (max - min)) * factor;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.started) return;
      this.tick();
      this.schedule(RANDOM_EVENTS.NEXT_DELAY_MS);
    }, delay);
  }
}

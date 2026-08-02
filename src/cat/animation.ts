// Cat animation state machine. States are requested with a priority; a
// lower-priority request never interrupts a higher-priority active state.
// Finite states auto-return to idle (or the configured fallback).

export type CatState =
  | 'idle'
  | 'blinking'
  | 'pressed'
  | 'purring'
  | 'meowing'
  | 'yawning'
  | 'sleeping'
  | 'waking'
  | 'sneezing'
  | 'stretching'
  | 'grooming'
  | 'watchingFly'
  | 'pouncingFly'
  | 'playingBall'
  | 'cuddlingPawToy'
  | 'zoomies'
  | 'eating'
  | 'happyAfterMeal'
  | 'waitingForFood'
  | 'overdueMeal';

/** Higher wins. */
export const PRIORITY: Record<CatState, number> = {
  pressed: 100,
  purring: 100,
  meowing: 90,
  eating: 80,
  happyAfterMeal: 75,
  waking: 60,
  cuddlingPawToy: 55,
  playingBall: 55,
  pouncingFly: 50,
  zoomies: 45,
  watchingFly: 40,
  sneezing: 35,
  stretching: 35,
  yawning: 35,
  grooming: 30,
  sleeping: 25,
  blinking: 20,
  overdueMeal: 12,
  waitingForFood: 10,
  idle: 0,
};

/** States that end on their own after `durationMs`. */
const FINITE_DEFAULT_MS: Partial<Record<CatState, number>> = {
  blinking: 220,
  meowing: 850,
  yawning: 1200,
  waking: 800,
  sneezing: 600,
  stretching: 1100,
  grooming: 1600,
  pouncingFly: 700,
  playingBall: 1000,
  zoomies: 900,
  eating: 1400,
  happyAfterMeal: 1200,
};

/** States held until explicitly released (pointer up etc.). */
const HELD_STATES: CatState[] = ['pressed', 'purring', 'cuddlingPawToy', 'watchingFly', 'sleeping', 'waitingForFood', 'overdueMeal'];

export type Unsubscribe = () => void;

export class CatAnimator {
  private state: CatState = 'idle';
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(s: CatState) => void>();
  /** Baseline to return to instead of idle (e.g. sleeping at night). */
  baseline: CatState = 'idle';

  get current(): CatState {
    return this.state;
  }

  subscribe(fn: (s: CatState) => void): Unsubscribe {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn(this.state));
  }

  /**
   * Requests a state. Returns true if accepted.
   * Equal priority replaces (e.g. pressed -> purring).
   */
  request(next: CatState, opts?: { durationMs?: number }): boolean {
    const curPr = PRIORITY[this.state];
    const nextPr = PRIORITY[next];
    if (this.state !== 'idle' && this.state !== this.baseline && nextPr < curPr) return false;
    this.clearTimer();
    this.state = next;
    this.emit();
    const dur = opts?.durationMs ?? FINITE_DEFAULT_MS[next];
    if (dur && !HELD_STATES.includes(next)) {
      this.endTimer = setTimeout(() => this.release(next), dur);
    }
    return true;
  }

  /** Releases a held or finite state back to baseline. */
  release(state?: CatState) {
    if (state && this.state !== state) return;
    this.clearTimer();
    this.state = this.baseline;
    this.emit();
  }

  /** Force-return to baseline regardless of current state. */
  reset() {
    this.clearTimer();
    this.state = this.baseline;
    this.emit();
  }

  private clearTimer() {
    if (this.endTimer) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }
  }
}

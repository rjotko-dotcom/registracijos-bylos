// Coordinated gesture controller for the cat sprite: press / release,
// long-press (purr), tap counting (double-tap affection + five-tap meow).
// Pure logic driven by timestamps — fully unit-testable with fake timers.

import { GESTURE } from '../config/constants';

export interface GestureCallbacks {
  onPressStart: () => void;
  onPressEnd: () => void;
  onLongPressStart: () => void;
  onLongPressEnd: () => void;
  onDoubleTap: () => void;
  onFiveTaps: () => void;
}

export class GestureController {
  private pressedAt: number | null = null;
  private longPressActive = false;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private tapCount = 0;
  private tapWindowTimer: ReturnType<typeof setTimeout> | null = null;
  private firstTapAt = 0;
  private meowLockedUntil = 0;

  constructor(private cb: GestureCallbacks) {}

  pointerDown(now = Date.now()) {
    if (this.pressedAt !== null) return; // ignore multi-touch extra pointers
    this.pressedAt = now;
    this.cb.onPressStart();
    this.longPressTimer = setTimeout(() => {
      this.longPressActive = true;
      // A long press cancels any pending tap sequence.
      this.resetTaps();
      this.cb.onLongPressStart();
    }, GESTURE.LONG_PRESS_MS);
  }

  pointerUp(now = Date.now()) {
    if (this.pressedAt === null) return;
    const wasLong = this.longPressActive;
    this.clearLongPressTimer();
    this.pressedAt = null;
    if (wasLong) {
      this.longPressActive = false;
      this.cb.onLongPressEnd();
      this.cb.onPressEnd();
      return;
    }
    this.cb.onPressEnd();
    this.registerTap(now);
  }

  /** Pointer cancel / leave with capture lost — behave like a safe release. */
  pointerCancel() {
    if (this.pressedAt === null) return;
    const wasLong = this.longPressActive;
    this.clearLongPressTimer();
    this.pressedAt = null;
    this.longPressActive = false;
    if (wasLong) this.cb.onLongPressEnd();
    this.cb.onPressEnd();
    this.resetTaps();
  }

  private registerTap(now: number) {
    if (now < this.meowLockedUntil) return;
    if (this.tapCount === 0) {
      this.firstTapAt = now;
    } else if (now - this.firstTapAt > GESTURE.TAP_SEQUENCE_WINDOW_MS) {
      this.tapCount = 0;
      this.firstTapAt = now;
    }
    this.tapCount += 1;

    if (this.tapCount === GESTURE.DOUBLE_TAP_COUNT) {
      // Fires at tap #2 but does NOT consume the sequence — taps keep
      // counting toward the five-tap meow.
      this.cb.onDoubleTap();
    }
    if (this.tapCount >= GESTURE.MEOW_TAP_COUNT) {
      this.resetTaps();
      this.meowLockedUntil = now + GESTURE.MEOW_DEBOUNCE_MS;
      this.cb.onFiveTaps();
      return;
    }
    if (this.tapWindowTimer) clearTimeout(this.tapWindowTimer);
    this.tapWindowTimer = setTimeout(() => this.resetTaps(), GESTURE.TAP_SEQUENCE_WINDOW_MS);
  }

  private resetTaps() {
    this.tapCount = 0;
    if (this.tapWindowTimer) {
      clearTimeout(this.tapWindowTimer);
      this.tapWindowTimer = null;
    }
  }

  private clearLongPressTimer() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  destroy() {
    this.clearLongPressTimer();
    this.resetTaps();
  }
}

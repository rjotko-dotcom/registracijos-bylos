import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GestureController, type GestureCallbacks } from './gestures';
import { GESTURE } from '../config/constants';

function makeCallbacks(): GestureCallbacks & Record<keyof GestureCallbacks, ReturnType<typeof vi.fn>> {
  return {
    onPressStart: vi.fn(),
    onPressEnd: vi.fn(),
    onLongPressStart: vi.fn(),
    onLongPressEnd: vi.fn(),
    onDoubleTap: vi.fn(),
    onFiveTaps: vi.fn(),
  };
}

describe('GestureController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('press closes eyes immediately and release opens them', () => {
    const cb = makeCallbacks();
    const g = new GestureController(cb);
    g.pointerDown(0);
    expect(cb.onPressStart).toHaveBeenCalledTimes(1);
    g.pointerUp(100);
    expect(cb.onPressEnd).toHaveBeenCalledTimes(1);
    expect(cb.onLongPressStart).not.toHaveBeenCalled();
  });

  it('long press triggers purr after threshold and ends on release', () => {
    const cb = makeCallbacks();
    const g = new GestureController(cb);
    g.pointerDown(0);
    vi.advanceTimersByTime(GESTURE.LONG_PRESS_MS + 10);
    expect(cb.onLongPressStart).toHaveBeenCalledTimes(1);
    g.pointerUp(GESTURE.LONG_PRESS_MS + 50);
    expect(cb.onLongPressEnd).toHaveBeenCalledTimes(1);
  });

  it('short press does not trigger long press', () => {
    const cb = makeCallbacks();
    const g = new GestureController(cb);
    g.pointerDown(0);
    vi.advanceTimersByTime(GESTURE.LONG_PRESS_MS - 100);
    g.pointerUp(GESTURE.LONG_PRESS_MS - 100);
    vi.advanceTimersByTime(1000);
    expect(cb.onLongPressStart).not.toHaveBeenCalled();
  });

  it('five quick taps trigger exactly one meow', () => {
    const cb = makeCallbacks();
    const g = new GestureController(cb);
    for (let i = 0; i < 5; i++) {
      const t = i * 200;
      g.pointerDown(t);
      g.pointerUp(t + 50);
    }
    expect(cb.onFiveTaps).toHaveBeenCalledTimes(1);
  });

  it('taps outside the window do not trigger a meow', () => {
    const cb = makeCallbacks();
    const g = new GestureController(cb);
    for (let i = 0; i < 5; i++) {
      const t = i * 600; // 2.4s total > 1.5s window
      g.pointerDown(t);
      g.pointerUp(t + 50);
      vi.advanceTimersByTime(600);
    }
    expect(cb.onFiveTaps).not.toHaveBeenCalled();
  });

  it('double tap fires without consuming the five-tap sequence', () => {
    const cb = makeCallbacks();
    const g = new GestureController(cb);
    for (let i = 0; i < 5; i++) {
      const t = i * 150;
      g.pointerDown(t);
      g.pointerUp(t + 40);
    }
    expect(cb.onDoubleTap).toHaveBeenCalledTimes(1);
    expect(cb.onFiveTaps).toHaveBeenCalledTimes(1);
  });

  it('long press cancels the tap sequence', () => {
    const cb = makeCallbacks();
    const g = new GestureController(cb);
    // 4 taps...
    for (let i = 0; i < 4; i++) {
      const t = i * 100;
      g.pointerDown(t);
      g.pointerUp(t + 30);
    }
    // ...then a long press
    g.pointerDown(500);
    vi.advanceTimersByTime(GESTURE.LONG_PRESS_MS + 10);
    g.pointerUp(500 + GESTURE.LONG_PRESS_MS + 10);
    // then one more tap: should NOT complete a 5-tap
    g.pointerDown(1200);
    g.pointerUp(1230);
    expect(cb.onFiveTaps).not.toHaveBeenCalled();
  });

  it('meow is debounced', () => {
    const cb = makeCallbacks();
    const g = new GestureController(cb);
    for (let i = 0; i < 5; i++) {
      g.pointerDown(i * 100);
      g.pointerUp(i * 100 + 30);
    }
    // Rapid extra taps immediately after should not start a new sequence.
    for (let i = 0; i < 5; i++) {
      g.pointerDown(600 + i * 100);
      g.pointerUp(600 + i * 100 + 30);
    }
    expect(cb.onFiveTaps).toHaveBeenCalledTimes(1);
  });

  it('pointerCancel resets state safely', () => {
    const cb = makeCallbacks();
    const g = new GestureController(cb);
    g.pointerDown(0);
    vi.advanceTimersByTime(GESTURE.LONG_PRESS_MS + 10);
    g.pointerCancel();
    expect(cb.onLongPressEnd).toHaveBeenCalledTimes(1);
    expect(cb.onPressEnd).toHaveBeenCalledTimes(1);
  });
});

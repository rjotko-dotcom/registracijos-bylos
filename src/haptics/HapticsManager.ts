// HapticsManager — safe navigator.vibrate wrapper. Soft repeating purr
// rhythm via a controlled timer (never an infinite blocking vibration).

import { HAPTICS } from '../config/constants';

class HapticsManagerImpl {
  private enabled = true;
  private purrTimer: number | null = null;

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stopAll();
  }

  private get supported(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  private canVibrate(): boolean {
    return this.supported && this.enabled && typeof document !== 'undefined' && document.visibilityState === 'visible';
  }

  startPurr() {
    if (!this.canVibrate() || this.purrTimer !== null) return;
    const tick = () => {
      if (!this.canVibrate()) {
        this.stopPurr();
        return;
      }
      try {
        navigator.vibrate(HAPTICS.PURR_PATTERN);
      } catch {
        /* unsupported — ignore */
      }
      this.purrTimer = window.setTimeout(tick, HAPTICS.PURR_REPEAT_MS);
    };
    tick();
  }

  stopPurr() {
    if (this.purrTimer !== null) {
      clearTimeout(this.purrTimer);
      this.purrTimer = null;
    }
    if (this.supported) {
      try {
        navigator.vibrate(0);
      } catch {
        /* ignore */
      }
    }
  }

  pulse(ms = HAPTICS.MEOW_PULSE_MS) {
    if (!this.canVibrate()) return;
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }

  stopAll() {
    this.stopPurr();
  }
}

export const HapticsManager = new HapticsManagerImpl();

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') HapticsManager.stopAll();
  });
}

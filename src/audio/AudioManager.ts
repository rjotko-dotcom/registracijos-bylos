// AudioManager — HTMLAudioElement based, with purr fade in/out, meow
// de-duplication and page-hide safety. Files live in src/assets/audio and
// can be replaced with real recordings of Frėja (see docs/ASSETS.md).

import { AUDIO } from '../config/constants';
import purrLoop from '../assets/audio/purr-loop.wav';
import meow1 from '../assets/audio/meow-1.wav';
import meow2 from '../assets/audio/meow-2.wav';
import chirp from '../assets/audio/chirp.wav';
import softPop from '../assets/audio/soft-pop.wav';

export type SoundCategory = 'purr' | 'meow' | 'interaction' | 'reward';

const FILES = {
  purr: [purrLoop],
  meow: [meow1, meow2],
  chirp: [chirp],
  pop: [softPop],
} as const;

export interface SoundPrefs {
  master: boolean;
  purr: boolean;
  meow: boolean;
  ui: boolean;
}

class AudioManagerImpl {
  private prefs: SoundPrefs = { master: true, purr: true, meow: true, ui: true };
  private purrEl: HTMLAudioElement | null = null;
  private fadeTimer: number | null = null;
  private meowPlaying = false;
  private preloaded = false;

  setPrefs(p: SoundPrefs) {
    this.prefs = p;
    if (!p.master || !p.purr) this.stopPurr(true);
  }

  /** Call from the first user gesture so later plays are allowed. */
  preload() {
    if (this.preloaded || typeof Audio === 'undefined') return;
    this.preloaded = true;
    [...FILES.meow, ...FILES.chirp, ...FILES.pop].forEach((src) => {
      const a = new Audio(src);
      a.preload = 'auto';
      a.load();
    });
  }

  private canPlay(cat: SoundCategory): boolean {
    if (typeof Audio === 'undefined' || !this.prefs.master) return false;
    if (cat === 'purr') return this.prefs.purr;
    if (cat === 'meow') return this.prefs.meow;
    return this.prefs.ui;
  }

  startPurr() {
    if (!this.canPlay('purr')) return;
    this.cancelFade();
    if (!this.purrEl) {
      this.purrEl = new Audio(FILES.purr[0]);
      this.purrEl.loop = true;
    }
    const el = this.purrEl;
    el.volume = 0;
    el.play().catch(() => {});
    this.fadeTo(el, 1, AUDIO.PURR_FADE_IN_MS);
  }

  stopPurr(immediate = false) {
    const el = this.purrEl;
    if (!el) return;
    this.cancelFade();
    if (immediate) {
      el.pause();
      el.currentTime = 0;
      return;
    }
    this.fadeTo(el, 0, AUDIO.PURR_FADE_OUT_MS, () => {
      el.pause();
      el.currentTime = 0;
    });
  }

  playMeow() {
    if (!this.canPlay('meow') || this.meowPlaying) return;
    const src = FILES.meow[Math.floor(Math.random() * FILES.meow.length)];
    const a = new Audio(src);
    this.meowPlaying = true;
    a.addEventListener('ended', () => (this.meowPlaying = false));
    a.play().catch(() => (this.meowPlaying = false));
    // Safety: clear the flag even if `ended` never fires.
    window.setTimeout(() => (this.meowPlaying = false), 2000);
  }

  playChirp() {
    if (!this.canPlay('interaction')) return;
    new Audio(FILES.chirp[0]).play().catch(() => {});
  }

  playPop() {
    if (!this.canPlay('interaction')) return;
    new Audio(FILES.pop[0]).play().catch(() => {});
  }

  /** Stop all loops (page hidden / navigation). */
  stopAll() {
    this.stopPurr(true);
  }

  private fadeTo(el: HTMLAudioElement, target: number, ms: number, done?: () => void) {
    this.cancelFade();
    const start = el.volume;
    const t0 = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      el.volume = start + (target - start) * p;
      if (p < 1) this.fadeTimer = window.setTimeout(step, 16);
      else {
        this.fadeTimer = null;
        done?.();
      }
    };
    step();
  }

  private cancelFade() {
    if (this.fadeTimer !== null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
  }
}

export const AudioManager = new AudioManagerImpl();

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') AudioManager.stopAll();
  });
}

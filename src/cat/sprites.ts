// Central sprite/asset mapping. Missing dedicated frames reuse the closest
// supplied frame (documented in docs/ASSETS.md) — replace files there and
// update this map only.

import idle01 from '../assets/freja/idle/freja-idle-01.png';
import pressedClosed from '../assets/freja/pressed/freja-pressed-closed.png';
import purr01 from '../assets/freja/purr/freja-purr-01.png';
import sleep01 from '../assets/freja/sleep/freja-sleep-01.png';
import meow01 from '../assets/freja/meow/freja-meow-01.png';
import meow02 from '../assets/freja/meow/freja-meow-02.png';
import yawn01 from '../assets/freja/yawn/freja-yawn-01.png';

import type { CatState } from './animation';

export interface StateFrames {
  frames: string[];
  /** ms per frame when looping */
  frameMs: number;
  loop: boolean;
}

export const SPRITES: Record<CatState, StateFrames> = {
  idle: { frames: [idle01], frameMs: 1000, loop: true },
  blinking: { frames: [pressedClosed], frameMs: 160, loop: false },
  pressed: { frames: [pressedClosed], frameMs: 1000, loop: true },
  purring: { frames: [purr01, pressedClosed], frameMs: 900, loop: true },
  meowing: { frames: [meow01, meow02, meow01], frameMs: 260, loop: false },
  yawning: { frames: [yawn01], frameMs: 900, loop: false },
  sleeping: { frames: [sleep01], frameMs: 1400, loop: true },
  waking: { frames: [pressedClosed, idle01], frameMs: 350, loop: false },
  sneezing: { frames: [pressedClosed, yawn01, idle01], frameMs: 180, loop: false },
  stretching: { frames: [yawn01, idle01], frameMs: 450, loop: false },
  grooming: { frames: [pressedClosed, idle01, pressedClosed], frameMs: 420, loop: false },
  watchingFly: { frames: [idle01], frameMs: 500, loop: true },
  pouncingFly: { frames: [meow01, idle01], frameMs: 320, loop: false },
  playingBall: { frames: [meow01, idle01, meow01], frameMs: 300, loop: false },
  cuddlingPawToy: { frames: [purr01], frameMs: 1000, loop: true },
  zoomies: { frames: [meow02, idle01, meow02, idle01], frameMs: 180, loop: false },
  eating: { frames: [pressedClosed, idle01, pressedClosed, idle01], frameMs: 280, loop: false },
  happyAfterMeal: { frames: [meow02, purr01], frameMs: 500, loop: false },
  waitingForFood: { frames: [meow01, idle01], frameMs: 700, loop: true },
  overdueMeal: { frames: [meow01, idle01], frameMs: 550, loop: true },
};

/** Frames worth preloading before first paint. */
export const ESSENTIAL_FRAMES = [idle01, pressedClosed, purr01, meow01];
export const LAZY_FRAMES = [sleep01, meow02, yawn01];

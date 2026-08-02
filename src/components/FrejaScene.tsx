// The interactive Frėja scene: sprite state machine, gestures (press /
// long-press purr / five-tap meow / double-tap), random idle events,
// time-of-day tint and all in-room easter eggs.

import { useCallback, useEffect, useRef, useState } from 'react';
import { CatAnimator, type CatState } from '../cat/animation';
import { GestureController, type GestureCallbacks } from '../cat/gestures';
import { RandomEventScheduler, type RandomEventDef } from '../cat/randomEvents';
import { SPRITES, ESSENTIAL_FRAMES, LAZY_FRAMES } from '../cat/sprites';
import { AudioManager } from '../audio/AudioManager';
import { HapticsManager } from '../haptics/HapticsManager';
import { timeOfDay } from '../domain/timeOfDay';
import { useAppStore } from '../state/appStore';
import { useI18n } from '../i18n';
import { catBus } from '../cat/bus';
import { useNow } from '../hooks/useNow';

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
}

let heartSeq = 1;

const BALL_SPOTS = [
  { left: '12%', bottom: '6%' },
  { left: '30%', bottom: '4%' },
  { left: '55%', bottom: '7%' },
  { left: '20%', bottom: '12%' },
];

export function FrejaScene({ overdue }: { overdue: boolean }) {
  const { t } = useI18n();
  const now = useNow(30_000);
  const settings = useAppStore((s) => s.settings);
  const firstInteractionDone = settings?.firstInteractionDone ?? true;
  const updateSettings = useAppStore((s) => s.updateSettings);
  const awardXp = useAppStore((s) => s.awardXp);
  const unlockCollectible = useAppStore((s) => s.unlockCollectible);
  const pushToast = useAppStore((s) => s.pushToast);

  const [catState, setCatState] = useState<CatState>('idle');
  const [frameIdx, setFrameIdx] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [ballSpot, setBallSpot] = useState(0);
  const [fly, setFly] = useState<{ x: number; y: number } | null>(null);
  const [moth, setMoth] = useState(false);
  const [hiddenPaw, setHiddenPaw] = useState(false);
  const [box, setBox] = useState(false);
  const [crown, setCrown] = useState(false);
  const [zooming, setZooming] = useState(false);

  const animator = useRef<CatAnimator | null>(null);
  if (!animator.current) animator.current = new CatAnimator();
  const anim = animator.current;

  const ballTaps = useRef<number[]>([]);
  const plantTaps = useRef<number[]>([]);
  const pawHold = useRef<number | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);

  const tod = timeOfDay(now);
  const unlockedRef = useRef(useAppStore.getState().unlocked);
  useEffect(() => useAppStore.subscribe((s) => (unlockedRef.current = s.unlocked)), []);

  // ---------- animator subscription ----------
  useEffect(() => anim.subscribe((s) => {
    setCatState(s);
    setFrameIdx(0);
  }), [anim]);

  // ---------- frame cycling ----------
  useEffect(() => {
    const def = SPRITES[catState];
    if (def.frames.length <= 1) return;
    const iv = window.setInterval(() => {
      setFrameIdx((i) => {
        const next = i + 1;
        if (next >= def.frames.length) return def.loop ? 0 : i;
        return next;
      });
    }, def.frameMs);
    return () => clearInterval(iv);
  }, [catState]);

  // ---------- preload frames ----------
  useEffect(() => {
    ESSENTIAL_FRAMES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
    const idle = window.setTimeout(() => {
      LAZY_FRAMES.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
    }, 3000);
    return () => clearTimeout(idle);
  }, []);

  const spawnHeart = useCallback((x = 50, y = 40) => {
    const h = { id: heartSeq++, x, y };
    setHearts((hs) => [...hs.slice(-6), h]);
    setTimeout(() => setHearts((hs) => hs.filter((it) => it.id !== h.id)), 1500);
  }, []);

  const markFirstInteraction = useCallback(() => {
    AudioManager.preload();
    if (!firstInteractionDone) void updateSettings({ firstInteractionDone: true });
  }, [firstInteractionDone, updateSettings]);

  // ---------- gestures on the cat ----------
  // The controller must outlive every re-render: it holds the in-flight
  // press and the long-press timer. Rebuilding it mid-gesture would strand
  // the cat with her eyes closed, so the live callbacks go through a ref
  // and the controller itself is created exactly once.
  const handlersRef = useRef<GestureCallbacks>(null as unknown as GestureCallbacks);
  handlersRef.current = {
    onPressStart: () => {
      markFirstInteraction();
      if (anim.current === 'sleeping') {
        anim.reset();
        anim.request('waking');
        return;
      }
      anim.request('pressed');
      setPressed(true);
    },
    onPressEnd: () => {
      setPressed(false);
      anim.release('pressed');
    },
    onLongPressStart: () => {
      anim.request('purring');
      AudioManager.startPurr();
      HapticsManager.startPurr();
      spawnHeart(46 + Math.random() * 10, 36);
      void awardXp('pet', { silent: true });
    },
    onLongPressEnd: () => {
      AudioManager.stopPurr();
      HapticsManager.stopPurr();
      anim.release('purring');
    },
    onDoubleTap: () => {
      spawnHeart(50, 42);
      void awardXp('doubleTap', { silent: true });
    },
    onFiveTaps: () => {
      anim.request('meowing');
      AudioManager.playMeow();
      HapticsManager.pulse();
      spawnHeart(58, 34);
    },
  };

  const gesturesRef = useRef<GestureController | null>(null);
  if (!gesturesRef.current) {
    gesturesRef.current = new GestureController({
      onPressStart: () => handlersRef.current.onPressStart(),
      onPressEnd: () => handlersRef.current.onPressEnd(),
      onLongPressStart: () => handlersRef.current.onLongPressStart(),
      onLongPressEnd: () => handlersRef.current.onLongPressEnd(),
      onDoubleTap: () => handlersRef.current.onDoubleTap(),
      onFiveTaps: () => handlersRef.current.onFiveTaps(),
    });
  }
  const gestures = gesturesRef.current;

  useEffect(() => () => gestures.destroy(), [gestures]);

  // Global safety: stop purr on unmount.
  useEffect(
    () => () => {
      AudioManager.stopPurr(true);
      HapticsManager.stopAll();
    },
    [],
  );

  // ---------- feeding animation via bus ----------
  useEffect(
    () =>
      catBus.on('fed', () => {
        anim.reset();
        anim.request('eating');
        setTimeout(() => {
          anim.request('happyAfterMeal');
          spawnHeart(50, 30);
        }, 1500);
      }),
    [anim, spawnHeart],
  );

  // ---------- overdue meal subtle state ----------
  useEffect(() => {
    if (overdue && anim.current === 'idle') anim.request('overdueMeal');
    if (!overdue && anim.current === 'overdueMeal') anim.release('overdueMeal');
  }, [overdue, anim, catState]);

  // ---------- random idle events ----------
  const freqFactor = useCallback(() => {
    const f = useAppStore.getState().settings?.animationFrequency ?? 'normal';
    if (useAppStore.getState().settings?.reducedMotion) return 2.5;
    return f === 'calm' ? 1.8 : f === 'lively' ? 0.6 : 1;
  }, []);

  useEffect(() => {
    const isNight = () => {
      const td = timeOfDay(new Date());
      return td === 'night' || td === 'evening';
    };
    const events: RandomEventDef[] = [
      { id: 'blink', weight: 10, cooldownMs: 8_000, run: () => anim.request('blinking') },
      { id: 'slowBlink', weight: 5, cooldownMs: 25_000, run: () => anim.request('blinking', { durationMs: 600 }) },
      { id: 'earTwitch', weight: 8, cooldownMs: 15_000, run: () => anim.request('blinking', { durationMs: 150 }) },
      { id: 'headTurn', weight: 7, cooldownMs: 20_000, run: () => anim.request('watchingFly', { durationMs: 900 }) && setTimeout(() => anim.release('watchingFly'), 900) },
      { id: 'yawn', weight: 4, cooldownMs: 60_000, run: () => anim.request('yawning') },
      { id: 'stretch', weight: 4, cooldownMs: 70_000, run: () => anim.request('stretching') },
      { id: 'groom', weight: 4, cooldownMs: 80_000, run: () => anim.request('grooming') },
      { id: 'knead', weight: 3, cooldownMs: 90_000, run: () => anim.request('grooming', { durationMs: 1200 }) },
      {
        id: 'sleep',
        weight: isNight() ? 6 : 2,
        cooldownMs: 150_000,
        run: () => {
          if (anim.request('sleeping')) {
            setTimeout(() => {
              if (anim.current === 'sleeping') {
                anim.reset();
                anim.request('waking');
              }
            }, 25_000 + Math.random() * 30_000);
          }
        },
      },
      { id: 'sneeze', weight: 1, cooldownMs: 240_000, run: () => anim.request('sneezing') },
      {
        id: 'fly',
        weight: 1.5,
        cooldownMs: 180_000,
        run: () => {
          setFly({ x: 15, y: 20 });
          anim.request('watchingFly');
          let steps = 0;
          const iv = setInterval(() => {
            steps += 1;
            setFly({ x: 10 + Math.random() * 75, y: 10 + Math.random() * 35 });
            if (steps >= 6) {
              clearInterval(iv);
              anim.release('watchingFly');
              anim.request('pouncingFly');
              setFly(null);
              void unlockCollectible('flyHunter', 'event').then((fresh) => {
                if (fresh) pushToast({ text: t('events.newCollectible'), kind: 'reward' });
              });
            }
          }, 900);
        },
      },
      {
        id: 'ballPush',
        weight: 3,
        cooldownMs: 100_000,
        run: () => setBallSpot((b) => (b + 1) % BALL_SPOTS.length),
      },
      {
        id: 'pawCuddle',
        weight: 3,
        cooldownMs: 120_000,
        run: () => {
          anim.request('cuddlingPawToy');
          setTimeout(() => anim.release('cuddlingPawToy'), 4000);
        },
      },
      {
        id: 'zoomies',
        weight: 0.7,
        cooldownMs: 300_000,
        run: () => {
          setZooming(true);
          anim.request('zoomies');
          setTimeout(() => setZooming(false), 950);
          void unlockCollectible('zoomies', 'event').then((fresh) => {
            if (fresh) pushToast({ text: t('events.newCollectible'), kind: 'reward' });
          });
        },
      },
      {
        id: 'hiddenPaw',
        weight: 1,
        cooldownMs: 240_000,
        when: () => !unlockedRef.current.some((u) => u.collectibleId === 'hiddenPaw'),
        run: () => {
          setHiddenPaw(true);
          setTimeout(() => setHiddenPaw(false), 12_000);
        },
      },
      {
        id: 'moth',
        weight: 1.2,
        cooldownMs: 240_000,
        when: isNight,
        run: () => {
          setMoth(true);
          setTimeout(() => setMoth(false), 10_000);
        },
      },
      {
        id: 'box',
        weight: 0.5,
        cooldownMs: 420_000,
        run: () => {
          setBox(true);
          setTimeout(() => setBox(false), 15_000);
        },
      },
      {
        id: 'crown',
        weight: 0.25,
        cooldownMs: 600_000,
        run: () => {
          setCrown(true);
          setTimeout(() => setCrown(false), 8000);
          void unlockCollectible('crown', 'event').then((fresh) => {
            if (fresh) pushToast({ text: t('events.newCollectible'), kind: 'reward' });
          });
        },
      },
    ];
    const scheduler = new RandomEventScheduler(events, { frequencyFactor: freqFactor });
    scheduler.start();
    const onVis = () => {
      if (document.visibilityState === 'hidden') scheduler.pause();
      else scheduler.resume();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      scheduler.stop();
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim]);

  // ---------- easter egg handlers ----------
  const onBallTap = (e: React.PointerEvent) => {
    e.stopPropagation();
    markFirstInteraction();
    const nowMs = Date.now();
    ballTaps.current = [...ballTaps.current.filter((tm) => nowMs - tm < 4000), nowMs];
    setBallSpot((b) => (b + 1) % BALL_SPOTS.length);
    AudioManager.playPop();
    anim.request('watchingFly', { durationMs: 700 });
    setTimeout(() => anim.release('watchingFly'), 700);
    if (ballTaps.current.length >= 3) {
      ballTaps.current = [];
      anim.request('playingBall');
      void awardXp('easterEgg', { silent: true });
      void unlockCollectible('yellowBall', 'ball').then((fresh) => {
        if (fresh) pushToast({ text: t('events.newCollectible'), kind: 'reward' });
      });
    }
  };

  const onPawToyDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    markFirstInteraction();
    pawHold.current = window.setTimeout(() => {
      anim.request('cuddlingPawToy');
      spawnHeart(66, 46);
      void unlockCollectible('pinkPaw', 'pawToy').then((fresh) => {
        if (fresh) pushToast({ text: t('events.newCollectible'), kind: 'reward' });
      });
      setTimeout(() => anim.release('cuddlingPawToy'), 3000);
    }, 600);
  };
  const onPawToyUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (pawHold.current) {
      clearTimeout(pawHold.current);
      pawHold.current = null;
    }
  };

  const onHiddenPawTap = (e: React.PointerEvent) => {
    e.stopPropagation();
    setHiddenPaw(false);
    void awardXp('easterEgg', { silent: true });
    void unlockCollectible('hiddenPaw', 'hidden').then((fresh) => {
      if (fresh) pushToast({ text: `${t('events.foundSecret')} 🐾`, kind: 'reward' });
    });
  };

  const onMothTap = (e: React.PointerEvent) => {
    e.stopPropagation();
    setMoth(false);
    void unlockCollectible('nightMoth', 'moth').then((fresh) => {
      if (fresh) pushToast({ text: t('events.newCollectible'), kind: 'reward' });
    });
  };

  const onFlyTap = (e: React.PointerEvent) => {
    e.stopPropagation();
    setFly(null);
    anim.request('pouncingFly');
    void unlockCollectible('flyHunter', 'fly').then((fresh) => {
      if (fresh) pushToast({ text: t('events.newCollectible'), kind: 'reward' });
    });
  };

  const onBoxTap = (e: React.PointerEvent) => {
    e.stopPropagation();
    setBox(false);
    spawnHeart(30, 60);
    void unlockCollectible('box', 'box').then((fresh) => {
      if (fresh) pushToast({ text: t('events.newCollectible'), kind: 'reward' });
    });
  };

  const onPlantTap = (e: React.PointerEvent) => {
    e.stopPropagation();
    const nowMs = Date.now();
    plantTaps.current = [...plantTaps.current.filter((tm) => nowMs - tm < 5000), nowMs];
    if (plantTaps.current.length >= 4) {
      plantTaps.current = [];
      void awardXp('easterEgg', { silent: true });
      void unlockCollectible('plant', 'plant').then((fresh) => {
        if (fresh) pushToast({ text: `${t('events.foundSecret')} 🌱`, kind: 'reward' });
      });
    }
  };

  // ---------- render ----------
  const def = SPRITES[catState];
  const frame = def.frames[Math.min(frameIdx, def.frames.length - 1)];
  const spot = BALL_SPOTS[ballSpot];

  return (
    <div className={`scene ${zooming ? 'zoomies-anim' : ''}`} ref={sceneRef}>
      <div
        className={`press-scale ${pressed ? 'pressed' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={`${t('appName')} — ${t('home.tapHint')}`}
        onPointerDown={(e) => {
          // Capture keeps the release event ours even if the finger slides
          // off the sprite. It throws on some browsers when the pointer is
          // already gone, and must never block the gesture itself.
          try {
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          } catch {
            /* capture unavailable — pointercancel still resets the state */
          }
          gestures.pointerDown();
        }}
        onPointerUp={() => gestures.pointerUp()}
        onPointerCancel={() => gestures.pointerCancel()}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            gestures.pointerDown();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') gestures.pointerUp();
        }}
        style={{ touchAction: 'none' }}
      >
        <img className="cat-frame" src={frame} alt="" draggable={false} />
      </div>

      <div className={`scene-tint tint-${tod}`} />

      {tod === 'night' &&
        [...Array(7)].map((_, i) => (
          <span
            key={i}
            className="pixel-star"
            style={{ left: `${8 + i * 13}%`, top: `${4 + (i % 3) * 6}%`, animationDelay: `${i * 0.4}s` }}
          />
        ))}

      {catState === 'sleeping' && (
        <span className="pixel-zzz overlay-sprite" style={{ left: '30%', top: '18%' }}>
          z Z z
        </span>
      )}

      {crown && <span className="overlay-sprite pixel-crown" style={{ left: '24%', top: '26%' }} />}

      {hearts.map((h) => (
        <span key={h.id} className="overlay-sprite pixel-heart" style={{ left: `${h.x}%`, top: `${h.y}%` }} />
      ))}

      {/* Yellow ball — Frėja's real toy, rests near the front of the bed */}
      <button
        type="button"
        className="overlay-sprite pixel-ball"
        style={{ left: spot.left, bottom: spot.bottom, border: undefined }}
        aria-label="Yellow ball"
        onPointerDown={onBallTap}
      />

      {/* Pink paw plush hotspot (the plush is part of the sprite art) */}
      <button
        type="button"
        className="overlay-sprite"
        style={{ right: '14%', bottom: '22%', width: '26%', height: '22%', background: 'transparent', border: 'none', cursor: 'pointer' }}
        aria-label="Pink paw toy"
        onPointerDown={onPawToyDown}
        onPointerUp={onPawToyUp}
        onPointerCancel={onPawToyUp}
      />

      {/* Secret corner plant hotspot */}
      <button
        type="button"
        className="overlay-sprite"
        style={{ left: 0, top: 0, width: '14%', height: '16%', background: 'transparent', border: 'none' }}
        aria-label="Room corner"
        onPointerDown={onPlantTap}
      />

      {fly && (
        <button
          type="button"
          className="overlay-sprite pixel-fly"
          style={{ left: `${fly.x}%`, top: `${fly.y}%`, transition: 'left 0.85s ease, top 0.85s ease' }}
          aria-label="Fly"
          onPointerDown={onFlyTap}
        />
      )}

      {moth && (
        <button
          type="button"
          className="overlay-sprite pixel-moth"
          style={{ right: '18%', top: '12%' }}
          aria-label="Moth"
          onPointerDown={onMothTap}
        />
      )}

      {hiddenPaw && (
        <button
          type="button"
          className="overlay-sprite pixel-paw"
          style={{ right: '6%', bottom: '8%', background: undefined, border: 'none' }}
          aria-label="Hidden paw"
          onPointerDown={onHiddenPawTap}
        />
      )}

      {box && (
        <button
          type="button"
          className="overlay-sprite pixel-box"
          style={{ left: '4%', bottom: '4%' }}
          aria-label="Cardboard box"
          onPointerDown={onBoxTap}
        />
      )}

      {!firstInteractionDone && <div className="hint">{t('home.tapHint')} 🐾</div>}
    </div>
  );
}

// In-app reminder engine behind an interface. Web PWAs cannot guarantee
// background notifications without a push server; this implementation
// fires Notifications while the app (or installed PWA) is open, and is
// designed to be swapped for a real push/native scheduler later.

import { computeNextMeal, isQuietTime } from '../domain/scheduling';
import type { AppSettings, FeedingLog, FeedingSchedule } from '../domain/models';

export interface ReminderScheduler {
  start(): void;
  stop(): void;
}

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function notificationPermission(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as PermissionState;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return (await Notification.requestPermission()) as PermissionState;
  } catch {
    return 'denied';
  }
}

interface Deps {
  getSchedules: () => FeedingSchedule[];
  getLastMeal: () => FeedingLog | null;
  getSettings: () => AppSettings | null;
  notify: (title: string, body: string) => void;
}

const FIRED_KEY = 'freja.firedReminders';

function loadFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveFired(f: Record<string, number>) {
  try {
    // Prune entries older than 2 days.
    const cutoff = Date.now() - 2 * 86400_000;
    const pruned = Object.fromEntries(Object.entries(f).filter(([, v]) => v > cutoff));
    localStorage.setItem(FIRED_KEY, JSON.stringify(pruned));
  } catch {
    /* ignore */
  }
}

export function createInAppReminderScheduler(deps: Deps): ReminderScheduler {
  let timer: number | null = null;

  const check = () => {
    const settings = deps.getSettings();
    if (!settings?.notificationsEnabled || notificationPermission() !== 'granted') return;
    const now = new Date();
    if (settings.quietHours.enabled && isQuietTime(now, settings.quietHours.from, settings.quietHours.to)) return;

    const next = computeNextMeal(now, deps.getSchedules(), deps.getLastMeal());
    if (!next.at || !next.schedule) return;
    const fired = loadFired();
    const rem = next.schedule.reminder ?? {
      enabled: true,
      minutesBefore: 10,
      atMealTime: true,
      lateDelayMin: 15,
      repeatIntervalMin: 15,
      maxRepeats: 2,
      sound: true,
    };
    if (!rem.enabled) return;

    const mealKey = `${next.schedule.id}:${next.at.toISOString().slice(0, 16)}`;
    const diffMin = (next.at.getTime() - now.getTime()) / 60000;

    const fire = (suffix: string, title: string, body: string) => {
      const key = `${mealKey}:${suffix}`;
      if (fired[key]) return;
      fired[key] = Date.now();
      saveFired(fired);
      deps.notify(title, body);
    };

    if (rem.minutesBefore > 0 && diffMin <= rem.minutesBefore && diffMin > 0) {
      fire('before', 'Frėja 🐾', `Maitinimas po ${Math.ceil(diffMin)} min.`);
    }
    if (rem.atMealTime && diffMin <= 0 && diffMin > -2) {
      fire('at', 'Frėja 🍽', 'Laikas maitinti Frėją!');
    }
    if (next.overdue && diffMin <= -rem.lateDelayMin) {
      const lateMin = -diffMin;
      const repeatIdx = Math.min(rem.maxRepeats, Math.floor((lateMin - rem.lateDelayMin) / Math.max(1, rem.repeatIntervalMin)));
      fire(`late-${repeatIdx}`, 'Frėja 😿', 'Maitinimas vėluoja!');
    }
  };

  return {
    start() {
      if (timer !== null) return;
      check();
      timer = window.setInterval(check, 30_000);
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}

export function showNotification(title: string, body: string) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/pwa/icon-192.png', badge: '/pwa/icon-192.png' });
    }
  } catch {
    /* Some Android browsers require SW notifications; fail silently. */
  }
}

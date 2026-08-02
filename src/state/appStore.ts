// Central Zustand store. Talks only to repository interfaces (never Dexie
// directly), keeps an in-memory mirror for rendering, persists immediately.

import { create } from 'zustand';
import { getRepositories } from '../data/repositories';
import { baseEntity, nowIso } from '../domain/ids';
import type {
  AppSettings,
  CareLog,
  CareTask,
  FeedingLog,
  FeedingSchedule,
  FoodType,
  PetProfile,
  UnlockedCollectible,
  XpEvent,
} from '../domain/models';
import { applyXp, canAwardXp, xpAmountFor } from '../domain/xp';
import { classifyTiming, findPlannedFor } from '../domain/scheduling';
import { computeStreak } from '../domain/streak';
import { COLLECTIBLES } from '../domain/collectibles';
import { STREAK } from '../config/constants';

export interface ToastMsg {
  id: number;
  text: string;
  undo?: () => void;
  kind?: 'success' | 'info' | 'reward';
}

interface AppState {
  ready: boolean;
  dbError: boolean;
  pet: PetProfile | null;
  settings: AppSettings | null;
  schedules: FeedingSchedule[];
  feedingLogs: FeedingLog[];
  careTasks: CareTask[];
  careLogs: CareLog[];
  unlocked: UnlockedCollectible[];
  recentXpEvents: XpEvent[];
  toasts: ToastMsg[];
  streak: number;

  init: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;

  logFeeding: (input: { foodType: FoodType; amountGrams: number; note?: string; fedAt?: Date }) => Promise<FeedingLog | null>;
  updateFeeding: (log: FeedingLog) => Promise<void>;
  deleteFeeding: (id: string) => Promise<void>;

  addSchedule: (s: Omit<FeedingSchedule, keyof ReturnType<typeof baseEntity>>) => Promise<void>;
  updateSchedule: (s: FeedingSchedule) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;

  logCare: (task: CareTask, note?: string, value?: number | null) => Promise<void>;
  deleteCareLog: (id: string) => Promise<void>;
  saveCareTask: (t: CareTask) => Promise<void>;
  addCustomCareTask: (nameLt: string, nameEn: string, icon: string, color: string) => Promise<void>;
  removeCareTask: (id: string) => Promise<void>;

  awardXp: (action: string, opts?: { silent?: boolean }) => Promise<number>;
  unlockCollectible: (collectibleId: string, how: string) => Promise<boolean>;

  pushToast: (t: Omit<ToastMsg, 'id'>) => void;
  dismissToast: (id: number) => void;

  refreshStreak: () => void;
}

let toastSeq = 1;

const DEFAULT_SETTINGS: AppSettings = {
  id: 'settings',
  language: 'lt',
  theme: 'auto',
  soundMaster: true,
  soundPurr: true,
  soundMeow: true,
  soundUi: true,
  haptics: true,
  reducedMotion: false,
  animationFrequency: 'normal',
  timeFormat: '24',
  quietHours: { enabled: false, from: '22:00', to: '07:00' },
  notificationsEnabled: false,
  onboardingDone: false,
  firstInteractionDone: false,
  updatedAt: nowIso(),
};

function defaultCareTasks(): CareTask[] {
  const defs: Array<[string, string, string, string, string]> = [
    ['water', 'Vanduo', 'Water', 'water', 'blue'],
    ['litter', 'Kraikas', 'Litter', 'litter', 'sand'],
    ['play', 'Žaidimas', 'Play', 'play', 'pink'],
    ['brush', 'Šukavimas', 'Brushing', 'brush', 'sage'],
  ];
  return defs.map(([key, lt, en, icon, color], i) => ({
    ...baseEntity(),
    key,
    nameLt: lt,
    nameEn: en,
    icon,
    color,
    enabled: true,
    order: i,
    builtIn: true,
    reminderTime: null,
  }));
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  dbError: false,
  pet: null,
  settings: null,
  schedules: [],
  feedingLogs: [],
  careTasks: [],
  careLogs: [],
  unlocked: [],
  recentXpEvents: [],
  toasts: [],
  streak: 0,

  init: async () => {
    const r = getRepositories();
    try {
      let pet = await r.pets.get();
      if (!pet) {
        pet = { ...baseEntity(), name: 'Frėja', level: 1, currentXp: 0, lifetimeXp: 0 };
        await r.pets.save(pet);
      }
      let settings = await r.settings.get();
      if (!settings) {
        settings = { ...DEFAULT_SETTINGS };
        await r.settings.save(settings);
      }
      let careTasks = await r.care.listTasks();
      if (careTasks.length === 0) {
        careTasks = defaultCareTasks();
        for (const t of careTasks) await r.care.saveTask(t);
      }
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      set({
        ready: true,
        pet,
        settings,
        careTasks,
        schedules: await r.schedules.list(),
        feedingLogs: await r.feeding.list(),
        careLogs: await r.care.listLogs(),
        unlocked: await r.progress.listCollectibles(),
        recentXpEvents: await r.progress.listXpEvents(since),
      });
      get().refreshStreak();
    } catch (e) {
      console.error('DB init failed', e);
      set({ ready: true, dbError: true, settings: { ...DEFAULT_SETTINGS } });
    }
  },

  updateSettings: async (patch) => {
    const cur = get().settings ?? DEFAULT_SETTINGS;
    const next = { ...cur, ...patch, updatedAt: nowIso() };
    set({ settings: next });
    try {
      await getRepositories().settings.save(next);
    } catch (e) {
      console.error(e);
    }
  },

  logFeeding: async ({ foodType, amountGrams, note, fedAt }) => {
    const r = getRepositories();
    const state = get();
    const fedAtDate = fedAt ?? new Date();
    const prevMeal = state.feedingLogs[0] ?? null;
    const { plannedAt, schedule } = findPlannedFor(fedAtDate, state.schedules, prevMeal);
    const log: FeedingLog = {
      ...baseEntity(),
      foodType,
      amountGrams,
      note: note || undefined,
      fedAt: fedAtDate.toISOString(),
      plannedAt: plannedAt ? plannedAt.toISOString() : null,
      scheduleId: schedule?.id ?? null,
      timingStatus: classifyTiming(plannedAt, fedAtDate),
    };
    try {
      await r.feeding.add(log);
      set({ feedingLogs: [log, ...state.feedingLogs].sort((a, b) => b.fedAt.localeCompare(a.fedAt)) });
      await get().awardXp('feed', { silent: true });
      get().refreshStreak();
      return log;
    } catch (e) {
      console.error(e);
      set({ dbError: true });
      return null;
    }
  },

  updateFeeding: async (log) => {
    const r = getRepositories();
    const state = get();
    // Recompute timing after edit.
    const planned = log.plannedAt ? new Date(log.plannedAt) : null;
    const updated: FeedingLog = { ...log, timingStatus: classifyTiming(planned, new Date(log.fedAt)) };
    await r.feeding.update(updated);
    set({
      feedingLogs: state.feedingLogs
        .map((l) => (l.id === updated.id ? updated : l))
        .sort((a, b) => b.fedAt.localeCompare(a.fedAt)),
    });
  },

  deleteFeeding: async (id) => {
    await getRepositories().feeding.remove(id);
    set({ feedingLogs: get().feedingLogs.filter((l) => l.id !== id) });
    get().refreshStreak();
  },

  addSchedule: async (partial) => {
    const s: FeedingSchedule = { ...baseEntity(), ...partial };
    await getRepositories().schedules.add(s);
    set({ schedules: [...get().schedules, s] });
  },

  updateSchedule: async (s) => {
    await getRepositories().schedules.update(s);
    set({ schedules: get().schedules.map((x) => (x.id === s.id ? s : x)) });
  },

  deleteSchedule: async (id) => {
    await getRepositories().schedules.remove(id);
    set({ schedules: get().schedules.filter((s) => s.id !== id) });
  },

  logCare: async (task, note, value) => {
    const log: CareLog = {
      ...baseEntity(),
      taskId: task.id,
      taskKey: task.key,
      note: note || undefined,
      value: value ?? null,
      doneAt: nowIso(),
    };
    await getRepositories().care.addLog(log);
    set({ careLogs: [log, ...get().careLogs] });
    const action = ['water', 'litter', 'play', 'brush'].includes(task.key) ? task.key : 'careCustom';
    await get().awardXp(action, { silent: true });
    get().refreshStreak();
  },

  deleteCareLog: async (id) => {
    await getRepositories().care.removeLog(id);
    set({ careLogs: get().careLogs.filter((l) => l.id !== id) });
  },

  saveCareTask: async (t) => {
    await getRepositories().care.saveTask(t);
    set({ careTasks: get().careTasks.map((x) => (x.id === t.id ? t : x)).sort((a, b) => a.order - b.order) });
  },

  addCustomCareTask: async (nameLt, nameEn, icon, color) => {
    const t: CareTask = {
      ...baseEntity(),
      key: `custom-${Date.now().toString(36)}`,
      nameLt,
      nameEn,
      icon,
      color,
      enabled: true,
      order: get().careTasks.length,
      builtIn: false,
      reminderTime: null,
    };
    await getRepositories().care.saveTask(t);
    set({ careTasks: [...get().careTasks, t] });
  },

  removeCareTask: async (id) => {
    await getRepositories().care.removeTask(id);
    set({ careTasks: get().careTasks.filter((t) => t.id !== id) });
  },

  awardXp: async (action, opts) => {
    const state = get();
    if (!state.pet) return 0;
    const now = new Date();
    if (!canAwardXp(action, now, state.recentXpEvents)) return 0;
    const amount = xpAmountFor(action);
    if (amount <= 0) return 0;
    const r = getRepositories();
    const event: XpEvent = { ...baseEntity(), action, amount, at: now.toISOString() };
    const prevLevel = state.pet.level;
    const progress = applyXp(
      { level: state.pet.level, currentXp: state.pet.currentXp, lifetimeXp: state.pet.lifetimeXp },
      amount,
    );
    const pet: PetProfile = { ...state.pet, ...progress };
    try {
      await r.progress.addXpEvent(event);
      await r.pets.save(pet);
    } catch (e) {
      console.error(e);
    }
    set({ pet, recentXpEvents: [...state.recentXpEvents, event] });
    if (progress.level > prevLevel && !opts?.silent) {
      get().pushToast({ text: `⭐ +${amount} XP`, kind: 'reward' });
    }
    if (progress.level > prevLevel) {
      // Level rewards: collectibles gated by level.
      for (const c of COLLECTIBLES) {
        if (c.levelRequired && progress.level >= c.levelRequired) {
          await get().unlockCollectible(c.id, 'level');
        }
      }
    }
    return amount;
  },

  unlockCollectible: async (collectibleId, how) => {
    const state = get();
    if (state.unlocked.some((u) => u.collectibleId === collectibleId)) return false;
    const u: UnlockedCollectible = { ...baseEntity(), collectibleId, how };
    try {
      await getRepositories().progress.unlock(u);
    } catch (e) {
      console.error(e);
    }
    set({ unlocked: [...state.unlocked, u] });
    await get().awardXp('collectible', { silent: true });
    return true;
  },

  pushToast: (t) => {
    const id = toastSeq++;
    set({ toasts: [...get().toasts, { ...t, id }] });
    setTimeout(() => get().dismissToast(id), 6000);
  },

  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  refreshStreak: () => {
    const { feedingLogs, careLogs } = get();
    const dates = [...feedingLogs.map((l) => l.fedAt), ...careLogs.map((l) => l.doneAt)];
    const streak = computeStreak(new Date(), dates);
    set({ streak });
    if (streak >= STREAK.CARE_STREAK_DAYS) {
      void get().unlockCollectible('streak7', 'streak');
    }
  },
}));

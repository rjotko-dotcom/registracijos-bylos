// Strongly typed domain models. All timestamps are ISO 8601 strings (UTC),
// display uses the local timezone. Base fields are sync-ready: a future
// Firebase/Supabase sync layer can rely on id/updatedAt/deletedAt/deviceId.

export type SyncStatus = 'local' | 'pending' | 'synced';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  deviceId: string;
  syncStatus?: SyncStatus;
}

export interface PetProfile extends BaseEntity {
  name: string;
  level: number;
  currentXp: number;
  lifetimeXp: number;
}

export type FoodType = 'dry' | 'wet' | 'treat' | 'mixed' | 'custom';

export type ScheduleMode = 'fixed' | 'interval';

export interface ReminderSettings {
  enabled: boolean;
  minutesBefore: number; // 0 = only at meal time
  atMealTime: boolean;
  lateDelayMin: number;
  repeatIntervalMin: number;
  maxRepeats: number;
  sound: boolean;
}

export interface FeedingSchedule extends BaseEntity {
  name: string;
  mode: ScheduleMode;
  enabled: boolean;
  /** fixed: "HH:MM" local time */
  time?: string;
  /** fixed: 0 (Sun) .. 6 (Sat); empty/undefined = every day */
  daysOfWeek?: number[];
  /** interval mode */
  intervalHours?: number;
  paused?: boolean;
  foodType?: FoodType;
  reminder?: ReminderSettings;
}

export type TimingStatus = 'early' | 'onTime' | 'late' | 'unplanned';

export interface FeedingLog extends BaseEntity {
  foodType: FoodType;
  amountGrams: number;
  note?: string;
  fedAt: string;
  plannedAt?: string | null;
  scheduleId?: string | null;
  timingStatus?: TimingStatus;
}

export interface CareTask extends BaseEntity {
  key: string; // stable key: water | litter | play | brush | custom-*
  nameLt: string;
  nameEn: string;
  icon: string; // icon key from the pixel icon set
  color: string; // accent token name
  enabled: boolean;
  order: number;
  builtIn: boolean;
  reminderTime?: string | null; // "HH:MM" or null
}

export interface CareLog extends BaseEntity {
  taskId: string;
  taskKey: string;
  note?: string;
  value?: number | null; // e.g. weight in kg
  doneAt: string;
}

export interface UnlockedCollectible extends BaseEntity {
  collectibleId: string;
  how: string; // i18n key describing discovery
}

export interface XpEvent extends BaseEntity {
  action: string;
  amount: number;
  at: string;
}

export interface QuietHours {
  enabled: boolean;
  from: string; // "HH:MM"
  to: string; // "HH:MM"
}

export type ThemeSetting = 'auto' | 'day' | 'night';
export type Language = 'lt' | 'en';

export interface AppSettings {
  id: 'settings';
  language: Language;
  theme: ThemeSetting;
  soundMaster: boolean;
  soundPurr: boolean;
  soundMeow: boolean;
  soundUi: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  animationFrequency: 'calm' | 'normal' | 'lively';
  timeFormat: '12' | '24';
  quietHours: QuietHours;
  notificationsEnabled: boolean;
  onboardingDone: boolean;
  firstInteractionDone: boolean;
  updatedAt: string;
}

export interface LevelProgress {
  level: number;
  currentXp: number;
  lifetimeXp: number;
}

export interface NextMealInfo {
  at: string | null;
  scheduleId: string | null;
  scheduleName: string | null;
  overdue: boolean;
}

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  pet: PetProfile | null;
  settings: AppSettings | null;
  schedules: FeedingSchedule[];
  feedingLogs: FeedingLog[];
  careTasks: CareTask[];
  careLogs: CareLog[];
  collectibles: UnlockedCollectible[];
  xpEvents: XpEvent[];
}

// Repository interfaces — the seam where a future cloud sync layer plugs in.
// A Firebase/Supabase implementation would implement these same interfaces
// (plus a sync queue keyed on updatedAt/deletedAt/deviceId) without any UI
// or domain changes. See docs/SYNC.md.

import type {
  AppSettings,
  CareLog,
  CareTask,
  ExportBundle,
  FeedingLog,
  FeedingSchedule,
  PetProfile,
  UnlockedCollectible,
  XpEvent,
} from '../../domain/models';

export interface PetRepository {
  get(): Promise<PetProfile | null>;
  save(pet: PetProfile): Promise<void>;
}

export interface FeedingRepository {
  list(): Promise<FeedingLog[]>;
  listBetween(fromIso: string, toIso: string): Promise<FeedingLog[]>;
  latest(): Promise<FeedingLog | null>;
  add(log: FeedingLog): Promise<void>;
  update(log: FeedingLog): Promise<void>;
  /** Soft delete (kept for future sync tombstones). */
  remove(id: string): Promise<void>;
}

export interface ScheduleRepository {
  list(): Promise<FeedingSchedule[]>;
  add(s: FeedingSchedule): Promise<void>;
  update(s: FeedingSchedule): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface CareRepository {
  listTasks(): Promise<CareTask[]>;
  saveTask(t: CareTask): Promise<void>;
  removeTask(id: string): Promise<void>;
  listLogs(): Promise<CareLog[]>;
  listLogsBetween(fromIso: string, toIso: string): Promise<CareLog[]>;
  addLog(l: CareLog): Promise<void>;
  removeLog(id: string): Promise<void>;
}

export interface ProgressRepository {
  listCollectibles(): Promise<UnlockedCollectible[]>;
  unlock(c: UnlockedCollectible): Promise<void>;
  listXpEvents(sinceIso: string): Promise<XpEvent[]>;
  addXpEvent(e: XpEvent): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<AppSettings | null>;
  save(s: AppSettings): Promise<void>;
}

export interface DataPorter {
  exportAll(): Promise<ExportBundle>;
  importAll(bundle: ExportBundle): Promise<void>;
  resetAll(): Promise<void>;
}

export interface Repositories {
  pets: PetRepository;
  feeding: FeedingRepository;
  schedules: ScheduleRepository;
  care: CareRepository;
  progress: ProgressRepository;
  settings: SettingsRepository;
  porter: DataPorter;
}

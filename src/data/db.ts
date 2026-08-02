import Dexie, { type Table } from 'dexie';
import type {
  AppSettings,
  CareLog,
  CareTask,
  FeedingLog,
  FeedingSchedule,
  PetProfile,
  UnlockedCollectible,
  XpEvent,
} from '../domain/models';

// IndexedDB schema. UI never touches this directly — only the repository
// implementations in src/data/repositories do.
export class FrejaDB extends Dexie {
  pets!: Table<PetProfile, string>;
  schedules!: Table<FeedingSchedule, string>;
  feedingLogs!: Table<FeedingLog, string>;
  careTasks!: Table<CareTask, string>;
  careLogs!: Table<CareLog, string>;
  collectibles!: Table<UnlockedCollectible, string>;
  xpEvents!: Table<XpEvent, string>;
  settings!: Table<AppSettings, string>;

  constructor(name = 'freja-db') {
    super(name);
    this.version(1).stores({
      pets: 'id',
      schedules: 'id, mode, enabled',
      feedingLogs: 'id, fedAt, scheduleId',
      careTasks: 'id, key, order',
      careLogs: 'id, taskId, taskKey, doneAt',
      collectibles: 'id, collectibleId',
      xpEvents: 'id, action, at',
      settings: 'id',
    });
  }
}

let instance: FrejaDB | null = null;
export function getDb(): FrejaDB {
  if (!instance) instance = new FrejaDB();
  return instance;
}

/** Test hook: swap the singleton (e.g. for fake-indexeddb). */
export function setDb(db: FrejaDB): void {
  instance = db;
}

// IndexedDB (Dexie) implementations of the repository interfaces.

import type { FrejaDB } from '../db';
import { nowIso } from '../../domain/ids';
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
import type {
  CareRepository,
  DataPorter,
  FeedingRepository,
  PetRepository,
  ProgressRepository,
  Repositories,
  ScheduleRepository,
  SettingsRepository,
} from './types';

const alive = <T extends { deletedAt?: string | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

function touch<T extends { updatedAt: string }>(row: T): T {
  return { ...row, updatedAt: nowIso() };
}

class DexiePetRepo implements PetRepository {
  constructor(private db: FrejaDB) {}
  async get() {
    const all = await this.db.pets.toArray();
    return alive(all)[0] ?? null;
  }
  async save(pet: PetProfile) {
    await this.db.pets.put(touch(pet));
  }
}

class DexieFeedingRepo implements FeedingRepository {
  constructor(private db: FrejaDB) {}
  async list() {
    return alive(await this.db.feedingLogs.orderBy('fedAt').reverse().toArray());
  }
  async listBetween(fromIso: string, toIso: string) {
    return alive(await this.db.feedingLogs.where('fedAt').between(fromIso, toIso, true, true).reverse().sortBy('fedAt')).reverse();
  }
  async latest() {
    const rows = alive(await this.db.feedingLogs.orderBy('fedAt').reverse().limit(10).toArray());
    return rows[0] ?? null;
  }
  async add(log: FeedingLog) {
    await this.db.feedingLogs.put(log);
  }
  async update(log: FeedingLog) {
    await this.db.feedingLogs.put(touch(log));
  }
  async remove(id: string) {
    const row = await this.db.feedingLogs.get(id);
    if (row) await this.db.feedingLogs.put(touch({ ...row, deletedAt: nowIso() }));
  }
}

class DexieScheduleRepo implements ScheduleRepository {
  constructor(private db: FrejaDB) {}
  async list() {
    return alive(await this.db.schedules.toArray());
  }
  async add(s: FeedingSchedule) {
    await this.db.schedules.put(s);
  }
  async update(s: FeedingSchedule) {
    await this.db.schedules.put(touch(s));
  }
  async remove(id: string) {
    const row = await this.db.schedules.get(id);
    if (row) await this.db.schedules.put(touch({ ...row, deletedAt: nowIso() }));
  }
}

class DexieCareRepo implements CareRepository {
  constructor(private db: FrejaDB) {}
  async listTasks() {
    return alive(await this.db.careTasks.orderBy('order').toArray());
  }
  async saveTask(t: CareTask) {
    await this.db.careTasks.put(touch(t));
  }
  async removeTask(id: string) {
    const row = await this.db.careTasks.get(id);
    if (row) await this.db.careTasks.put(touch({ ...row, deletedAt: nowIso() }));
  }
  async listLogs() {
    return alive(await this.db.careLogs.orderBy('doneAt').reverse().toArray());
  }
  async listLogsBetween(fromIso: string, toIso: string) {
    return alive(await this.db.careLogs.where('doneAt').between(fromIso, toIso, true, true).toArray());
  }
  async addLog(l: CareLog) {
    await this.db.careLogs.put(l);
  }
  async removeLog(id: string) {
    const row = await this.db.careLogs.get(id);
    if (row) await this.db.careLogs.put(touch({ ...row, deletedAt: nowIso() }));
  }
}

class DexieProgressRepo implements ProgressRepository {
  constructor(private db: FrejaDB) {}
  async listCollectibles() {
    return alive(await this.db.collectibles.toArray());
  }
  async unlock(c: UnlockedCollectible) {
    const existing = await this.db.collectibles.where('collectibleId').equals(c.collectibleId).first();
    if (existing && !existing.deletedAt) return;
    await this.db.collectibles.put(c);
  }
  async listXpEvents(sinceIso: string) {
    return alive(await this.db.xpEvents.where('at').aboveOrEqual(sinceIso).toArray());
  }
  async addXpEvent(e: XpEvent) {
    await this.db.xpEvents.put(e);
  }
}

class DexieSettingsRepo implements SettingsRepository {
  constructor(private db: FrejaDB) {}
  async get() {
    return (await this.db.settings.get('settings')) ?? null;
  }
  async save(s: AppSettings) {
    await this.db.settings.put({ ...s, updatedAt: nowIso() });
  }
}

class DexiePorter implements DataPorter {
  constructor(private db: FrejaDB) {}
  async exportAll(): Promise<ExportBundle> {
    return {
      version: 1,
      exportedAt: nowIso(),
      pet: (await this.db.pets.toArray())[0] ?? null,
      settings: (await this.db.settings.get('settings')) ?? null,
      schedules: await this.db.schedules.toArray(),
      feedingLogs: await this.db.feedingLogs.toArray(),
      careTasks: await this.db.careTasks.toArray(),
      careLogs: await this.db.careLogs.toArray(),
      collectibles: await this.db.collectibles.toArray(),
      xpEvents: await this.db.xpEvents.toArray(),
    };
  }
  async importAll(bundle: ExportBundle) {
    if (!bundle || bundle.version !== 1) throw new Error('unsupported-bundle');
    await this.db.transaction(
      'rw',
      [this.db.pets, this.db.settings, this.db.schedules, this.db.feedingLogs, this.db.careTasks, this.db.careLogs, this.db.collectibles, this.db.xpEvents],
      async () => {
        if (bundle.pet) await this.db.pets.put(bundle.pet);
        if (bundle.settings) await this.db.settings.put(bundle.settings);
        await this.db.schedules.bulkPut(bundle.schedules ?? []);
        await this.db.feedingLogs.bulkPut(bundle.feedingLogs ?? []);
        await this.db.careTasks.bulkPut(bundle.careTasks ?? []);
        await this.db.careLogs.bulkPut(bundle.careLogs ?? []);
        await this.db.collectibles.bulkPut(bundle.collectibles ?? []);
        await this.db.xpEvents.bulkPut(bundle.xpEvents ?? []);
      },
    );
  }
  async resetAll() {
    await this.db.transaction(
      'rw',
      [this.db.pets, this.db.settings, this.db.schedules, this.db.feedingLogs, this.db.careTasks, this.db.careLogs, this.db.collectibles, this.db.xpEvents],
      async () => {
        await Promise.all([
          this.db.pets.clear(),
          this.db.settings.clear(),
          this.db.schedules.clear(),
          this.db.feedingLogs.clear(),
          this.db.careTasks.clear(),
          this.db.careLogs.clear(),
          this.db.collectibles.clear(),
          this.db.xpEvents.clear(),
        ]);
      },
    );
  }
}

export function createDexieRepositories(db: FrejaDB): Repositories {
  return {
    pets: new DexiePetRepo(db),
    feeding: new DexieFeedingRepo(db),
    schedules: new DexieScheduleRepo(db),
    care: new DexieCareRepo(db),
    progress: new DexieProgressRepo(db),
    settings: new DexieSettingsRepo(db),
    porter: new DexiePorter(db),
  };
}

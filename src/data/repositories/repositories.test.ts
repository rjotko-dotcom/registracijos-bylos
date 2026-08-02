import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { FrejaDB } from '../db';
import { createDexieRepositories } from './dexie';
import { baseEntity } from '../../domain/ids';
import type { FeedingLog } from '../../domain/models';

let seq = 0;
function makeDb() {
  return new FrejaDB(`test-db-${Date.now()}-${seq++}`);
}

function log(fedAt: string): FeedingLog {
  return { ...baseEntity(), foodType: 'dry', amountGrams: 40, fedAt };
}

describe('Dexie repositories', () => {
  let repos: ReturnType<typeof createDexieRepositories>;

  beforeEach(() => {
    repos = createDexieRepositories(makeDb());
  });

  it('persists and retrieves feeding logs sorted desc', async () => {
    await repos.feeding.add(log('2026-03-10T08:00:00.000Z'));
    await repos.feeding.add(log('2026-03-10T14:00:00.000Z'));
    const list = await repos.feeding.list();
    expect(list).toHaveLength(2);
    expect(list[0].fedAt > list[1].fedAt).toBe(true);
    const latest = await repos.feeding.latest();
    expect(latest!.fedAt).toBe('2026-03-10T14:00:00.000Z');
  });

  it('soft delete hides entries but keeps tombstones for sync', async () => {
    const l = log('2026-03-10T08:00:00.000Z');
    await repos.feeding.add(l);
    await repos.feeding.remove(l.id);
    expect(await repos.feeding.list()).toHaveLength(0);
    const bundle = await repos.porter.exportAll();
    expect(bundle.feedingLogs).toHaveLength(1);
    expect(bundle.feedingLogs[0].deletedAt).toBeTruthy();
  });

  it('unlock is idempotent per collectible', async () => {
    await repos.progress.unlock({ ...baseEntity(), collectibleId: 'crown', how: 'event' });
    await repos.progress.unlock({ ...baseEntity(), collectibleId: 'crown', how: 'event' });
    expect(await repos.progress.listCollectibles()).toHaveLength(1);
  });

  it('export/import round-trips data', async () => {
    await repos.feeding.add(log('2026-03-10T08:00:00.000Z'));
    await repos.settings.save({
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
      onboardingDone: true,
      firstInteractionDone: true,
      updatedAt: new Date().toISOString(),
    });
    const bundle = await repos.porter.exportAll();

    const repos2 = createDexieRepositories(makeDb());
    await repos2.porter.importAll(bundle);
    expect(await repos2.feeding.list()).toHaveLength(1);
    expect((await repos2.settings.get())!.language).toBe('lt');
  });

  it('rejects unsupported bundles', async () => {
    await expect(repos.porter.importAll({ version: 99 } as never)).rejects.toThrow();
  });

  it('resetAll clears everything', async () => {
    await repos.feeding.add(log('2026-03-10T08:00:00.000Z'));
    await repos.porter.resetAll();
    expect(await repos.feeding.list()).toHaveLength(0);
  });
});

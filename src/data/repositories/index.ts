import { getDb } from '../db';
import { createDexieRepositories } from './dexie';
import type { Repositories } from './types';

let repos: Repositories | null = null;

/** App-wide repository provider. Swap here for a future sync-capable impl. */
export function getRepositories(): Repositories {
  if (!repos) repos = createDexieRepositories(getDb());
  return repos;
}

/** Test hook. */
export function setRepositories(r: Repositories | null): void {
  repos = r;
}

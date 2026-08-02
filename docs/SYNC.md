# Future cloud sync — where it plugs in

The first version is strictly local (IndexedDB). The architecture is
prepared so Google auth + shared household sync can be added without
rewriting the app.

## The seam

UI and domain code depend only on the repository interfaces in
`src/data/repositories/types.ts`:

- `PetRepository`, `FeedingRepository`, `ScheduleRepository`,
  `CareRepository`, `ProgressRepository`, `SettingsRepository`, `DataPorter`

The only place that chooses an implementation is
`src/data/repositories/index.ts` (`getRepositories()`), currently returning
the Dexie implementations from `dexie.ts`.

## Sync-ready data model

Every entity already carries:

- `id` — UUID, safe as a server primary key
- `createdAt` / `updatedAt` — ISO timestamps for last-write-wins merging
- `deletedAt` — soft-delete tombstones (deletes are never physical), so
  deletions replicate correctly
- `deviceId` — origin device, useful for conflict attribution
- `syncStatus` — `'local' | 'pending' | 'synced'` slot for a sync queue

## Adding Firebase/Supabase later

1. Implement the same interfaces in e.g.
   `src/data/repositories/firebase.ts`, wrapping the local Dexie repos
   (offline-first): write locally with `syncStatus: 'pending'`, push in the
   background, mark `'synced'`.
2. Reconcile with `updatedAt` LWW per row; tombstones (`deletedAt`) win over
   edits with older timestamps.
3. Swap the factory in `src/data/repositories/index.ts` behind a feature
   flag or auth state.
4. A shared Frėja profile = one household document owning `petId`; all
   entities already reference stable ids, so scoping them under a household
   collection is additive.
5. Replace the in-app reminder engine (`src/notifications/scheduler.ts`,
   behind the `ReminderScheduler` interface) with a server push scheduler
   (FCM) for reliable background notifications.

No UI or domain changes are required for any of the above.

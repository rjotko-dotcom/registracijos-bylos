// Stable unique ids + device id, suitable for later server sync.

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const DEVICE_KEY = 'freja.deviceId';

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'device-unknown';
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function baseEntity(): { id: string; createdAt: string; updatedAt: string; deviceId: string; syncStatus: 'local' } {
  const t = nowIso();
  return { id: newId(), createdAt: t, updatedAt: t, deviceId: getDeviceId(), syncStatus: 'local' };
}

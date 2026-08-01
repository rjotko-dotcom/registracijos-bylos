import type { RegistrationCase } from './types'
import { sampleCases } from './sampleData'

const STORAGE_KEY = 'registracijos-bylos:v1'

// upgrades entries written by older app versions to the current shape
export function migrate(it: Record<string, unknown>): RegistrationCase {
  const out = { ...it } as unknown as RegistrationCase & {
    techSheetOk?: boolean
    techSheetNeeded?: boolean
  }
  if ('techSheetOk' in out) {
    out.techSheetNeeded = !out.techSheetOk
    delete out.techSheetOk
  }
  if ('techSheetNeeded' in out) {
    out.techSheet = out.techSheetNeeded ? 'needed' : 'none'
    delete out.techSheetNeeded
  }
  if (!out.techSheet) out.techSheet = 'none'
  if (!out.caseType) out.caseType = 'registracija'
  // drop fields from the short-lived extra-tasks experiment
  delete (out as unknown as Record<string, unknown>).apziura
  delete (out as unknown as Record<string, unknown>).tapatybe
  if (out.regitraAt === undefined) {
    out.regitraAt = out.regitraDone ? Date.now() : null
  }
  if (typeof out.reservedAt !== 'string') out.reservedAt = ''
  if (!Array.isArray(out.fleetVehicles)) {
    out.fleetVehicles = out.fleet ? [{ model: out.model, count: out.vehicleCount || 1 }] : []
  }
  return out
}

export function loadCases(): RegistrationCase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const migrated = parsed.map(migrate)
        // production: one-time cleanup of the demo cases seeded by early versions
        return import.meta.env.DEV ? migrated : migrated.filter((it) => !/^s\d{1,2}$/.test(it.id))
      }
    }
  } catch {
    // corrupted storage — fall through to seed data
  }
  // demo data only during development — real installs start empty
  return import.meta.env.DEV ? sampleCases : []
}

export function saveCases(cases: RegistrationCase[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases))
  } catch {
    // storage full or unavailable — data stays in memory
  }
}

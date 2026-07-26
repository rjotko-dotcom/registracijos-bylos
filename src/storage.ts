import type { RegistrationCase } from './types'
import { sampleCases } from './sampleData'

const STORAGE_KEY = 'registracijos-bylos:v1'

// upgrades entries written by older app versions to the current shape
export function migrate(it: Record<string, unknown>): RegistrationCase {
  const out = { ...it } as unknown as RegistrationCase & { techSheetOk?: boolean }
  if ('techSheetOk' in out) {
    out.techSheetNeeded = !out.techSheetOk
    delete out.techSheetOk
  }
  if (out.regitraAt === undefined) {
    out.regitraAt = out.regitraDone ? Date.now() : null
  }
  return out
}

export function loadCases(): RegistrationCase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(migrate)
    }
  } catch {
    // corrupted storage — fall through to seed data
  }
  return sampleCases
}

export function saveCases(cases: RegistrationCase[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases))
  } catch {
    // storage full or unavailable — data stays in memory
  }
}

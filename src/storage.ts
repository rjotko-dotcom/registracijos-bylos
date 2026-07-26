import type { RegistrationCase } from './types'
import { sampleCases } from './sampleData'

const STORAGE_KEY = 'registracijos-bylos:v1'

export function loadCases(): RegistrationCase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        // migrate entries stored before the techSheetOk → techSheetNeeded rename
        return parsed.map((it) =>
          'techSheetOk' in it ? { ...it, techSheetNeeded: !it.techSheetOk, techSheetOk: undefined } : it,
        )
      }
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

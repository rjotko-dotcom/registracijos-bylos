export type Salon = 'L1' | 'L3'
export type TechSheet = 'none' | 'needed' | 'have'
export type CaseType = 'registracija' | 'apziura' | 'tapatybe'

export interface RegistrationCase {
  id: string
  brand: string
  model: string
  vin: string
  regNumber: string
  manager: string
  date: string // ISO yyyy-mm-dd
  salon: Salon
  fleet: boolean
  vehicleCount: number
  caseType: CaseType
  techSheet: TechSheet
  regitraDone: boolean
  regitraAt: number | null // when the documents were left at Regitra
  completed: boolean
  notes: string
  createdAt: number
  completedAt: number | null
}

export type CaseDraft = Omit<RegistrationCase, 'id' | 'createdAt' | 'completedAt' | 'regitraAt'>

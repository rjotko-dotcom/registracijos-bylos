export type Salon = 'L1' | 'L3'
export type TechSheet = 'none' | 'needed' | 'have'
export type CaseType = 'registracija' | 'apziura' | 'tapatybe'
// where the case stands: with me → dropped off → ready to collect
export type Stage = 'take' | 'regitra' | 'pickup'

export interface FleetVehicle {
  model: string
  count: number
}

// a small job attached to one case ("cut a new key blade") — kept on the card
// so it is visible without opening anything
export interface CaseTask {
  id: string
  text: string
  done: boolean
}

export interface RegistrationCase {
  id: string
  brand: string
  model: string
  vin: string
  regNumber: string
  manager: string
  date: string // ISO yyyy-mm-dd
  reservedAt: string // ISO yyyy-mm-dd Regitra reservation, '' = none
  salon: Salon
  fleet: boolean
  vehicleCount: number
  fleetVehicles: FleetVehicle[] // per-model breakdown of a fleet order
  tasks: CaseTask[]
  caseType: CaseType
  techSheet: TechSheet
  stage: Stage
  regitraAt: number | null // when the documents were left at Regitra
  pickupAt: number | null // when Regitra finished and the case became collectable
  completed: boolean
  notes: string
  createdAt: number
  completedAt: number | null
}

export type CaseDraft = Omit<
  RegistrationCase,
  'id' | 'createdAt' | 'completedAt' | 'regitraAt' | 'pickupAt' | 'tasks'
>

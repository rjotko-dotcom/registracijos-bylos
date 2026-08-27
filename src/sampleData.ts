import type { RegistrationCase } from './types'

const DAY = 86_400_000
const NOW = Date.now()

function daysAgo(n: number): string {
  return new Date(NOW - n * DAY).toISOString().slice(0, 10)
}

function c(
  id: string,
  brand: string,
  model: string,
  vin: string,
  regNumber: string,
  manager: string,
  ageDays: number,
  salon: 'L1' | 'L3',
  opts: Partial<RegistrationCase> = {},
): RegistrationCase {
  return {
    id,
    brand,
    model,
    vin,
    regNumber,
    manager,
    date: daysAgo(ageDays),
    reservedAt: '',
    salon,
    fleet: false,
    vehicleCount: 1,
    fleetVehicles: [],
    tasks: [],
    caseType: 'registracija',
    techSheet: 'none',
    stage: 'take',
    regitraAt: null,
    pickupAt: null,
    completed: false,
    notes: '',
    createdAt: NOW - ageDays * DAY,
    completedAt: null,
    ...opts,
  }
}

export const sampleCases: RegistrationCase[] = [
  c('s1', 'Nissan', 'Qashqai', '4EG7', 'MRH468', 'Mantas J.', 0, 'L1'),
  c('s2', 'Hyundai', 'Tucson', '1391', 'DDV589', 'Dovydas P.', 0, 'L1', {
    caseType: 'tapatybe',
  }),
  c('s3', 'Nissan', 'Juke', '7789', 'KGG777', 'Justinas R.', 0, 'L1', {
    techSheet: 'needed',
    notes: 'Trūksta techninio lapo iš serviso.',
  }),
  c('s4', 'Citroen', 'Berlingo x3, Jumpy x2', '6671', 'FLT001', 'Greta P.', 1, 'L3', {
    fleet: true,
    vehicleCount: 5,
    fleetVehicles: [
      { model: 'Berlingo', count: 3 },
      { model: 'Jumpy', count: 2 },
    ],
    notes: 'Fleet užsakymas — dokumentai bendri.',
  }),
  c('s14', 'Nissan', 'Ariya', '9001', 'REZ001', 'Simona L.', 1, 'L1', {
    reservedAt: new Date(NOW + 1 * DAY).toISOString().slice(0, 10),
  }),
  c('s5', 'Nissan', 'X-Trail', '7788', 'KGG778', 'Paulius V.', 4, 'L3', {
    techSheet: 'have',
  }),
  c('s6', 'Hyundai', 'i30', '6655', 'JJJ333', 'Eglė K.', 1, 'L1', {
    caseType: 'apziura',
  }),
  c('s7', 'Hyundai', 'Kona', '9988', 'KNA868', 'Simona L.', 2, 'L3', {
    stage: 'regitra',
    regitraAt: NOW - 1 * DAY,
  }),
  c('s8', 'Citroen', 'C3 Aircross', '3311', 'BBB222', 'Mantas J.', 3, 'L1', {
    stage: 'regitra',
    regitraAt: NOW - 3 * DAY,
  }),
  c('s9', 'Nissan', 'Leaf', '3344', 'EV1004', 'Justinas R.', 6, 'L1', {
    stage: 'regitra',
    regitraAt: NOW - 5 * DAY,
  }),
  c('s10', 'Citroen', 'C5 Aircross', '5566', 'CCC444', 'Greta P.', 5, 'L3', {
    stage: 'regitra',
    regitraAt: NOW - 4 * DAY,
    completed: true,
    completedAt: NOW - 3 * DAY,
  }),
  c('s11', 'Hyundai', 'i20', '8877', 'DDD555', 'Dovydas P.', 6, 'L1', {
    techSheet: 'needed',
    stage: 'regitra',
    regitraAt: NOW - 5 * DAY,
    completed: true,
    completedAt: NOW - 4 * DAY,
  }),
  c('s12', 'Nissan', 'Micra', '2233', 'EEE666', 'Paulius V.', 7, 'L3', {
    stage: 'regitra',
    regitraAt: NOW - 6 * DAY,
    completed: true,
    completedAt: NOW - 5 * DAY,
  }),
  c('s13', 'Toyota', 'Corolla', '4411', 'TOY123', 'Simona L.', 0, 'L1'),
  c('s15', 'Hyundai', 'Bayon', '7712', 'PAI212', 'Mantas J.', 4, 'L1', {
    stage: 'pickup',
    regitraAt: NOW - 3 * DAY,
    pickupAt: NOW - 1 * DAY,
  }),
  c('s16', 'Citroen', 'C4', '4455', 'PAI313', 'Eglė K.', 3, 'L3', {
    stage: 'pickup',
    regitraAt: NOW - 2 * DAY,
    pickupAt: NOW,
  }),
]

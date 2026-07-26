import type { RegistrationCase } from './types'

function c(
  id: string,
  brand: string,
  model: string,
  vin: string,
  regNumber: string,
  manager: string,
  date: string,
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
    date,
    salon,
    fleet: false,
    vehicleCount: 1,
    techSheetNeeded: false,
    regitraDone: false,
    completed: false,
    notes: '',
    createdAt: Date.parse(date),
    completedAt: null,
    ...opts,
  }
}

export const sampleCases: RegistrationCase[] = [
  c('s1', 'Nissan', 'Qashqai', '4EG7', 'MRH468', 'Mantas J.', '2025-06-19', 'L1'),
  c('s2', 'Hyundai', 'Tucson', '1391', 'DDV589', 'Dovydas P.', '2025-06-19', 'L1'),
  c('s3', 'Nissan', 'Juke', '7789', 'KGG777', 'Justinas R.', '2025-06-19', 'L1', {
    techSheetNeeded: true,
    notes: 'Trūksta techninio lapo iš serviso.',
  }),
  c('s4', 'Citroen', 'Berlingo x3, Jumpy x2', '6671', 'FLT001', 'Greta P.', '2025-06-18', 'L3', {
    fleet: true,
    vehicleCount: 5,
    notes: 'Fleet užsakymas — dokumentai bendri.',
  }),
  c('s5', 'Nissan', 'X-Trail', '7788', 'KGG778', 'Paulius V.', '2025-06-18', 'L3'),
  c('s6', 'Hyundai', 'i30', '6655', 'JJJ333', 'Eglė K.', '2025-06-18', 'L1', {
    techSheetNeeded: true,
  }),
  c('s7', 'Hyundai', 'Kona', '9988', 'KNA868', 'Simona L.', '2025-06-17', 'L3', {
    regitraDone: true,
  }),
  c('s8', 'Citroen', 'C3 Aircross', '3311', 'BBB222', 'Mantas J.', '2025-06-17', 'L1', {
    regitraDone: true,
  }),
  c('s9', 'Nissan', 'Leaf', '3344', 'EV1004', 'Justinas R.', '2025-06-16', 'L1'),
  c('s10', 'Citroen', 'C5 Aircross', '5566', 'CCC444', 'Greta P.', '2025-06-15', 'L3', {
    regitraDone: true,
    completed: true,
    completedAt: Date.parse('2025-06-16'),
  }),
  c('s11', 'Hyundai', 'i20', '8877', 'DDD555', 'Dovydas P.', '2025-06-15', 'L1', {
    techSheetNeeded: true,
    regitraDone: true,
    completed: true,
    completedAt: Date.parse('2025-06-16'),
  }),
  c('s12', 'Nissan', 'Micra', '2233', 'EEE666', 'Paulius V.', '2025-06-14', 'L3', {
    regitraDone: true,
    completed: true,
    completedAt: Date.parse('2025-06-15'),
  }),
  c('s13', 'Toyota', 'Corolla', '4411', 'TOY123', 'Simona L.', '2025-06-19', 'L1'),
]

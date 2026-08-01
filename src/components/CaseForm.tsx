import { useState } from 'react'
import type { CaseDraft, CaseType, FleetVehicle, RegistrationCase, Salon, TechSheet } from '../types'
import { Icon } from './Icon'
import { useScrolled } from '../useScrolled'

interface CaseFormProps {
  initial?: RegistrationCase
  managers?: string[]
  onCancel: () => void
  onSubmit: (draft: CaseDraft) => void
}

const BRANDS = ['Nissan', 'Hyundai', 'Citroen']

const BRAND_MODELS: Record<string, string[]> = {
  Nissan: ['Micra', 'Juke', 'Qashqai', 'X-Trail', 'Ariya', 'Leaf', 'Townstar', 'Primastar', 'Interstar'],
  Hyundai: [
    'i10',
    'i20',
    'i30',
    'Bayon',
    'Inster',
    'Kona',
    'Tucson',
    'Santa Fe',
    'Ioniq 5',
    'Ioniq 6',
    'Ioniq 9',
    'Staria',
  ],
  Citroen: [
    'C3',
    'C3 Aircross',
    'C4',
    'C4 X',
    'C5 Aircross',
    'C5 X',
    'Berlingo',
    'SpaceTourer',
    'Jumpy',
    'Jumper',
    'Ami',
  ],
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function CaseForm({ initial, managers = [], onCancel, onSubmit }: CaseFormProps) {
  const [brand, setBrand] = useState(initial?.brand ?? 'Nissan')
  const [model, setModel] = useState(initial?.model ?? '')
  const [vin, setVin] = useState(initial?.vin ?? '')
  const [regNumber, setRegNumber] = useState(initial?.regNumber ?? '')
  const [manager, setManager] = useState(initial?.manager ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [reservedAt, setReservedAt] = useState(initial?.reservedAt ?? '')
  const [salon, setSalon] = useState<Salon>(initial?.salon ?? 'L1')
  const [fleet, setFleet] = useState(initial?.fleet ?? false)
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>(
    initial?.fleetVehicles?.length
      ? initial.fleetVehicles
      : initial?.fleet
        ? [{ model: initial.model, count: initial.vehicleCount || 1 }]
        : [],
  )
  const [caseType, setCaseType] = useState<CaseType>(initial?.caseType ?? 'registracija')
  const [techSheet, setTechSheet] = useState<TechSheet>(initial?.techSheet ?? 'none')
  const [regitraDone, setRegitraDone] = useState(initial?.regitraDone ?? false)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [triedSubmit, setTriedSubmit] = useState(false)
  const scrolled = useScrolled()

  // an older case may carry a brand outside the fixed trio — keep it selectable
  const brandOptions =
    initial?.brand && !BRANDS.includes(initial.brand) ? [...BRANDS, initial.brand] : BRANDS

  const cleanVehicles = fleetVehicles
    .map((v) => ({ model: v.model.trim(), count: Math.max(1, v.count) }))
    .filter((v) => v.model)

  const valid =
    brand.trim() && manager.trim() && date && (fleet ? cleanVehicles.length > 0 : model.trim())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTriedSubmit(true)
    if (!valid) return
    onSubmit({
      brand: brand.trim(),
      model: fleet
        ? cleanVehicles.map((v) => (v.count > 1 ? `${v.model} x${v.count}` : v.model)).join(', ')
        : model.trim(),
      vin: vin.trim().toUpperCase(),
      regNumber: regNumber.trim().toUpperCase(),
      manager: manager.trim(),
      date,
      reservedAt,
      salon,
      fleet,
      vehicleCount: fleet ? cleanVehicles.reduce((sum, v) => sum + v.count, 0) : 1,
      fleetVehicles: fleet ? cleanVehicles : [],
      caseType,
      techSheet: caseType === 'registracija' ? techSheet : 'none',
      regitraDone: caseType === 'registracija' ? regitraDone : false,
      notes: notes.trim(),
      completed: initial?.completed ?? false,
    })
  }

  const setVehicle = (i: number, patch: Partial<FleetVehicle>) =>
    setFleetVehicles((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))

  return (
    <div className="screen form-screen">
      <header className={`app-header${scrolled ? ' scrolled' : ''}`}>
        <button type="button" className="icon-btn header-btn" aria-label="Grįžti" onClick={onCancel}>
          <Icon name="back" size={23} />
        </button>
        <h1 className="header-title">{initial ? 'Redaguoti bylą' : 'Nauja byla'}</h1>
      </header>

      <form className="case-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <span className="field-label">Bylos rūšis</span>
          <div className="segmented" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {(
              [
                ['registracija', 'Registracija'],
                ['apziura', 'Apžiūra'],
                ['tapatybe', 'Tapatybė'],
              ] as [CaseType, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={caseType === value ? `active${value !== 'registracija' ? ' warn-soft' : ''}` : ''}
                onClick={() => setCaseType(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Markė</span>
          <div
            className="segmented"
            style={{ gridTemplateColumns: `repeat(${brandOptions.length}, 1fr)` }}
          >
            {brandOptions.map((b) => (
              <button key={b} type="button" className={brand === b ? 'active' : ''} onClick={() => setBrand(b)}>
                {b}
              </button>
            ))}
          </div>
        </div>

        {!fleet && (
        <div className="field">
          <label htmlFor="f-model">Modelis</label>
          <input
            id="f-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={BRAND_MODELS[brand]?.[2] ?? 'Modelis'}
            autoComplete="off"
            className={triedSubmit && !model.trim() ? 'invalid' : ''}
          />
          {(BRAND_MODELS[brand] ?? []).length > 0 && (
            <div className="chip-row" role="listbox" aria-label={`${brand} modeliai`}>
              {BRAND_MODELS[brand].map((m) => (
                <button
                  key={m}
                  type="button"
                  role="option"
                  aria-selected={model === m}
                  className={`chip${model === m ? ' active' : ''}`}
                  onClick={() => setModel(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        <div className="field">
          <label htmlFor="f-vin">VIN (paskutiniai 4 skaitmenys)</label>
          <input
            id="f-vin"
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            placeholder="4EG7"
            inputMode="text"
            maxLength={17}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>

        <div className="form-grid-2">
          <div className="field">
            <label htmlFor="f-reg">Valst. numeris</label>
            <input
              id="f-reg"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
              placeholder="ABC123"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </div>
          <div className="field">
            <label htmlFor="f-date">Data</label>
            <input id="f-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-reserved">Rezervacija (kada atiduoti)</label>
          <div className="reserved-row">
            <input
              id="f-reserved"
              type="date"
              value={reservedAt}
              onChange={(e) => setReservedAt(e.target.value)}
            />
            {reservedAt && (
              <button
                type="button"
                className="icon-btn fleet-remove"
                aria-label="Išvalyti rezervaciją"
                onClick={() => setReservedAt('')}
              >
                <Icon name="close" size={17} />
              </button>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-manager">Vadybininkas</label>
          <input
            id="f-manager"
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            placeholder="Mantas J."
            autoComplete="off"
            className={triedSubmit && !manager.trim() ? 'invalid' : ''}
          />
          {managers.length > 0 && (
            <div className="chip-row" role="listbox" aria-label="Vadybininkai">
              {managers.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="option"
                  aria-selected={manager === m}
                  className={`chip${manager === m ? ' active' : ''}`}
                  onClick={() => setManager(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <span className="field-label">Salonas</span>
          <div className="segmented">
            {(['L1', 'L3'] as Salon[]).map((s) => (
              <button
                key={s}
                type="button"
                className={salon === s ? 'active' : ''}
                onClick={() => setSalon(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="toggle-row">
          <span className="field-label">Fleet užsakymas</span>
          <button
            type="button"
            role="switch"
            aria-checked={fleet}
            className={`switch${fleet ? ' on' : ''}`}
            onClick={() => {
              const next = !fleet
              setFleet(next)
              if (next && fleetVehicles.length === 0) {
                setFleetVehicles([{ model: model.trim(), count: 1 }])
              }
            }}
          >
            <span className="knob" />
          </button>
        </div>

        {fleet && (
          <div className="field">
            <span className="field-label">
              Automobiliai
              {cleanVehicles.length > 0 &&
                ` · iš viso ${cleanVehicles.reduce((sum, v) => sum + v.count, 0)}`}
            </span>
            {fleetVehicles.map((v, i) => (
              <div className="fleet-row" key={i}>
                <input
                  value={v.model}
                  onChange={(e) => setVehicle(i, { model: e.target.value })}
                  placeholder={BRAND_MODELS[brand]?.[i % (BRAND_MODELS[brand]?.length || 1)] ?? 'Modelis'}
                  autoComplete="off"
                  aria-label={`Modelis ${i + 1}`}
                  className={triedSubmit && cleanVehicles.length === 0 ? 'invalid' : ''}
                />
                <div className="stepper">
                  <button
                    type="button"
                    aria-label="Mažinti"
                    onClick={() => setVehicle(i, { count: Math.max(1, v.count - 1) })}
                  >
                    <Icon name="minus" size={18} />
                  </button>
                  <span className="stepper-value">{v.count}</span>
                  <button type="button" aria-label="Didinti" onClick={() => setVehicle(i, { count: v.count + 1 })}>
                    <Icon name="plus" size={18} />
                  </button>
                </div>
                <button
                  type="button"
                  className="icon-btn fleet-remove"
                  aria-label={`Pašalinti modelį ${i + 1}`}
                  disabled={fleetVehicles.length === 1}
                  onClick={() => setFleetVehicles((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Icon name="close" size={17} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost fleet-add"
              onClick={() => setFleetVehicles((prev) => [...prev, { model: '', count: 1 }])}
            >
              <Icon name="plus" size={17} />
              Pridėti modelį
            </button>
          </div>
        )}

        {caseType === 'registracija' && (
        <div className="field">
          <span className="field-label">Techninis lapas</span>
          <div className="segmented" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {(
              [
                ['none', 'Nereikia'],
                ['needed', 'Reikia'],
                ['have', 'Paimtas'],
              ] as [TechSheet, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={techSheet === value ? `active${value === 'needed' ? ' warn' : value === 'have' ? ' ok' : ''}` : ''}
                onClick={() => setTechSheet(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        )}

        {caseType === 'registracija' && (
        <div className="toggle-row">
          <span className="field-label">Atiduota Regitrai</span>
          <button
            type="button"
            role="switch"
            aria-checked={regitraDone}
            className={`switch${regitraDone ? ' on' : ''}`}
            onClick={() => setRegitraDone(!regitraDone)}
          >
            <span className="knob" />
          </button>
        </div>
        )}

        <div className="field">
          <label htmlFor="f-notes">Pastabos</label>
          <textarea
            id="f-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Papildoma informacija…"
          />
        </div>

        {triedSubmit && !valid && (
          <p className="form-error">
            {fleet
              ? 'Užpildykite markę, bent vieną modelį, vadybininką ir datą.'
              : 'Užpildykite markę, modelį, vadybininką ir datą.'}
          </p>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Atšaukti
          </button>
          <button type="submit" className="btn btn-primary">
            {initial ? 'Išsaugoti' : 'Pridėti bylą'}
          </button>
        </div>
      </form>
    </div>
  )
}

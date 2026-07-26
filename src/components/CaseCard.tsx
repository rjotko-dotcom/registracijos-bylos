import { useEffect, useRef, useState } from 'react'
import type { RegistrationCase } from '../types'
import { BrandLogo } from './BrandLogo'
import { CheckIcon, DocIcon, DocWarnIcon, EditIcon, PaperPlaneIcon } from './Icons'

interface CaseCardProps {
  item: RegistrationCase
  expanded: boolean
  onToggleExpand: (id: string) => void
  onToggleTechSheet: (id: string) => void
  onToggleRegitra: (id: string) => void
  onRequestComplete: (id: string) => void
  onSaveNotes: (id: string, notes: string) => void
  onEdit: (id: string) => void
  onRestore?: (id: string) => void
}

function shortVin(vin: string): string {
  if (vin.length <= 6) return vin
  return '…' + vin.slice(-4)
}

export function CaseCard({
  item,
  expanded,
  onToggleExpand,
  onToggleTechSheet,
  onToggleRegitra,
  onRequestComplete,
  onSaveNotes,
  onEdit,
  onRestore,
}: CaseCardProps) {
  const [noteDraft, setNoteDraft] = useState(item.notes)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!expanded) setNoteDraft(item.notes)
  }, [expanded, item.notes])

  useEffect(() => () => window.clearTimeout(savedTimer.current), [])

  const handleSaveNotes = () => {
    onSaveNotes(item.id, noteDraft.trim())
    setSaved(true)
    window.clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => setSaved(false), 1500)
  }

  return (
    <article className={`case-card${item.completed ? ' is-completed' : ''}`}>
      <div
        className="case-row"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => onToggleExpand(item.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleExpand(item.id)
          }
        }}
      >
        <BrandLogo brand={item.brand} />

        <div className="case-main">
          <div className="case-title-line">
            <span className="case-model">{item.model}</span>
            <span className={`salon-badge salon-${item.salon.toLowerCase()}`}>{item.salon}</span>
          </div>
          <div className="case-sub">
            VIN: {shortVin(item.vin)} <span className="dot">•</span> {item.regNumber}
          </div>
          <div className="case-meta">
            {item.manager} <span className="dot">•</span> {item.date}
          </div>
          {item.fleet && <div className="case-fleet">Fleet ({item.vehicleCount})</div>}
        </div>

        <button
          type="button"
          className={`icon-btn doc-btn ${item.techSheetOk ? 'ok' : 'warn'}`}
          aria-label={item.techSheetOk ? 'Techninis lapas yra' : 'Trūksta techninio lapo'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleTechSheet(item.id)
          }}
        >
          {item.techSheetOk ? <DocIcon /> : <DocWarnIcon />}
        </button>

        <button
          type="button"
          className={`icon-btn action-btn plane-btn${item.regitraDone ? ' active' : ''}`}
          aria-label={item.regitraDone ? 'Dokumentai atiduoti Regitrai' : 'Dokumentai neatiduoti Regitrai'}
          aria-pressed={item.regitraDone}
          onClick={(e) => {
            e.stopPropagation()
            onToggleRegitra(item.id)
          }}
        >
          <PaperPlaneIcon />
        </button>

        <button
          type="button"
          className={`icon-btn action-btn done-btn${item.completed ? ' active' : ''}`}
          aria-label={item.completed ? 'Byla užbaigta' : 'Užbaigti bylą'}
          aria-pressed={item.completed}
          onClick={(e) => {
            e.stopPropagation()
            onRequestComplete(item.id)
          }}
        >
          {item.completed && <CheckIcon />}
        </button>
      </div>

      <div className={`notes-wrap${expanded ? ' open' : ''}`}>
        <div className="notes-inner">
          <div className="notes-details">
            <div className="notes-detail">
              <span className="notes-detail-label">VIN</span>
              <span className="notes-detail-value">{item.vin}</span>
            </div>
            <div className="notes-detail">
              <span className="notes-detail-label">Valst. nr.</span>
              <span className="notes-detail-value">{item.regNumber}</span>
            </div>
            {item.fleet && (
              <div className="notes-detail">
                <span className="notes-detail-label">Automobiliai</span>
                <span className="notes-detail-value">{item.vehicleCount}</span>
              </div>
            )}
          </div>

          <label className="notes-label" htmlFor={`notes-${item.id}`}>
            Pastabos
          </label>
          <textarea
            id={`notes-${item.id}`}
            className="notes-input"
            rows={3}
            placeholder="Įrašykite pastabą…"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
          />

          <div className="notes-actions">
            <button type="button" className="btn btn-ghost" onClick={() => onEdit(item.id)}>
              <EditIcon size={18} />
              Redaguoti
            </button>
            {onRestore && (
              <button type="button" className="btn btn-ghost" onClick={() => onRestore(item.id)}>
                Grąžinti į aktyvias
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={noteDraft.trim() === item.notes}
              onClick={handleSaveNotes}
            >
              {saved ? 'Išsaugota ✓' : 'Išsaugoti'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

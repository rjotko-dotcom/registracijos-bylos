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

const SWIPE_TRIGGER = 88
const SWIPE_MAX = 132

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

  // swipe state — offset drives the row transform, drag suppresses transitions
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const swipe = useRef({ startX: 0, startY: 0, active: false, horizontal: false, fired: false })
  const swipeEnabled = !item.completed && !expanded

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

  const clamp = (dx: number) => {
    const capped = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, dx))
    // rubber-band resistance past the trigger distance
    return Math.abs(capped) > SWIPE_TRIGGER
      ? Math.sign(capped) * (SWIPE_TRIGGER + (Math.abs(capped) - SWIPE_TRIGGER) * 0.4)
      : capped
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!swipeEnabled) return
    if ((e.target as HTMLElement).closest('button')) return
    swipe.current = { startX: e.clientX, startY: e.clientY, active: true, horizontal: false, fired: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current
    if (!s.active || s.fired) return
    const dx = e.clientX - s.startX
    const dy = e.clientY - s.startY
    if (!s.horizontal) {
      if (Math.abs(dx) < 12) return
      if (Math.abs(dx) < Math.abs(dy) * 1.2) {
        s.active = false // vertical scroll wins
        return
      }
      s.horizontal = true
      setDragging(true)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    setOffset(clamp(dx))
  }

  const finishSwipe = (e: React.PointerEvent) => {
    const s = swipe.current
    if (!s.active) return
    if (s.horizontal && !s.fired) {
      const dx = e.clientX - s.startX
      if (dx >= SWIPE_TRIGGER) {
        s.fired = true
        onToggleRegitra(item.id)
      } else if (dx <= -SWIPE_TRIGGER) {
        s.fired = true
        onRequestComplete(item.id)
      }
    }
    s.active = false
    setDragging(false)
    setOffset(0)
  }

  const swipedRight = offset > 12
  const swipedLeft = offset < -12

  return (
    <article className={`case-card${item.completed ? ' is-completed' : ''}`}>
      <div className="swipe-layer" aria-hidden="true">
        <span className={`swipe-hint left${swipedRight ? ' visible' : ''}${offset >= SWIPE_TRIGGER ? ' armed' : ''}`}>
          <PaperPlaneIcon />
        </span>
        <span className={`swipe-hint right${swipedLeft ? ' visible' : ''}${offset <= -SWIPE_TRIGGER ? ' armed' : ''}`}>
          <CheckIcon size={22} />
        </span>
      </div>

      <div
        className={`case-row${dragging ? ' dragging' : ''}`}
        style={offset !== 0 || dragging ? { transform: `translateX(${offset}px)` } : undefined}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => {
          // a click always follows pointerup — swallow it if this gesture was a swipe
          if (swipe.current.horizontal || swipe.current.fired) {
            swipe.current.horizontal = false
            swipe.current.fired = false
            return
          }
          onToggleExpand(item.id)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleExpand(item.id)
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishSwipe}
        onPointerCancel={finishSwipe}
      >
        <BrandLogo brand={item.brand} />

        <div className="case-main">
          <div className="case-title-line">
            <span className="case-model">{item.model}</span>
            <span className={`salon-badge salon-${item.salon.toLowerCase()}`}>{item.salon}</span>
          </div>
          <div className="case-sub">
            VIN: {item.vin || '—'} <span className="dot">•</span> {item.regNumber || '—'}
          </div>
          <div className="case-meta">
            {item.manager} <span className="dot">•</span> {item.date}
          </div>
          {item.fleet && <div className="case-fleet">Fleet ({item.vehicleCount})</div>}
        </div>

        <button
          type="button"
          className={`icon-btn doc-btn ${item.techSheetNeeded ? 'warn' : 'ok'}`}
          aria-label={item.techSheetNeeded ? 'Reikia techninio lapo' : 'Techninis lapas sutvarkytas'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleTechSheet(item.id)
          }}
        >
          {item.techSheetNeeded ? <DocWarnIcon /> : <DocIcon />}
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
              <span className="notes-detail-value">{item.vin || '—'}</span>
            </div>
            <div className="notes-detail">
              <span className="notes-detail-label">Valst. nr.</span>
              <span className="notes-detail-value">{item.regNumber || '—'}</span>
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

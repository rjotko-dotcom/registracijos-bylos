import { useEffect, useRef, useState } from 'react'
import type { RegistrationCase } from '../types'
import { BrandLogo } from './BrandLogo'
import { Icon } from './Icon'

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
  onRequestDelete: (id: string) => void
}

const SWIPE_TRIGGER = 88
const SWIPE_MAX = 144
const DAY = 86_400_000
// right-swipe (Regitra) must be held past the threshold this long before it
// arms — protects against accidental flicks toggling the status
const HOLD_MS = 450

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
  onRequestDelete,
}: CaseCardProps) {
  const [noteDraft, setNoteDraft] = useState(item.notes)
  const [saved, setSaved] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const savedTimer = useRef<number | undefined>(undefined)
  const copyTimer = useRef<number | undefined>(undefined)

  // days the documents have been sitting at Regitra — flag stale cases
  const regitraDays =
    item.regitraDone && !item.completed && item.regitraAt
      ? Math.floor((Date.now() - item.regitraAt) / DAY)
      : 0

  // days the case has been sitting with the registrar, not yet driven anywhere
  const withMeDays =
    !item.completed && !item.regitraDone ? Math.floor((Date.now() - Date.parse(item.date)) / DAY) : 0

  const copyValue = async (field: string, value: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopiedField(field)
    window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopiedField(null), 1400)
  }

  // swipe state — offset drives the row transform, drag suppresses transitions
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [holdArmed, setHoldArmed] = useState(false)
  const swipe = useRef({ startX: 0, startY: 0, active: false, horizontal: false, fired: false, armed: false })
  const holdTimer = useRef<number | undefined>(undefined)
  const swipeEnabled = !item.completed && !expanded

  const clearHold = () => {
    window.clearTimeout(holdTimer.current)
    holdTimer.current = undefined
    if (swipe.current.armed) {
      swipe.current.armed = false
      setHoldArmed(false)
    }
  }

  useEffect(() => () => window.clearTimeout(holdTimer.current), [])

  useEffect(() => {
    if (!expanded) setNoteDraft(item.notes)
  }, [expanded, item.notes])

  useEffect(
    () => () => {
      window.clearTimeout(savedTimer.current)
      window.clearTimeout(copyTimer.current)
    },
    [],
  )

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
      ? Math.sign(capped) * (SWIPE_TRIGGER + (Math.abs(capped) - SWIPE_TRIGGER) * 0.5)
      : capped
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!swipeEnabled) return
    if ((e.target as HTMLElement).closest('button')) return
    swipe.current = { startX: e.clientX, startY: e.clientY, active: true, horizontal: false, fired: false, armed: false }
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

    // arm the Regitra toggle only after the swipe is held past the threshold
    if (dx >= SWIPE_TRIGGER) {
      if (!s.armed && holdTimer.current === undefined) {
        holdTimer.current = window.setTimeout(() => {
          holdTimer.current = undefined
          if (swipe.current.active) {
            swipe.current.armed = true
            setHoldArmed(true)
            navigator.vibrate?.(20)
          }
        }, HOLD_MS)
      }
    } else if (dx < SWIPE_TRIGGER - 12) {
      clearHold()
    }
  }

  const finishSwipe = (e: React.PointerEvent) => {
    const s = swipe.current
    if (!s.active) return
    if (s.horizontal && !s.fired) {
      const dx = e.clientX - s.startX
      if (dx >= SWIPE_TRIGGER && s.armed && item.caseType === 'registracija') {
        s.fired = true
        onToggleRegitra(item.id)
      } else if (dx <= -SWIPE_TRIGGER) {
        s.fired = true
        onRequestComplete(item.id)
      }
    }
    s.active = false
    clearHold()
    setDragging(false)
    setOffset(0)
  }

  const swipedRight = offset > 4
  const swipedLeft = offset < -4

  return (
    <article className={`case-card${item.completed ? ' is-completed' : ''}`} data-flip-id={item.id}>
      <div className="row-zone">
      <div className="swipe-layer" aria-hidden="true">
        {item.caseType === 'registracija' && (
          <span
            className={`swipe-hint left${swipedRight ? ' visible' : ''}${
              holdArmed ? ' armed' : offset >= SWIPE_TRIGGER ? ' waiting' : ''
            }`}
          >
            <Icon name="landmark" size={20} />
          </span>
        )}
        <span className={`swipe-hint right${swipedLeft ? ' visible' : ''}${offset <= -SWIPE_TRIGGER ? ' armed' : ''}`}>
          <Icon name="check" size={20} strokeWidth={2.4} />
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
            {item.caseType !== 'registracija' && (
              <span className={`type-badge type-${item.caseType}`}>
                <Icon name={item.caseType === 'apziura' ? 'wrench' : 'idCard'} size={11} strokeWidth={2.4} />
                {item.caseType === 'apziura' ? 'Apžiūra' : 'Tapatybė'}
              </span>
            )}
          </div>
          <div className="case-sub">
            VIN: {item.vin || '—'} <span className="dot">•</span> {item.regNumber || '—'}
          </div>
          <div className="case-meta">
            {item.manager} <span className="dot">•</span> {item.date}
          </div>
          {item.fleet && <div className="case-fleet">Fleet ({item.vehicleCount})</div>}
          {item.completed && item.completedAt && (
            <div className="case-done">
              <Icon name="check" size={12} strokeWidth={2.6} />
              Užbaigta {new Date(item.completedAt).toISOString().slice(5, 10)}
            </div>
          )}
          {regitraDays >= 2 && (
            <div className={`case-age${regitraDays >= 5 ? ' late' : ''}`}>
              <Icon name="clock" size={12} strokeWidth={2.2} />
              Regitroje {regitraDays} d.
            </div>
          )}
          {withMeDays >= 3 && (
            <div className={`case-age${withMeDays >= 6 ? ' late' : ''}`}>
              <Icon name="clock" size={12} strokeWidth={2.2} />
              Pas tave {withMeDays} d.
            </div>
          )}
        </div>

        {item.caseType === 'registracija' && (
        <button
          type="button"
          className={`icon-btn doc-btn ${
            item.techSheet === 'needed' ? 'warn' : item.techSheet === 'have' ? 'ok' : 'off'
          }`}
          disabled={item.techSheet === 'none'}
          aria-label={
            item.techSheet === 'needed'
              ? 'Reikia techninio lapo — paliesk, kai paimsi'
              : item.techSheet === 'have'
                ? 'Techninis lapas paimtas'
                : 'Techninio lapo nereikia'
          }
          onClick={(e) => {
            e.stopPropagation()
            onToggleTechSheet(item.id)
          }}
        >
          <Icon
            name={item.techSheet === 'needed' ? 'fileWarn' : item.techSheet === 'have' ? 'fileCheck' : 'fileOff'}
            size={21}
          />
        </button>
        )}

        {item.caseType === 'registracija' && (
          <span
            className={`regitra-status${item.regitraDone ? ' active' : ''}`}
            role="img"
            aria-label={item.regitraDone ? 'Palikta Regitroje' : 'Nepalikta Regitroje'}
          >
            <Icon name="landmark" size={21} />
          </span>
        )}
      </div>

      </div>

      {item.notes && !expanded && (
        <div className="note-strip" onClick={() => onToggleExpand(item.id)}>
          <Icon name="note" size={14} strokeWidth={2} />
          <span className="note-strip-text">{item.notes}</span>
        </div>
      )}

      <div className={`notes-wrap${expanded ? ' open' : ''}`}>
        <div className="notes-inner">
          <div className="notes-details">
            <div className="notes-detail">
              <span className="notes-detail-label">VIN</span>
              <button
                type="button"
                className="notes-detail-value copyable"
                onClick={() => copyValue('vin', item.vin)}
                aria-label="Kopijuoti VIN"
              >
                {copiedField === 'vin' ? 'Nukopijuota ✓' : item.vin || '—'}
                {item.vin && copiedField !== 'vin' && <Icon name="copy" size={13} />}
              </button>
            </div>
            <div className="notes-detail">
              <span className="notes-detail-label">Valst. nr.</span>
              <button
                type="button"
                className="notes-detail-value copyable"
                onClick={() => copyValue('reg', item.regNumber)}
                aria-label="Kopijuoti valstybinį numerį"
              >
                {copiedField === 'reg' ? 'Nukopijuota ✓' : item.regNumber || '—'}
                {item.regNumber && copiedField !== 'reg' && <Icon name="copy" size={13} />}
              </button>
            </div>
            <div className="notes-detail">
              <span className="notes-detail-label">Data</span>
              <span className="notes-detail-value">{item.date}</span>
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
              <Icon name="edit" size={17} />
              Redaguoti
            </button>
            <button
              type="button"
              className="btn btn-ghost danger"
              aria-label="Ištrinti bylą"
              onClick={() => onRequestDelete(item.id)}
            >
              <Icon name="trash" size={17} />
            </button>
            {onRestore && (
              <button type="button" className="btn btn-ghost" onClick={() => onRestore(item.id)}>
                <Icon name="restore" size={17} />
                Grąžinti
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

import { useState } from 'react'
import type { RegistrationCase } from '../types'
import { Icon } from './Icon'

interface BulkCompleteDialogProps {
  items: RegistrationCase[]
  onConfirm: (ids: string[]) => void
  onCancel: () => void
}

// closing a whole trip's worth of collected cases at once — everything is ticked
// by default, so the common "I picked up all of them" case is one tap
export function BulkCompleteDialog({ items, onConfirm, onCancel }: BulkCompleteDialogProps) {
  const [selected, setSelected] = useState<string[]>(() => items.map((it) => it.id))

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog-sheet"
        role="alertdialog"
        aria-modal="true"
        aria-label="Užbaigti paimtas bylas"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="dialog-title">Užbaigti paimtas bylas?</h2>
        <p className="dialog-message">Nuimk varnelę nuo tų, kurių dar nepaėmei.</p>

        <div className="bulk-list">
          {items.map((it) => {
            const on = selected.includes(it.id)
            return (
              <button
                key={it.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                className={`bulk-item${on ? ' on' : ''}`}
                onClick={() => toggle(it.id)}
              >
                <span className="bulk-check">{on && <Icon name="check" size={15} strokeWidth={2.8} />}</span>
                <span className="bulk-text">
                  <span className="bulk-model">{it.model}</span>
                  <span className="bulk-sub">
                    {it.regNumber || it.vin || 'be numerio'} · {it.manager}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Atšaukti
          </button>
          <button
            type="button"
            className="btn btn-success"
            disabled={selected.length === 0}
            onClick={() => onConfirm(selected)}
          >
            Užbaigti ({selected.length})
          </button>
        </div>
      </div>
    </div>
  )
}

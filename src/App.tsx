import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CaseDraft, RegistrationCase } from './types'
import { loadCases, migrate, saveCases } from './storage'
import { CaseCard } from './components/CaseCard'
import { CaseForm } from './components/CaseForm'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Icon } from './components/Icon'
import { useScrolled } from './useScrolled'

type View = 'active' | 'archive'

// FLIP: when cards jump between sections (or reorder), animate them from
// their previous position to the new one instead of teleporting
function useFlipAnimations(deps: unknown[]) {
  const positions = useRef(new Map<string, DOMRect>())
  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cards = document.querySelectorAll<HTMLElement>('[data-flip-id]')
    const next = new Map<string, DOMRect>()
    cards.forEach((el) => {
      const id = el.dataset.flipId
      if (!id) return
      const rect = el.getBoundingClientRect()
      next.set(id, rect)
      const old = positions.current.get(id)
      if (!reduce && old) {
        const dx = old.left - rect.left
        const dy = old.top - rect.top
        if (Math.abs(dx) + Math.abs(dy) > 6) {
          el.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
            { duration: 340, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
          )
        }
      }
    })
    positions.current = next
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

function bylosWord(n: number): string {
  const last = n % 10
  const teens = n % 100 >= 11 && n % 100 <= 19
  if (last === 1 && !teens) return 'byla'
  if (last >= 2 && last <= 9 && !teens) return 'bylos'
  return 'bylų'
}

function matchesQuery(item: RegistrationCase, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    item.model.toLowerCase().includes(q) ||
    item.brand.toLowerCase().includes(q) ||
    item.vin.toLowerCase().includes(q) ||
    item.regNumber.toLowerCase().includes(q) ||
    item.manager.toLowerCase().includes(q) ||
    item.notes.toLowerCase().includes(q)
  )
}

export default function App() {
  const [cases, setCases] = useState<RegistrationCase[]>(loadCases)
  const [view, setView] = useState<View>('active')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [groupByManager, setGroupByManager] = useState(() => localStorage.getItem('rb:groupBy') === '1')
  const [undoId, setUndoId] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<RegistrationCase[] | null>(null)
  const [dataMsg, setDataMsg] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrolled = useScrolled()
  const [today, setToday] = useState(() => new Date().toDateString())

  useEffect(() => {
    const refresh = () => setToday(new Date().toDateString())
    const timer = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  const undoTimer = useRef<number | undefined>(undefined)
  const dataMsgTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    saveCases(cases)
  }, [cases])

  useEffect(() => {
    localStorage.setItem('rb:groupBy', groupByManager ? '1' : '0')
  }, [groupByManager])

  useEffect(
    () => () => {
      window.clearTimeout(undoTimer.current)
      window.clearTimeout(dataMsgTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const toTakeCount = useMemo(
    () => cases.filter((it) => !it.completed && !it.regitraDone).length,
    [cases],
  )
  const atRegitraCount = useMemo(
    () => cases.filter((it) => !it.completed && it.regitraDone).length,
    [cases],
  )

  const todayLabel = useMemo(() => {
    const d = new Date()
    const weekday = d.toLocaleDateString('lt-LT', { weekday: 'long' })
    const monthDay = d.toLocaleDateString('lt-LT', { month: 'long', day: 'numeric' })
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${monthDay}`
  }, [today])

  const visible = useMemo(() => {
    const inView = cases.filter((it) => (view === 'active' ? !it.completed : it.completed))
    const filtered = searchOpen ? inView.filter((it) => matchesQuery(it, query)) : inView
    return [...filtered].sort((a, b) =>
      view === 'active'
        ? b.date.localeCompare(a.date) || b.createdAt - a.createdAt
        : (b.completedAt ?? 0) - (a.completedAt ?? 0),
    )
  }, [cases, view, searchOpen, query])

  useFlipAnimations([cases, view, groupByManager, searchOpen, query])

  const update = (id: string, patch: Partial<RegistrationCase>) =>
    setCases((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  const handleToggleExpand = (id: string) => setExpandedId((cur) => (cur === id ? null : id))
  const handleToggleTechSheet = (id: string) =>
    setCases((prev) =>
      prev.map((it) =>
        it.id === id && it.techSheet !== 'none'
          ? { ...it, techSheet: it.techSheet === 'needed' ? 'have' : 'needed' }
          : it,
      ),
    )
  const handleToggleRegitra = (id: string) =>
    setCases((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, regitraDone: !it.regitraDone, regitraAt: it.regitraDone ? null : Date.now() }
          : it,
      ),
    )

  const handleRequestComplete = (id: string) => {
    const item = cases.find((it) => it.id === id)
    if (!item) return
    if (item.completed) {
      update(id, { completed: false, completedAt: null })
    } else {
      setConfirmId(id)
    }
  }

  const handleConfirmComplete = () => {
    if (confirmId) {
      update(confirmId, { completed: true, completedAt: Date.now() })
      navigator.vibrate?.(30)
      setExpandedId(null)
      setUndoId(confirmId)
      window.clearTimeout(undoTimer.current)
      undoTimer.current = window.setTimeout(() => setUndoId(null), 6000)
    }
    setConfirmId(null)
  }

  const handleUndoComplete = () => {
    if (undoId) update(undoId, { completed: false, completedAt: null })
    window.clearTimeout(undoTimer.current)
    setUndoId(null)
  }

  const handleRestore = (id: string) => {
    update(id, { completed: false, completedAt: null })
    setExpandedId(null)
  }

  const handleEdit = (id: string) => {
    setEditingId(id)
    setFormOpen(true)
  }

  const handleSubmitForm = (draft: CaseDraft) => {
    const now = Date.now()
    if (editingId) {
      const prev = cases.find((it) => it.id === editingId)
      const regitraAt = draft.regitraDone ? (prev?.regitraDone ? (prev.regitraAt ?? now) : now) : null
      update(editingId, { ...draft, regitraAt })
    } else {
      setCases((prev) => [
        {
          ...draft,
          id: `c${now.toString(36)}`,
          createdAt: now,
          completedAt: null,
          regitraAt: draft.regitraDone ? now : null,
        },
        ...prev,
      ])
    }
    setFormOpen(false)
    setEditingId(null)
  }

  const showDataMsg = (msg: string) => {
    setDataMsg(msg)
    window.clearTimeout(dataMsgTimer.current)
    dataMsgTimer.current = window.setTimeout(() => setDataMsg(''), 4000)
  }

  const handleExport = async () => {
    const json = JSON.stringify(cases, null, 2)
    const stamp = new Date().toISOString().slice(0, 10)
    let copied = false
    try {
      await navigator.clipboard.writeText(json)
      copied = true
    } catch {
      // clipboard unavailable — the download below still works
    }
    try {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `registracijos-bylos-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      showDataMsg(copied ? 'Failas atsisiųstas ir nukopijuota į iškarpinę.' : 'Failas atsisiųstas.')
    } catch {
      showDataMsg(copied ? 'Nukopijuota į iškarpinę.' : 'Nepavyko eksportuoti.')
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (!Array.isArray(parsed) || !parsed.every((it) => it && typeof it === 'object' && 'id' in it)) {
          throw new Error('bad shape')
        }
        setPendingImport(parsed.map(migrate))
      } catch {
        showDataMsg('Netinkamas failas — importuoti nepavyko.')
      }
    }
    reader.readAsText(file)
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setQuery('')
  }

  const editingItem = editingId ? cases.find((it) => it.id === editingId) : undefined
  const confirmItem = confirmId ? cases.find((it) => it.id === confirmId) : undefined

  if (formOpen) {
    return (
      <CaseForm
        initial={editingItem}
        onCancel={() => {
          setFormOpen(false)
          setEditingId(null)
        }}
        onSubmit={handleSubmitForm}
      />
    )
  }

  return (
    <div className="screen">
      <header className={`app-header${scrolled ? ' scrolled' : ''}`}>
        {searchOpen ? (
          <div className="search-bar">
            <Icon name="search" size={19} className="search-bar-icon" />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Modelis, VIN, numeris, pastaba…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <button type="button" className="icon-btn header-btn" aria-label="Uždaryti paiešką" onClick={closeSearch}>
              <Icon name="close" size={21} />
            </button>
          </div>
        ) : (
          <>
            {view === 'archive' ? (
              <button
                type="button"
                className="icon-btn header-btn"
                aria-label="Grįžti į aktyvias bylas"
                onClick={() => {
                  setView('active')
                  setExpandedId(null)
                }}
              >
                <Icon name="back" size={23} />
              </button>
            ) : null}
            {view === 'active' ? (
              <div className="header-summary">
                <span className="header-date">{todayLabel}</span>
                <span className="header-counts">
                  Vežti <strong className="c-take">{toTakeCount}</strong>{' '}
                  <span className="dot">·</span> Regitroje{' '}
                  <strong className="c-reg">{atRegitraCount}</strong>
                </span>
              </div>
            ) : (
              <h1 className="header-title">Archyvas</h1>
            )}
            <div className="header-actions">
              {view === 'active' && (
                <button
                  type="button"
                  className="icon-btn header-btn"
                  aria-label="Archyvas"
                  onClick={() => {
                    setView('archive')
                    setExpandedId(null)
                  }}
                >
                  <Icon name="archive" size={20} />
                </button>
              )}
              <button
                type="button"
                className="icon-btn header-btn"
                aria-label="Paieška"
                onClick={() => setSearchOpen(true)}
              >
                <Icon name="search" size={20} />
              </button>
              {view === 'active' && (
                <button
                  type="button"
                  className="icon-btn header-btn accent"
                  aria-label="Nauja byla"
                  onClick={() => {
                    setEditingId(null)
                    setFormOpen(true)
                  }}
                >
                  <Icon name="plus" size={22} strokeWidth={2.2} />
                </button>
              )}
            </div>
          </>
        )}
      </header>

      {(() => {
        const searching = searchOpen && query.trim() !== ''
        const renderCard = (item: RegistrationCase) => (
          <CaseCard
            key={item.id}
            item={item}
            expanded={expandedId === item.id}
            onToggleExpand={handleToggleExpand}
            onToggleTechSheet={handleToggleTechSheet}
            onToggleRegitra={handleToggleRegitra}
            onRequestComplete={handleRequestComplete}
            onSaveNotes={(id, notes) => update(id, { notes })}
            onEdit={handleEdit}
            onRestore={view === 'archive' ? handleRestore : undefined}
          />
        )

        if (searching || view === 'archive') {
          return (
            <>
              <p className="list-caption">
                {searching
                  ? `Rasta: ${visible.length} ${bylosWord(visible.length)}`
                  : `Archyve: ${visible.length} ${bylosWord(visible.length)}`}
              </p>
              <main className="case-list">
                {visible.length === 0 && (
                  <div className="empty-state">
                    <Icon name={searching ? 'search' : 'archive'} size={30} strokeWidth={1.6} />
                    <p>{searching ? 'Nieko nerasta.' : 'Archyvas tuščias.'}</p>
                  </div>
                )}
                {visible.map(renderCard)}
              </main>
              {view === 'archive' && !searching && (
                <section className="data-tools">
                  <p className="list-caption">Duomenų kopija</p>
                  <div className="data-tools-row">
                    <button type="button" className="btn btn-ghost" onClick={handleExport}>
                      <Icon name="download" size={17} />
                      Eksportuoti
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
                      <Icon name="upload" size={17} />
                      Importuoti
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json,.json"
                      hidden
                      onChange={handleImportFile}
                    />
                  </div>
                  {dataMsg && <p className="data-msg">{dataMsg}</p>}
                </section>
              )}
            </>
          )
        }

        const toTake = visible.filter((it) => !it.regitraDone)
        const atRegitra = visible.filter((it) => it.regitraDone)
        const managers = [...new Set(atRegitra.map((it) => it.manager))].sort((a, b) =>
          a.localeCompare(b, 'lt'),
        )

        return (
          <>
            {visible.length === 0 ? (
              <main className="case-list">
                <div className="empty-state">
                  <Icon name="inbox" size={30} strokeWidth={1.6} />
                  <p>Aktyvių bylų nėra.</p>
                </div>
              </main>
            ) : (
              <>
                <p className="list-caption cap-take">Vežti į Regitrą · {toTake.length}</p>
                <main className="case-list">{toTake.map(renderCard)}</main>

                <div className="list-caption-row">
                  <p className="list-caption cap-reg">Regitroje · {atRegitra.length}</p>
                  {atRegitra.length > 1 && (
                    <button
                      type="button"
                      className={`group-toggle${groupByManager ? ' active' : ''}`}
                      aria-label="Grupuoti pagal vadybininką"
                      aria-pressed={groupByManager}
                      onClick={() => setGroupByManager((v) => !v)}
                    >
                      <Icon name="users" size={16} />
                    </button>
                  )}
                </div>
                {groupByManager && atRegitra.length > 1 ? (
                  managers.map((m) => (
                    <div key={m} className="manager-group">
                      <p className="manager-caption">{m}</p>
                      <div className="case-list">
                        {atRegitra.filter((it) => it.manager === m).map(renderCard)}
                      </div>
                    </div>
                  ))
                ) : (
                  <main className="case-list">{atRegitra.map(renderCard)}</main>
                )}
              </>
            )}
          </>
        )
      })()}

      {confirmItem && (
        <ConfirmDialog
          title="Užbaigti bylą?"
          message={`„${confirmItem.model}" (${confirmItem.regNumber || confirmItem.vin || 'be numerio'}) bus perkelta į archyvą.`}
          confirmLabel="Užbaigti"
          onConfirm={handleConfirmComplete}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {pendingImport && (
        <ConfirmDialog
          title="Importuoti duomenis?"
          message={`Visos dabartinės bylos (${cases.length}) bus pakeistos importuotomis (${pendingImport.length}).`}
          confirmLabel="Importuoti"
          onConfirm={() => {
            setCases(pendingImport)
            setPendingImport(null)
            showDataMsg('Duomenys importuoti.')
          }}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {undoId && (
        <div className="undo-toast" role="status">
          <span>Byla perkelta į archyvą</span>
          <button type="button" onClick={handleUndoComplete}>
            Atšaukti
          </button>
        </div>
      )}
    </div>
  )
}

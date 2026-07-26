import { useEffect, useMemo, useRef, useState } from 'react'
import type { CaseDraft, RegistrationCase } from './types'
import { loadCases, saveCases } from './storage'
import { CaseCard } from './components/CaseCard'
import { CaseForm } from './components/CaseForm'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Icon } from './components/Icon'

type View = 'active' | 'archive'

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
    item.manager.toLowerCase().includes(q)
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
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saveCases(cases)
  }, [cases])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const visible = useMemo(() => {
    const inView = cases.filter((it) => (view === 'active' ? !it.completed : it.completed))
    const filtered = searchOpen ? inView.filter((it) => matchesQuery(it, query)) : inView
    return [...filtered].sort((a, b) =>
      view === 'active'
        ? b.date.localeCompare(a.date) || b.createdAt - a.createdAt
        : (b.completedAt ?? 0) - (a.completedAt ?? 0),
    )
  }, [cases, view, searchOpen, query])

  const update = (id: string, patch: Partial<RegistrationCase>) =>
    setCases((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  const handleToggleExpand = (id: string) => setExpandedId((cur) => (cur === id ? null : id))
  const handleToggleTechSheet = (id: string) =>
    setCases((prev) => prev.map((it) => (it.id === id ? { ...it, techSheetNeeded: !it.techSheetNeeded } : it)))
  const handleToggleRegitra = (id: string) =>
    setCases((prev) => prev.map((it) => (it.id === id ? { ...it, regitraDone: !it.regitraDone } : it)))

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
      setExpandedId(null)
    }
    setConfirmId(null)
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
    if (editingId) {
      update(editingId, draft)
    } else {
      const now = Date.now()
      setCases((prev) => [
        { ...draft, id: `c${now.toString(36)}`, createdAt: now, completedAt: null },
        ...prev,
      ])
    }
    setFormOpen(false)
    setEditingId(null)
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
      <header className="app-header">
        {searchOpen ? (
          <div className="search-bar">
            <Icon name="search" size={19} className="search-bar-icon" />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Modelis, VIN, numeris, vadybininkas…"
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
            <h1 className="header-title">{view === 'active' ? 'Registracijos bylos' : 'Archyvas'}</h1>
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

      <p className="list-caption">
        {searchOpen && query.trim()
          ? `Rasta: ${visible.length} ${bylosWord(visible.length)}`
          : view === 'active'
            ? `Aktyvios: ${visible.length} ${bylosWord(visible.length)}`
            : `Archyve: ${visible.length} ${bylosWord(visible.length)}`}
      </p>

      <main className="case-list">
        {visible.length === 0 && (
          <div className="empty-state">
            <Icon name={searchOpen && query.trim() ? 'search' : view === 'active' ? 'inbox' : 'archive'} size={30} strokeWidth={1.6} />
            <p>
              {searchOpen && query.trim()
                ? 'Nieko nerasta.'
                : view === 'active'
                  ? 'Aktyvių bylų nėra.'
                  : 'Archyvas tuščias.'}
            </p>
          </div>
        )}
        {visible.map((item) => (
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
        ))}
      </main>

      {confirmItem && (
        <ConfirmDialog
          title="Užbaigti bylą?"
          message={`„${confirmItem.model}" (${confirmItem.regNumber || confirmItem.vin || 'be numerio'}) bus perkelta į archyvą.`}
          confirmLabel="Užbaigti"
          onConfirm={handleConfirmComplete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  )
}

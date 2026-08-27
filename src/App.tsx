import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CaseDraft, RegistrationCase, Stage } from './types'
import { loadCases, migrate, saveCases } from './storage'
import { CaseCard } from './components/CaseCard'
import { CaseForm } from './components/CaseForm'
import { ConfirmDialog } from './components/ConfirmDialog'
import { BulkCompleteDialog } from './components/BulkCompleteDialog'
import { NotesScreen, type RoutineItem, type TodoItem } from './components/NotesScreen'
import { Icon } from './components/Icon'
import { useScrolled } from './useScrolled'
import { daysUntil } from './dates'

type View = 'active' | 'archive' | 'notes'

// Where an element sits in the layout, walking the offsetParent chain.
// Deliberately not getBoundingClientRect(): that reports the *painted* box, so
// it counts the card-in entry animation's transform and the page scroll —
// both of which would read as movement that never happened.
function layoutPosition(el: HTMLElement): { top: number; left: number } {
  let top = 0
  let left = 0
  let node: HTMLElement | null = el
  while (node) {
    top += node.offsetTop
    left += node.offsetLeft
    node = node.offsetParent as HTMLElement | null
  }
  return { top, left }
}

// FLIP: when cards jump between sections (or reorder), animate them from
// their previous position to the new one instead of teleporting
function useFlipAnimations(deps: unknown[]) {
  const positions = useRef(new Map<string, { top: number; left: number }>())
  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cards = document.querySelectorAll<HTMLElement>('[data-flip-id]')
    const next = new Map<string, { top: number; left: number }>()
    cards.forEach((el) => {
      const id = el.dataset.flipId
      if (!id) return
      const pos = layoutPosition(el)
      next.set(id, pos)
      const old = positions.current.get(id)
      if (!reduce && old) {
        const dx = old.left - pos.left
        const dy = old.top - pos.top
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

function autoWord(n: number): string {
  const last = n % 10
  const teens = n % 100 >= 11 && n % 100 <= 19
  if (last === 1 && !teens) return 'automobilis'
  if (last >= 2 && last <= 9 && !teens) return 'automobiliai'
  return 'automobilių'
}

// a fleet case counts as all its vehicles, a plain case as one
function vehiclesOf(it: RegistrationCase): number {
  return it.fleet ? Math.max(1, it.vehicleCount) : 1
}

// reservations are hard deadlines, so cases still waiting to be driven are
// ordered by urgency first: 0 = due today or overdue, 1 = tomorrow, 2 = the rest
function reservationRank(it: RegistrationCase): number {
  if (!it.reservedAt) return 2
  const diff = daysUntil(it.reservedAt)
  return diff <= 0 ? 0 : diff === 1 ? 1 : 2
}

// the workflow is a loop, not a dead end: past "paimti" a case comes back round
// to "vežti", so a mis-swipe can be walked off instead of edited away
const STAGE_FLOW: Record<Stage, { next: Stage; label: string }> = {
  take: { next: 'regitra', label: 'Perkelta į „Regitroje"' },
  regitra: { next: 'pickup', label: 'Perkelta į „Paimti iš Regitros"' },
  pickup: { next: 'take', label: 'Grąžinta į „Vežti"' },
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
  const [formClosing, setFormClosing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [groupByManager, setGroupByManager] = useState(() => localStorage.getItem('rb:groupBy') === '1')
  const [undo, setUndo] = useState<{ label: string; action: () => void } | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<RegistrationCase[] | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [quickTask, setQuickTask] = useState<string | null>(null)
  const [dataMsg, setDataMsg] = useState('')
  const [notice, setNotice] = useState('')
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    try {
      const raw = localStorage.getItem('rb:todos')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [memo, setMemo] = useState(() => localStorage.getItem('rb:memo') ?? '')
  const [routines, setRoutines] = useState<RoutineItem[]>(() => {
    try {
      const raw = localStorage.getItem('rb:routines')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  // which routine items are checked off, valid for one calendar day only
  const [routineState, setRoutineState] = useState<{ date: string; done: string[] }>(() => {
    try {
      const raw = localStorage.getItem('rb:routineDone')
      const parsed = raw ? JSON.parse(raw) : null
      if (parsed && typeof parsed.date === 'string' && Array.isArray(parsed.done)) return parsed
    } catch {
      // fall through
    }
    return { date: new Date().toDateString(), done: [] }
  })
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
  const noticeTimer = useRef<number | undefined>(undefined)

  // PWA icon shortcut ("Nauja byla") lands here with ?new=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('new') === '1') {
      setFormOpen(true)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    saveCases(cases)
  }, [cases])

  useEffect(() => {
    localStorage.setItem('rb:groupBy', groupByManager ? '1' : '0')
  }, [groupByManager])

  useEffect(() => {
    try {
      localStorage.setItem('rb:todos', JSON.stringify(todos))
    } catch {
      // storage unavailable
    }
  }, [todos])

  useEffect(() => {
    try {
      localStorage.setItem('rb:memo', memo)
    } catch {
      // storage unavailable
    }
  }, [memo])

  useEffect(() => {
    try {
      localStorage.setItem('rb:routines', JSON.stringify(routines))
    } catch {
      // storage unavailable
    }
  }, [routines])

  useEffect(() => {
    try {
      localStorage.setItem('rb:routineDone', JSON.stringify(routineState))
    } catch {
      // storage unavailable
    }
  }, [routineState])

  // new day → routine checkmarks reset themselves
  useEffect(() => {
    if (routineState.date !== today) setRoutineState({ date: today, done: [] })
  }, [today, routineState.date])

  useEffect(
    () => () => {
      window.clearTimeout(undoTimer.current)
      window.clearTimeout(dataMsgTimer.current)
      window.clearTimeout(noticeTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const toTakeCount = useMemo(
    () => cases.filter((it) => !it.completed && it.stage === 'take' && it.caseType === 'registracija').length,
    [cases],
  )
  const inspectionCount = useMemo(
    () => cases.filter((it) => !it.completed && it.caseType === 'apziura').length,
    [cases],
  )
  const identityCount = useMemo(
    () => cases.filter((it) => !it.completed && it.caseType === 'tapatybe').length,
    [cases],
  )
  const atRegitraCount = useMemo(
    () => cases.filter((it) => !it.completed && it.stage === 'regitra').length,
    [cases],
  )
  // the day's to-do list from Užrašai, pinned above the cases so the jobs that
  // have nothing to do with a car are still the first thing seen
  const pendingTodos = useMemo(() => todos.filter((t) => !t.done), [todos])

  const pickupCases = useMemo(
    () => cases.filter((it) => !it.completed && it.stage === 'pickup'),
    [cases],
  )
  const toPickupCount = pickupCases.length
  // cases that must reach Regitra today (or should already have)
  const dueTodayCount = useMemo(
    () => cases.filter((it) => !it.completed && it.stage === 'take' && reservationRank(it) === 0).length,
    [cases, today],
  )

  // brands typed by hand before — offered back as quick chips in the form
  const customBrands = useMemo(() => {
    const freq = new Map<string, number>()
    cases.forEach((it) => {
      const b = it.brand.trim()
      if (b && !['Nissan', 'Hyundai', 'Citroen'].includes(b)) freq.set(b, (freq.get(b) ?? 0) + 1)
    })
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b).slice(0, 8)
  }, [cases])

  // most-used manager names power the quick-pick chips in the form
  const managers = useMemo(() => {
    const freq = new Map<string, number>()
    cases.forEach((it) => {
      const m = it.manager.trim()
      if (m) freq.set(m, (freq.get(m) ?? 0) + 1)
    })
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m).slice(0, 8)
  }, [cases])

  // archive statistics in vehicles, not cases — a fleet of 5 counts as 5
  const archiveStats = useMemo(() => {
    const now = new Date()
    let allCases = 0
    let allVehicles = 0
    let monthCases = 0
    let monthVehicles = 0
    cases.forEach((it) => {
      if (!it.completed) return
      allCases++
      allVehicles += vehiclesOf(it)
      if (it.completedAt) {
        const d = new Date(it.completedAt)
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          monthCases++
          monthVehicles += vehiclesOf(it)
        }
      }
    })
    return { allCases, allVehicles, monthCases, monthVehicles }
  }, [cases, today])

  const todayLabel = useMemo(() => {
    const d = new Date()
    const weekday = d.toLocaleDateString('lt-LT', { weekday: 'short' })
    const monthDay = d.toLocaleDateString('lt-LT', { month: 'long', day: 'numeric' })
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${monthDay}`
  }, [today])

  const visible = useMemo(() => {
    const inView = cases.filter((it) => (view === 'active' ? !it.completed : it.completed))
    const filtered = searchOpen ? inView.filter((it) => matchesQuery(it, query)) : inView
    // active view: oldest first — the case that arrived first gets driven first
    return [...filtered].sort((a, b) =>
      view === 'active'
        ? a.date.localeCompare(b.date) || a.createdAt - b.createdAt
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
  // a held right-swipe walks the case one step around the workflow loop, so an
  // accidental step can be corrected with the same gesture that caused it
  const handleAdvanceStage = (id: string) => {
    const item = cases.find((it) => it.id === id)
    if (!item) return
    // an errand has no stages of its own — the same gesture hands it over
    // to Regitra as a registration instead
    if (item.caseType !== 'registracija') {
      handleConvertToRegistration(id)
      return
    }
    const { next, label } = STAGE_FLOW[item.stage]
    const before = { stage: item.stage, regitraAt: item.regitraAt, pickupAt: item.pickupAt }
    const now = Date.now()
    update(id, {
      stage: next,
      // stamps are set the first time a case reaches a stage and kept afterwards,
      // so looping back around does not wipe how long it really sat there
      regitraAt: item.regitraAt ?? (next !== 'take' ? now : null),
      pickupAt: item.pickupAt ?? (next === 'pickup' ? now : null),
    })
    showUndo(label, () => update(id, before))
  }

  // an inspection or identity errand becomes a registration handed straight
  // to Regitra — the documents stay there, so it lands in "Regitroje"
  const handleConvertToRegistration = (id: string) => {
    const item = cases.find((it) => it.id === id)
    if (!item || item.caseType === 'registracija') return
    const before = { caseType: item.caseType, stage: item.stage, regitraAt: item.regitraAt }
    setExpandedId(null)
    navigator.vibrate?.(20)
    update(id, { caseType: 'registracija', stage: 'regitra', regitraAt: item.regitraAt ?? Date.now() })
    showUndo('Atiduota Regitrai', () => update(id, before))
  }

  const toggleTodo = (id: string) =>
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))

  const addQuickTask = () => {
    const text = (quickTask ?? '').trim()
    if (!text) return
    setTodos((prev) => [...prev, { id: `t${Date.now().toString(36)}`, text, done: false }])
    setQuickTask('')
  }

  const handleRequestComplete = (id: string) => {
    const item = cases.find((it) => it.id === id)
    if (!item) return
    if (item.completed) {
      update(id, { completed: false, completedAt: null })
    } else {
      setConfirmId(id)
    }
  }

  // fade the card out before removing it from the list — the FLIP hook then
  // glides the remaining cards into place
  const animateOut = (ids: string | string[], after: () => void) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const els = (Array.isArray(ids) ? ids : [ids])
      .map((id) => document.querySelector<HTMLElement>(`[data-flip-id="${id}"]`))
      .filter((el): el is HTMLElement => el !== null)
    if (els.length === 0 || reduce) {
      after()
      return
    }
    els.forEach((el) => {
      el.style.pointerEvents = 'none'
      el.animate(
        [
          { opacity: 1, transform: 'scale(1)' },
          { opacity: 0, transform: 'scale(0.94)' },
        ],
        { duration: 200, easing: 'ease-in', fill: 'forwards' },
      )
    })
    window.setTimeout(after, 185)
  }

  const showUndo = (label: string, action: () => void) => {
    setUndo({ label, action })
    window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setUndo(null), 6000)
  }

  const handleConfirmComplete = () => {
    if (confirmId) {
      const id = confirmId
      navigator.vibrate?.(30)
      setExpandedId(null)
      animateOut(id, () => {
        update(id, { completed: true, completedAt: Date.now() })
        showUndo('Byla perkelta į archyvą', () => update(id, { completed: false, completedAt: null }))
      })
    }
    setConfirmId(null)
  }

  // one trip to Regitra closes several cases at once
  const handleBulkComplete = (ids: string[]) => {
    setBulkOpen(false)
    if (ids.length === 0) return
    navigator.vibrate?.(30)
    setExpandedId(null)
    animateOut(ids, () => {
      const now = Date.now()
      const mark = (completed: boolean) =>
        setCases((prev) =>
          prev.map((it) =>
            ids.includes(it.id) ? { ...it, completed, completedAt: completed ? now : null } : it,
          ),
        )
      mark(true)
      showUndo(`Archyvuota: ${ids.length} ${bylosWord(ids.length)}`, () => mark(false))
    })
  }

  const handleConfirmDelete = () => {
    if (deleteId) {
      const id = deleteId
      const removed = cases.find((it) => it.id === id)
      setExpandedId(null)
      navigator.vibrate?.(30)
      animateOut(id, () => {
        setCases((prev) => prev.filter((it) => it.id !== id))
        if (removed) showUndo('Byla ištrinta', () => setCases((prev) => [removed, ...prev]))
      })
    }
    setDeleteId(null)
  }

  const handleUndo = () => {
    undo?.action()
    window.clearTimeout(undoTimer.current)
    setUndo(null)
  }

  const handleRestore = (id: string) => {
    update(id, { completed: false, completedAt: null })
    setExpandedId(null)
  }

  const handleEdit = (id: string) => {
    setEditingId(id)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormClosing(true)
    window.setTimeout(() => {
      setFormOpen(false)
      setFormClosing(false)
      setEditingId(null)
    }, 240)
  }

  const handleSubmitForm = (draft: CaseDraft) => {
    const now = Date.now()
    if (editingId) {
      const prev = cases.find((it) => it.id === editingId)
      // same sticky rule as the swipe: stamp a stage the first time it is reached,
      // then leave it alone however the case moves afterwards
      update(editingId, {
        ...draft,
        regitraAt: prev?.regitraAt ?? (draft.stage !== 'take' ? now : null),
        pickupAt: prev?.pickupAt ?? (draft.stage === 'pickup' ? now : null),
      })
    } else {
      setCases((prev) => [
        {
          ...draft,
          id: `c${now.toString(36)}`,
          createdAt: now,
          completedAt: null,
          regitraAt: draft.stage === 'take' ? null : now,
          pickupAt: draft.stage === 'pickup' ? now : null,
        },
        ...prev,
      ])
    }
    closeForm()
  }

  const showNotice = (msg: string) => {
    setNotice(msg)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2500)
  }

  // copy one stage's list grouped by manager — ready to paste into a chat
  const handleCopyList = async (stage: 'regitra' | 'pickup' = 'regitra') => {
    const list = cases.filter((it) => !it.completed && it.stage === stage)
    if (list.length === 0) return
    const byManager = new Map<string, string[]>()
    list.forEach((it) => {
      const entry = `${it.model} (${it.regNumber || it.vin || '—'})`
      byManager.set(it.manager, [...(byManager.get(it.manager) ?? []), entry])
    })
    const stamp = new Date().toISOString().slice(0, 10)
    const text =
      `${stage === 'regitra' ? 'Regitroje' : 'Paimti iš Regitros'} (${stamp}):\n` +
      [...byManager.entries()].map(([m, list]) => `${m}: ${list.join(', ')}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    showNotice('Sąrašas nukopijuotas')
  }

  const showDataMsg = (msg: string) => {
    setDataMsg(msg)
    window.clearTimeout(dataMsgTimer.current)
    dataMsgTimer.current = window.setTimeout(() => setDataMsg(''), 4000)
  }

  const handleExport = async () => {
    const json = JSON.stringify({ version: 3, cases, todos, routines, memo }, null, 2)
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
        const list = Array.isArray(parsed) ? parsed : parsed?.cases
        if (!Array.isArray(list) || !list.every((it) => it && typeof it === 'object' && 'id' in it)) {
          throw new Error('bad shape')
        }
        if (!Array.isArray(parsed)) {
          if (Array.isArray(parsed.todos)) setTodos(parsed.todos)
          if (Array.isArray(parsed.routines)) setRoutines(parsed.routines)
          if (typeof parsed.memo === 'string') setMemo(parsed.memo)
        }
        setPendingImport(list.map(migrate))
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

  // Phone back button: every open sub-screen/dialog owns one history entry,
  // so "back" peels layers off instead of exiting the app. Entries are
  // retired with history.go(-1) when a layer is closed from within the UI.
  const layerDepth =
    (formOpen && !formClosing ? 1 : 0) +
    (confirmId ? 1 : 0) +
    (deleteId ? 1 : 0) +
    (pendingImport ? 1 : 0) +
    (bulkOpen ? 1 : 0) +
    (searchOpen ? 1 : 0) +
    (view !== 'active' ? 1 : 0)
  const layerDepthRef = useRef(0)
  const popSelf = useRef(0) // popstates caused by our own history.go()
  const popUser = useRef(0) // layer closes already paid for by a real back press

  const closeTopLayer = () => {
    if (formOpen && !formClosing) {
      closeForm()
    } else if (deleteId) {
      setDeleteId(null)
    } else if (confirmId) {
      setConfirmId(null)
    } else if (pendingImport) {
      setPendingImport(null)
    } else if (bulkOpen) {
      setBulkOpen(false)
    } else if (searchOpen) {
      closeSearch()
    } else if (view !== 'active') {
      setView('active')
      setExpandedId(null)
    }
  }
  const closeTopRef = useRef(closeTopLayer)
  closeTopRef.current = closeTopLayer

  useEffect(() => {
    const prev = layerDepthRef.current
    layerDepthRef.current = layerDepth
    if (layerDepth > prev) {
      for (let i = prev; i < layerDepth; i++) window.history.pushState({ rbLayer: true }, '')
    } else if (layerDepth < prev) {
      let retire = prev - layerDepth
      while (retire > 0 && popUser.current > 0) {
        popUser.current--
        retire--
      }
      if (retire > 0) {
        popSelf.current += retire
        window.history.go(-retire)
      }
    }
  }, [layerDepth])

  useEffect(() => {
    const onPop = () => {
      if (popSelf.current > 0) {
        popSelf.current--
        return
      }
      if (layerDepthRef.current > 0) {
        popUser.current++
        closeTopRef.current()
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const editingItem = editingId ? cases.find((it) => it.id === editingId) : undefined
  const confirmItem = confirmId ? cases.find((it) => it.id === confirmId) : undefined

  if (view === 'notes') {
    return (
      <NotesScreen
        todos={todos}
        routines={routines}
        routineDoneIds={routineState.done}
        memo={memo}
        onAddTodo={(text) =>
          setTodos((prev) => [...prev, { id: `t${Date.now().toString(36)}`, text, done: false }])
        }
        onToggleTodo={toggleTodo}
        onDeleteTodo={(id) => setTodos((prev) => prev.filter((t) => t.id !== id))}
        onClearDone={() => setTodos((prev) => prev.filter((t) => !t.done))}
        onAddRoutine={(text) =>
          setRoutines((prev) => [...prev, { id: `r${Date.now().toString(36)}`, text }])
        }
        onToggleRoutine={(id) =>
          setRoutineState((prev) => ({
            ...prev,
            done: prev.done.includes(id) ? prev.done.filter((d) => d !== id) : [...prev.done, id],
          }))
        }
        onDeleteRoutine={(id) => setRoutines((prev) => prev.filter((r) => r.id !== id))}
        onMemoChange={setMemo}
        onBack={() => setView('active')}
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
              <span className="header-date">{todayLabel}</span>
            ) : (
              <h1 className="header-title">Archyvas</h1>
            )}
            {view === 'active' && (
                <span
                  className="header-counts"
                  aria-label={`Vežti ${toTakeCount}, Regitroje ${atRegitraCount}, paimti ${toPickupCount}${
                    inspectionCount > 0 ? `, apžiūra ${inspectionCount}` : ''
                  }${
                    identityCount > 0 ? `, tapatybė ${identityCount}` : ''
                  }${
                    dueTodayCount > 0 ? `, šiandien atiduoti ${dueTodayCount}` : ''
                  }`}
                >
                  {toTakeCount > 0 && (
                    <span className="hc-item c-take">
                      <Icon name="car" size={15} strokeWidth={2.1} />
                      <strong key={`t${toTakeCount}`}>{toTakeCount}</strong>
                    </span>
                  )}
                  {atRegitraCount > 0 && (
                    <span className="hc-item c-reg">
                      <Icon name="landmark" size={14} strokeWidth={2.1} />
                      <strong key={`r${atRegitraCount}`}>{atRegitraCount}</strong>
                    </span>
                  )}
                  {toPickupCount > 0 && (
                    <span className="hc-item c-pickup">
                      <Icon name="inbox" size={15} strokeWidth={2.1} />
                      <strong key={`p${toPickupCount}`}>{toPickupCount}</strong>
                    </span>
                  )}
                  {inspectionCount > 0 && (
                    <span className="hc-item c-inspection">
                      <Icon name="wrench" size={14} strokeWidth={2.1} />
                      <strong key={`w${inspectionCount}`}>{inspectionCount}</strong>
                    </span>
                  )}
                  {identityCount > 0 && (
                    <span className="hc-item c-identity">
                      <Icon name="idCard" size={15} strokeWidth={2.1} />
                      <strong key={`i${identityCount}`}>{identityCount}</strong>
                    </span>
                  )}
                  {dueTodayCount > 0 && (
                    <span className="hc-item c-due">
                      <Icon name="calendar" size={14} strokeWidth={2.1} />
                      <strong key={`d${dueTodayCount}`}>{dueTodayCount}</strong>
                    </span>
                  )}
                </span>
            )}
            <div className="header-actions">
              {view === 'active' && (
                <button
                  type="button"
                  className="icon-btn header-btn has-badge"
                  aria-label="Užrašai"
                  onClick={() => {
                    setView('notes')
                    setExpandedId(null)
                  }}
                >
                  <Icon name="notebook" size={19} />
                  {(todos.some((t) => !t.done) ||
                    routines.some((r) => !routineState.done.includes(r.id))) && (
                    <span className="btn-dot" aria-hidden="true" />
                  )}
                </button>
              )}
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
                  <Icon name="plus" size={20} strokeWidth={2.2} />
                </button>
              )}
            </div>
          </>
        )}
      </header>

      {view === 'active' && !(searchOpen && query.trim() !== '') && (pendingTodos.length > 0 || quickTask !== null) && (
        <section className="day-tasks">
          <div className="list-caption-row">
            <p className="list-caption cap-day">Darbai · {pendingTodos.length}</p>
            <div className="caption-actions">
              <button
                type="button"
                className="group-toggle"
                aria-label={quickTask === null ? 'Pridėti darbą' : 'Uždaryti įvedimą'}
                onClick={() => setQuickTask((v) => (v === null ? '' : null))}
              >
                <Icon name={quickTask === null ? 'plus' : 'close'} size={16} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          {quickTask !== null && (
            <div className="task-add">
              <input
                autoFocus
                value={quickTask}
                onChange={(e) => setQuickTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addQuickTask()
                  }
                  if (e.key === 'Escape') setQuickTask(null)
                }}
                placeholder="Pvz.: nuvežti sąskaitas"
                aria-label="Naujas darbas"
                autoComplete="off"
              />
              <button
                type="button"
                className="icon-btn task-add-btn"
                aria-label="Išsaugoti darbą"
                disabled={!quickTask.trim()}
                onClick={addQuickTask}
              >
                <Icon name="check" size={18} strokeWidth={2.6} />
              </button>
            </div>
          )}

          {pendingTodos.map((t) => (
            <div key={t.id} className="task-strip">
              <button
                type="button"
                className="task-check"
                role="checkbox"
                aria-checked={false}
                aria-label={`Atlikta: ${t.text}`}
                onClick={() => toggleTodo(t.id)}
              />
              <span className="task-strip-text">{t.text}</span>
            </div>
          ))}
        </section>
      )}

      {(() => {
        const searching = searchOpen && query.trim() !== ''
        const renderCard = (item: RegistrationCase) => (
          <CaseCard
            key={item.id}
            item={item}
            expanded={expandedId === item.id}
            onToggleExpand={handleToggleExpand}
            onToggleTechSheet={handleToggleTechSheet}
            onAdvanceStage={handleAdvanceStage}
            onRequestComplete={handleRequestComplete}
            onSaveNotes={(id, notes) => update(id, { notes })}
            onEdit={handleEdit}
            onRestore={view === 'archive' ? handleRestore : undefined}
            onConvertToRegistration={handleConvertToRegistration}
            onRequestDelete={(id) => setDeleteId(id)}
          />
        )

        if (searching || view === 'archive') {
          return (
            <>
              {searching ? (
                <p className="list-caption">{`Rasta: ${visible.length} ${bylosWord(visible.length)}`}</p>
              ) : (
                <>
                  <p className="list-caption">
                    {`Archyve: ${archiveStats.allCases} ${bylosWord(archiveStats.allCases)} · ${archiveStats.allVehicles} ${autoWord(archiveStats.allVehicles)}`}
                  </p>
                  <p className="section-hint">
                    {`Šį mėnesį užbaigta: ${archiveStats.monthCases} ${bylosWord(archiveStats.monthCases)} · ${archiveStats.monthVehicles} ${autoWord(archiveStats.monthVehicles)}`}
                  </p>
                </>
              )}
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

        // sort is stable, so within the same urgency the FIFO order survives
        const byUrgency = (a: RegistrationCase, b: RegistrationCase) =>
          reservationRank(a) - reservationRank(b)
        // identity checks mean queueing at Regitra with the car, so they get
        // their own list instead of sitting among the registration cases
        const toTake = visible
          .filter((it) => it.stage === 'take' && it.caseType === 'registracija')
          .sort(byUrgency)
        const atRegitra = visible.filter((it) => it.stage === 'regitra')
        const toPickup = visible.filter((it) => it.stage === 'pickup')
        const inspection = visible.filter((it) => it.caseType === 'apziura').sort(byUrgency)
        const identity = visible.filter((it) => it.caseType === 'tapatybe').sort(byUrgency)
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
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setEditingId(null)
                      setFormOpen(true)
                    }}
                  >
                    <Icon name="plus" size={18} strokeWidth={2.4} />
                    Pridėti bylą
                  </button>
                </div>
              </main>
            ) : (
              <>
                {/* a section only exists while it holds something */}
                {toTake.length > 0 && (
                  <>
                    <p className="list-caption cap-take">Vežti · {toTake.length}</p>
                    <main className="case-list">{toTake.map(renderCard)}</main>
                  </>
                )}

                {atRegitra.length > 0 && (
                  <>
                    <div className="list-caption-row">
                      <p className="list-caption cap-reg">Regitroje · {atRegitra.length}</p>
                      <div className="caption-actions">
                        <button
                          type="button"
                          className="group-toggle"
                          aria-label="Kopijuoti sąrašą"
                          onClick={() => handleCopyList('regitra')}
                        >
                          <Icon name="copy" size={15} />
                        </button>
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

                {toPickup.length > 0 && (
                  <>
                    <div className="list-caption-row">
                      <p className="list-caption cap-pickup">Paimti iš Regitros · {toPickup.length}</p>
                      <div className="caption-actions">
                        <button
                          type="button"
                          className="group-toggle"
                          aria-label="Kopijuoti paėmimo sąrašą"
                          onClick={() => handleCopyList('pickup')}
                        >
                          <Icon name="copy" size={15} />
                        </button>
                        <button
                          type="button"
                          className="group-toggle ok"
                          aria-label="Užbaigti paimtas bylas"
                          onClick={() => setBulkOpen(true)}
                        >
                          <Icon name="check" size={16} strokeWidth={2.6} />
                        </button>
                      </div>
                    </div>
                    <main className="case-list">{toPickup.map(renderCard)}</main>
                  </>
                )}

                {inspection.length > 0 && (
                  <>
                    <p className="list-caption cap-inspection">Apžiūra · {inspection.length}</p>
                    <main className="case-list">{inspection.map(renderCard)}</main>
                  </>
                )}

                {identity.length > 0 && (
                  <>
                    <p className="list-caption cap-identity">Tapatybė · {identity.length}</p>
                    <main className="case-list">{identity.map(renderCard)}</main>
                  </>
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

      {deleteId && (
        <ConfirmDialog
          title="Ištrinti bylą?"
          message={(() => {
            const it = cases.find((c) => c.id === deleteId)
            return `„${it?.model ?? ''}" (${it?.regNumber || it?.vin || 'be numerio'}) bus pašalinta visam laikui.`
          })()}
          confirmLabel="Ištrinti"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {bulkOpen && pickupCases.length > 0 && (
        <BulkCompleteDialog
          items={pickupCases}
          onConfirm={handleBulkComplete}
          onCancel={() => setBulkOpen(false)}
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

      {formOpen && (
        <div className={`form-overlay${formClosing ? ' closing' : ''}`}>
          <CaseForm
            initial={editingItem}
            managers={managers}
            customBrands={customBrands}
            onCancel={closeForm}
            onSubmit={handleSubmitForm}
          />
        </div>
      )}

      {notice && !undo && (
        <div className="undo-toast notice" role="status">
          <span>{notice}</span>
        </div>
      )}

      {undo && (
        <div className="undo-toast" role="status">
          <span>{undo.label}</span>
          <button type="button" onClick={handleUndo}>
            Atšaukti
          </button>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Icon } from './Icon'
import { useScrolled } from '../useScrolled'

export interface TodoItem {
  id: string
  text: string
  done: boolean
}

interface NotesScreenProps {
  todos: TodoItem[]
  memo: string
  onAddTodo: (text: string) => void
  onToggleTodo: (id: string) => void
  onDeleteTodo: (id: string) => void
  onClearDone: () => void
  onMemoChange: (text: string) => void
  onBack: () => void
}

export function NotesScreen({
  todos,
  memo,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onClearDone,
  onMemoChange,
  onBack,
}: NotesScreenProps) {
  const [draft, setDraft] = useState('')
  const scrolled = useScrolled()
  const undone = todos.filter((t) => !t.done).length
  const hasDone = todos.some((t) => t.done)

  const add = () => {
    const text = draft.trim()
    if (!text) return
    onAddTodo(text)
    setDraft('')
  }

  return (
    <div className="screen">
      <header className={`app-header${scrolled ? ' scrolled' : ''}`}>
        <button type="button" className="icon-btn header-btn" aria-label="Grįžti" onClick={onBack}>
          <Icon name="back" size={23} />
        </button>
        <h1 className="header-title">Užrašai</h1>
      </header>

      <p className="list-caption">
        Dienos darbai{todos.length > 0 ? ` · liko ${undone}` : ''}
      </p>

      <div className="todo-add">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Pvz.: paimti sąskaitas faktūras"
          autoComplete="off"
        />
        <button
          type="button"
          className="icon-btn todo-add-btn"
          aria-label="Pridėti darbą"
          disabled={!draft.trim()}
          onClick={add}
        >
          <Icon name="plus" size={20} strokeWidth={2.4} />
        </button>
      </div>

      <div className="todo-list">
        {todos.length === 0 && <p className="todo-empty">Šiandienos darbų sąrašas tuščias.</p>}
        {todos.map((t) => (
          <div key={t.id} className={`todo-item${t.done ? ' done' : ''}`}>
            <button
              type="button"
              className="todo-check"
              role="checkbox"
              aria-checked={t.done}
              aria-label={t.done ? 'Pažymėti kaip neatliktą' : 'Pažymėti kaip atliktą'}
              onClick={() => onToggleTodo(t.id)}
            >
              {t.done && <Icon name="check" size={15} strokeWidth={2.8} />}
            </button>
            <span className="todo-text" onClick={() => onToggleTodo(t.id)}>
              {t.text}
            </span>
            <button
              type="button"
              className="icon-btn todo-del"
              aria-label="Pašalinti darbą"
              onClick={() => onDeleteTodo(t.id)}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>

      {hasDone && (
        <button type="button" className="btn btn-ghost todo-clear" onClick={onClearDone}>
          Išvalyti atliktus
        </button>
      )}

      <p className="list-caption memo-caption">Atmintinė</p>
      <textarea
        className="memo-input"
        rows={8}
        value={memo}
        onChange={(e) => onMemoChange(e.target.value)}
        placeholder={'Nuolatinės taisyklės ir pastabos, pvz.:\n• Kopijai reikia štampo\n• Aikštelės atveju pasirašo vadovas'}
      />
      <p className="memo-hint">Išsisaugo automatiškai.</p>
    </div>
  )
}

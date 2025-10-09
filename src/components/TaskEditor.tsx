import { useState, useEffect } from 'react'
import type { TaskDTO } from '../types'
import { omnifocusBridge } from '../services/omnifocus-bridge'
import { parseNaturalDate, describeNaturalDate } from '../utils/date-parser'

interface TaskEditorProps {
  task: TaskDTO
  onSave: (updates: Partial<TaskDTO>) => void
  onCancel: () => void
}

export default function TaskEditor({ task, onSave, onCancel }: TaskEditorProps) {
  const [name, setName] = useState(task.name)
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split('T')[0] : '')
  const [deferDate, setDeferDate] = useState(task.deferDate ? task.deferDate.split('T')[0] : '')
  const [context, setContext] = useState(task.context || '')
  const [note, setNote] = useState(task.note || '')
  const [error, setError] = useState('')
  const [availableContexts, setAvailableContexts] = useState<Array<{id: string; name: string}>>([])
  const [loadingContexts, setLoadingContexts] = useState(false)
  const [showContextDropdown, setShowContextDropdown] = useState(false)
  const [filteredContexts, setFilteredContexts] = useState<Array<{id: string; name: string}>>([])
  const [naturalDueDate, setNaturalDueDate] = useState('')
  const [naturalDeferDate, setNaturalDeferDate] = useState('')
  const [dueDatePreview, setDueDatePreview] = useState<string | null>(null)
  const [deferDatePreview, setDeferDatePreview] = useState<string | null>(null)

  // Fetch contexts from OmniFocus
  useEffect(() => {
    const fetchContexts = async () => {
      console.log('[TaskEditor] Starting to fetch contexts...')
      setLoadingContexts(true)
      try {
        const contexts = await omnifocusBridge.getContexts()
        console.log('[TaskEditor] Received contexts:', contexts)
        setAvailableContexts(contexts)
        setFilteredContexts(contexts)
        console.log(`[TaskEditor] Loaded ${contexts.length} contexts from OmniFocus`)
      } catch (error) {
        console.error('[TaskEditor] Failed to fetch contexts:', error)
      } finally {
        setLoadingContexts(false)
      }
    }
    
    fetchContexts()
  }, [])

  // Filter contexts as user types
  useEffect(() => {
    if (context.trim() === '') {
      setFilteredContexts(availableContexts)
    } else {
      const filtered = availableContexts.filter(ctx => 
        ctx.name.toLowerCase().includes(context.toLowerCase())
      )
      setFilteredContexts(filtered)
    }
    console.log('[TaskEditor] Filtered contexts:', filteredContexts.length, 'Show dropdown:', showContextDropdown)
  }, [context, availableContexts])

  useEffect(() => {
    // Reset form when task changes
    setName(task.name)
    setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '')
    setDeferDate(task.deferDate ? task.deferDate.split('T')[0] : '')
    setContext(task.context || '')
    setNote(task.note || '')
    setError('')
    setNaturalDueDate('')
    setNaturalDeferDate('')
    setDueDatePreview(null)
    setDeferDatePreview(null)
  }, [task.id])

  // Handle natural language due date input
  useEffect(() => {
    if (naturalDueDate.trim()) {
      const parsed = parseNaturalDate(naturalDueDate)
      const preview = describeNaturalDate(naturalDueDate)
      setDueDatePreview(preview)
      if (parsed) {
        setDueDate(parsed)
      }
    } else {
      setDueDatePreview(null)
    }
  }, [naturalDueDate])

  // Handle natural language defer date input
  useEffect(() => {
    if (naturalDeferDate.trim()) {
      const parsed = parseNaturalDate(naturalDeferDate)
      const preview = describeNaturalDate(naturalDeferDate)
      setDeferDatePreview(preview)
      if (parsed) {
        setDeferDate(parsed)
      }
    } else {
      setDeferDatePreview(null)
    }
  }, [naturalDeferDate])

  // Helper to create date at start of day (defer dates)
  const createDeferDate = (dateString: string): string => {
    // Parse date in YYYY-MM-DD format to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    // Set to 7am local time (start of working day)
    date.setHours(7, 0, 0, 0)
    return date.toISOString()
  }

  // Helper to create date at end of day (due dates)
  const createDueDate = (dateString: string): string => {
    // Parse date in YYYY-MM-DD format to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    // Set to 9pm local time (end of working day)
    date.setHours(21, 0, 0, 0)
    return date.toISOString()
  }

  const handleSave = () => {
    if (!name.trim()) {
      setError('Task name is required')
      return
    }

    const updates: Partial<TaskDTO> = {
      name: name.trim(),
    }

    if (dueDate) {
      updates.dueDate = createDueDate(dueDate)
    } else {
      updates.dueDate = undefined
    }

    if (deferDate) {
      updates.deferDate = createDeferDate(deferDate)
    } else {
      updates.deferDate = undefined
    }

    if (context.trim()) {
      updates.context = context.trim()
    } else {
      updates.context = undefined
    }

    if (note.trim()) {
      updates.note = note.trim()
    } else {
      updates.note = undefined
    }

    onSave(updates)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave()
    } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault() // Prevent browser save dialog
      handleSave()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div className="task-editor-inline">
      <div className="editor-field">
        <input
          className="task-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Task name"
          autoFocus
        />
      </div>

      <div className="editor-row">
        <div className="editor-field">
          <label className="field-label">Defer Date</label>
          <input
            className="task-date-input"
            type="date"
            value={deferDate}
            onChange={(e) => setDeferDate(e.target.value)}
            placeholder="Defer until"
          />
          <input
            className="task-natural-date-input"
            type="text"
            value={naturalDeferDate}
            onChange={(e) => setNaturalDeferDate(e.target.value)}
            placeholder="Or type: tomorrow, next Friday, in 2 weeks..."
            style={{ marginTop: '4px', fontSize: '0.85em', opacity: 0.9 }}
          />
          {deferDatePreview && (
            <div style={{ fontSize: '0.8em', color: '#4CAF50', marginTop: '2px' }}>
              ✓ {deferDatePreview}
            </div>
          )}
        </div>

        <div className="editor-field">
          <label className="field-label">Due Date</label>
          <input
            className="task-date-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            placeholder="Due date"
          />
          <input
            className="task-natural-date-input"
            type="text"
            value={naturalDueDate}
            onChange={(e) => setNaturalDueDate(e.target.value)}
            placeholder="Or type: tomorrow, next Friday, in 2 weeks..."
            style={{ marginTop: '4px', fontSize: '0.85em', opacity: 0.9 }}
          />
          {dueDatePreview && (
            <div style={{ fontSize: '0.8em', color: '#4CAF50', marginTop: '2px' }}>
              ✓ {dueDatePreview}
            </div>
          )}
        </div>
      </div>

      <div className="editor-field context-field-wrapper">
        <label className="field-label">
          Context/Tag {loadingContexts && <span className="loading-indicator">Loading...</span>}
        </label>
        <div className="context-autocomplete">
          <input
            className="task-context-input"
            type="text"
            value={context}
            onChange={(e) => {
              setContext(e.target.value)
              setShowContextDropdown(true)
            }}
            onFocus={() => {
              console.log('[TaskEditor] Context input focused, showing dropdown')
              setShowContextDropdown(true)
            }}
            onBlur={() => setTimeout(() => setShowContextDropdown(false), 200)}
            onKeyDown={handleKeyDown}
            placeholder="Type or select context"
          />
          {showContextDropdown && filteredContexts.length > 0 && (
            <div className="context-dropdown">
              {filteredContexts.slice(0, 8).map(ctx => (
                <div
                  key={ctx.id}
                  className="context-option"
                  onClick={() => {
                    setContext(ctx.name)
                    setShowContextDropdown(false)
                  }}
                >
                  {ctx.name}
                </div>
              ))}
              {filteredContexts.length > 8 && (
                <div className="context-option-more">
                  + {filteredContexts.length - 8} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="editor-field">
        <label className="field-label">Notes</label>
        <textarea
          className="task-note-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Additional notes (optional)"
          rows={3}
        />
      </div>

      {error && <div className="editor-error">{error}</div>}

      <div className="task-editor-actions">
        <button className="save-btn" onClick={handleSave}>
          Save
        </button>
        <button className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className="editor-hint">
        ⌘Enter to save • Esc to cancel
      </div>
    </div>
  )
}

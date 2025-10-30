import { useState, useEffect } from 'react'
import type { TaskDTO, TaskStatus } from '../types'
import { omnifocusBridge } from '../services/omnifocus-bridge'
import { parseNaturalDate, describeNaturalDate } from '../utils/date-parser'

interface TaskFormProps {
  projectId: string
  task?: TaskDTO // Optional - if provided, we're editing; if not, we're creating
  onSave: (taskData: Omit<TaskDTO, 'id' | 'lastModified' | 'syncState'> | Partial<TaskDTO>) => void
  onCancel: () => void
}

export default function TaskForm({ projectId, task, onSave, onCancel }: TaskFormProps) {
  const isEditMode = !!task
  
  // Form state
  const [name, setName] = useState(task?.name || '')
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.split('T')[0] : '')
  const [deferDate, setDeferDate] = useState(task?.deferDate ? task.deferDate.split('T')[0] : '')
  const [context, setContext] = useState(task?.context || '')
  const [note, setNote] = useState(task?.note || '')
  const [error, setError] = useState('')
  
  // Context autocomplete state
  const [availableContexts, setAvailableContexts] = useState<Array<{id: string; name: string}>>([])
  const [loadingContexts, setLoadingContexts] = useState(false)
  const [showContextDropdown, setShowContextDropdown] = useState(false)
  const [filteredContexts, setFilteredContexts] = useState<Array<{id: string; name: string}>>([])
  
  // Natural language date state
  const [naturalDueDate, setNaturalDueDate] = useState('')
  const [naturalDeferDate, setNaturalDeferDate] = useState('')
  const [dueDatePreview, setDueDatePreview] = useState<string | null>(null)
  const [deferDatePreview, setDeferDatePreview] = useState<string | null>(null)
  const [showDueDatePicker, setShowDueDatePicker] = useState(false)
  const [showDeferDatePicker, setShowDeferDatePicker] = useState(false)

  // Fetch contexts from OmniFocus
  useEffect(() => {
    const fetchContexts = async () => {
      console.log('[TaskForm] Starting to fetch contexts...')
      setLoadingContexts(true)
      try {
        const contexts = await omnifocusBridge.getContexts()
        console.log('[TaskForm] Received contexts:', contexts)
        setAvailableContexts(contexts)
        setFilteredContexts(contexts)
        console.log(`[TaskForm] Loaded ${contexts.length} contexts from OmniFocus`)
      } catch (error) {
        console.error('[TaskForm] Failed to fetch contexts:', error)
      } finally {
        setLoadingContexts(false)
      }
    }
    
    fetchContexts()
  }, [])

  // Helpers: sanitize and fuzzy-match context/tag names against available contexts
  const normalizeContextInput = (value: string): string => {
    return value.trim().replace(/[\s,]+$/g, '')
  }

  // Simple Levenshtein distance for small strings
  const levenshtein = (a: string, b: string): number => {
    const m = a.length
    const n = b.length
    if (m === 0) return n
    if (n === 0) return m
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        )
      }
    }
    return dp[m][n]
  }

  const bestContextMatch = (
    rawInput: string,
    contexts: Array<{ id: string; name: string }>
  ): { match?: { id: string; name: string }; ambiguous?: boolean } => {
    const input = normalizeContextInput(rawInput)
    if (!input) return {}
    const lower = input.toLowerCase()
    const names = contexts.map(c => ({ ...c, lower: c.name.toLowerCase() }))

    // 1) Exact (case-insensitive)
    const exact = names.find(c => c.lower === lower)
    if (exact) return { match: { id: exact.id, name: exact.name } }

    // 2) startsWith
    const starts = names.filter(c => c.lower.startsWith(lower))
    if (starts.length === 1) return { match: { id: starts[0].id, name: starts[0].name } }
    if (starts.length > 1) return { ambiguous: true }

    // 3) includes
    const incl = names.filter(c => c.lower.includes(lower))
    if (incl.length === 1) return { match: { id: incl[0].id, name: incl[0].name } }
    if (incl.length > 1) return { ambiguous: true }

    // 4) Levenshtein distance threshold <= 2
    let best: { id: string; name: string } | undefined
    let bestDist = Number.MAX_SAFE_INTEGER
    for (const c of names) {
      const d = levenshtein(lower, c.lower)
      if (d < bestDist) {
        bestDist = d
        best = { id: c.id, name: c.name }
      }
    }
    if (best && bestDist <= 2) return { match: best }

    return {}
  }

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
    console.log('[TaskForm] Filtered contexts:', filteredContexts.length, 'Show dropdown:', showContextDropdown)
  }, [context, availableContexts])

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

    // Resolve and validate context if provided
    let finalContext: string | undefined = undefined
    if (context && context.trim()) {
      const normalized = normalizeContextInput(context)
      if (!availableContexts || availableContexts.length === 0) {
        setError('Contexts are still loading. Please try again in a moment.')
        return
      }
      const { match, ambiguous } = bestContextMatch(normalized, availableContexts)
      if (ambiguous) {
        setError('Multiple matching contexts found. Please pick from the dropdown.')
        setShowContextDropdown(true)
        return
      }
      if (!match) {
        setError('Context not found. Please pick an existing tag.')
        setShowContextDropdown(true)
        return
      }
      finalContext = match.name
    }

    if (isEditMode) {
      // Edit mode - return partial updates
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

      if (finalContext) {
        updates.context = finalContext
      } else {
        updates.context = undefined
      }

      if (note.trim()) {
        updates.note = note.trim()
      } else {
        updates.note = undefined
      }

      onSave(updates)
    } else {
      // Create mode - return full task data
      const newTask: Omit<TaskDTO, 'id' | 'lastModified' | 'syncState'> = {
        projectId,
        name: name.trim(),
        status: 'available' as TaskStatus,
        flagged: false,
        completed: false,
        note: note.trim() || undefined,
        context: finalContext || undefined,
        dueDate: dueDate ? createDueDate(dueDate) : undefined,
        deferDate: deferDate ? createDeferDate(deferDate) : undefined,
      }

      onSave(newTask)
      
      // Reset form after successful creation
      setName('')
      setDueDate('')
      setDeferDate('')
      setContext('')
      setNote('')
      setError('')
      setNaturalDueDate('')
      setNaturalDeferDate('')
      setDueDatePreview(null)
      setDeferDatePreview(null)
      setShowDueDatePicker(false)
      setShowDeferDatePicker(false)
    }
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
          placeholder={isEditMode ? "Task name" : "Type task name and press Enter..."}
          autoFocus
        />
      </div>

      <div className="editor-row">
        <div className="editor-field">
          <label className="field-label">Due Date</label>
          <div className="date-input-container">
            <input
              className="task-natural-date-input"
              type="text"
              value={naturalDueDate}
              onChange={(e) => setNaturalDueDate(e.target.value)}
              placeholder="Type: tomorrow, next Friday, in 2 weeks..."
            />
            <button
              type="button"
              className="calendar-button"
              onClick={() => {
                setShowDueDatePicker(true)
                // Focus the date input to trigger the native calendar
                setTimeout(() => {
                  const dateInput = document.querySelector('.date-picker-dropdown .task-date-input') as HTMLInputElement
                  if (dateInput) {
                    dateInput.focus()
                    dateInput.showPicker?.()
                  }
                }, 10)
              }}
              title="Open calendar picker"
            >
              📅
            </button>
          </div>
          {showDueDatePicker && (
            <div className="date-picker-dropdown">
              <input
                className="task-date-input"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value)
                  // Update natural language input to match
                  if (e.target.value) {
                    const date = new Date(e.target.value)
                    const natural = date.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })
                    setNaturalDueDate(natural)
                  }
                }}
                placeholder="Due date"
                autoFocus
              />
            </div>
          )}
          {dueDatePreview && (
            <div style={{ fontSize: '0.8em', color: '#4CAF50', marginTop: '2px' }}>
              ✓ {dueDatePreview}
            </div>
          )}
        </div>

        <div className="editor-field">
          <label className="field-label">Defer Date</label>
          <div className="date-input-container">
            <input
              className="task-natural-date-input"
              type="text"
              value={naturalDeferDate}
              onChange={(e) => setNaturalDeferDate(e.target.value)}
              placeholder="Type: tomorrow, next Friday, in 2 weeks..."
            />
            <button
              type="button"
              className="calendar-button"
              onClick={() => {
                setShowDeferDatePicker(true)
                // Focus the date input to trigger the native calendar
                setTimeout(() => {
                  const dateInputs = document.querySelectorAll('.date-picker-dropdown .task-date-input')
                  const dateInput = dateInputs[dateInputs.length - 1] as HTMLInputElement
                  if (dateInput) {
                    dateInput.focus()
                    dateInput.showPicker?.()
                  }
                }, 10)
              }}
              title="Open calendar picker"
            >
              📅
            </button>
          </div>
          {showDeferDatePicker && (
            <div className="date-picker-dropdown">
              <input
                className="task-date-input"
                type="date"
                value={deferDate}
                onChange={(e) => {
                  setDeferDate(e.target.value)
                  // Update natural language input to match
                  if (e.target.value) {
                    const date = new Date(e.target.value)
                    const natural = date.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })
                    setNaturalDeferDate(natural)
                  }
                }}
                placeholder="Defer until"
                autoFocus
              />
            </div>
          )}
          {deferDatePreview && (
            <div style={{ fontSize: '0.8em', color: '#4CAF50', marginTop: '2px' }}>
              ✓ {deferDatePreview}
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
              console.log('[TaskForm] Context input focused, showing dropdown')
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
        <button className="save-btn" onClick={handleSave} type="button">
          {isEditMode ? 'Save' : 'Add Task'}
        </button>
        <button className="cancel-btn" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>

      <div className="editor-hint">
        ⌘Enter to save • Esc to cancel
      </div>
    </div>
  )
}

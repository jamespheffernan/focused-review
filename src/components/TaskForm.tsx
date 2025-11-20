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
  
  // Normalize tags from task - handle both array and legacy context field
  const normalizeTaskTags = (task: TaskDTO | undefined): string[] => {
    if (!task) return []
    if (Array.isArray(task.tags) && task.tags.length > 0) {
      return task.tags.filter(tag => tag && tag.trim().length > 0)
    }
    if (task.context && task.context.trim().length > 0) {
      return [task.context.trim()]
    }
    return []
  }
  
  // Form state
  const [name, setName] = useState(task?.name || '')
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.split('T')[0] : '')
  const [deferDate, setDeferDate] = useState(task?.deferDate ? task.deferDate.split('T')[0] : '')
  const [selectedTags, setSelectedTags] = useState<string[]>(normalizeTaskTags(task))
  const [tagInput, setTagInput] = useState('')
  const [note, setNote] = useState(task?.note || '')
  const [error, setError] = useState('')
  
  // Update selectedTags when task prop changes (e.g., when editing a different task)
  useEffect(() => {
    if (task) {
      const normalized = normalizeTaskTags(task)
      console.log('[TaskForm] Task loaded:', { 
        taskId: task.id, 
        taskName: task.name,
        rawTags: task.tags,
        context: task.context,
        normalizedTags: normalized 
      })
      setSelectedTags(normalized)
      setName(task.name || '')
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '')
      setDeferDate(task.deferDate ? task.deferDate.split('T')[0] : '')
      setNote(task.note || '')
    }
  }, [task?.id]) // Update when task ID changes
  
  // Context autocomplete state
  const [availableTags, setAvailableTags] = useState<Array<{id: string; name: string}>>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [filteredTags, setFilteredTags] = useState<Array<{id: string; name: string}>>([])
  const [highlightedTagIndex, setHighlightedTagIndex] = useState(-1)
  
  // Natural language date state
  const [naturalDueDate, setNaturalDueDate] = useState('')
  const [naturalDeferDate, setNaturalDeferDate] = useState('')
  const [dueDatePreview, setDueDatePreview] = useState<string | null>(null)
  const [deferDatePreview, setDeferDatePreview] = useState<string | null>(null)
  const [showDueDatePicker, setShowDueDatePicker] = useState(false)
  const [showDeferDatePicker, setShowDeferDatePicker] = useState(false)

  // Fetch tags from OmniFocus
  useEffect(() => {
    const fetchTags = async () => {
      console.log('[TaskForm] Starting to fetch tags...')
      setLoadingTags(true)
      try {
        const tags = await omnifocusBridge.getTags()
        console.log('[TaskForm] Received tags:', tags)
        setAvailableTags(tags)
        setFilteredTags(tags)
        console.log(`[TaskForm] Loaded ${tags.length} tags from OmniFocus`)
      } catch (error) {
        console.error('[TaskForm] Failed to fetch tags:', error)
      } finally {
        setLoadingTags(false)
      }
    }
    
    fetchTags()
  }, [])

  // Helpers: sanitize and fuzzy-match tag names against available tags
  const normalizeTagInput = (value: string): string => {
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

  const bestTagMatch = (
    rawInput: string,
    tags: Array<{ id: string; name: string }>
  ): { match?: { id: string; name: string }; ambiguous?: boolean } => {
    const input = normalizeTagInput(rawInput)
    if (!input) return {}
    const lower = input.toLowerCase()
    const names = tags.map(c => ({ ...c, lower: c.name.toLowerCase() }))

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

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(tag => tag !== tagToRemove))
    setError('')
  }

  const addTagFromInput = (rawInput: string): boolean => {
    const normalized = normalizeTagInput(rawInput)
    if (!normalized) {
      return false
    }
    if (!availableTags || availableTags.length === 0) {
      setError('Tags are still loading. Please try again in a moment.')
      return false
    }
    const { match, ambiguous } = bestTagMatch(normalized, availableTags)
    if (ambiguous) {
      setError('Multiple matching tags found. Please pick from the dropdown.')
      setShowTagDropdown(true)
      return false
    }
    if (!match) {
      setError('Tag not found. Please pick an existing tag.')
      setShowTagDropdown(true)
      return false
    }
    let added = false
    setSelectedTags(prev => {
      const exists = prev.some(tag => tag.toLowerCase() === match.name.toLowerCase())
      if (exists) {
        return prev
      }
      added = true
      return [...prev, match.name]
    })
    if (!added) {
      setError(`Tag "${match.name}" already added`)
      return false
    }
    setTagInput('')
    setShowTagDropdown(false)
    setError('')
    return true
  }

  // Filter tag suggestions as user types
  useEffect(() => {
    const baseList = availableTags.filter(tag => 
      !selectedTags.some(selected => selected.toLowerCase() === tag.name.toLowerCase())
    )
    if (tagInput.trim() === '') {
      setFilteredTags(baseList)
    } else {
      const filtered = baseList.filter(tag =>
        tag.name.toLowerCase().includes(tagInput.toLowerCase())
      )
      setFilteredTags(filtered)
    }
    console.log('[TaskForm] Filtered tags:', filteredTags.length, 'Show dropdown:', showTagDropdown)
  }, [tagInput, availableTags, selectedTags])

  // Reset highlighted index when filtered tags change
  useEffect(() => {
    setHighlightedTagIndex(-1)
  }, [filteredTags])

  // Reset highlighted index when dropdown closes
  useEffect(() => {
    if (!showTagDropdown) {
      setHighlightedTagIndex(-1)
    }
  }, [showTagDropdown])

  // Handle natural language due date input
  useEffect(() => {
    const trimmedText = naturalDueDate.trim()
    if (!trimmedText) {
      setDueDatePreview(null)
      return
    }
    
    setDueDatePreview(describeNaturalDate(trimmedText))
    const parsed = parseNaturalDate(trimmedText)
    if (parsed) {
      setDueDate(parsed)
    }
  }, [naturalDueDate])

  // Handle natural language defer date input
  useEffect(() => {
    const trimmedText = naturalDeferDate.trim()
    if (!trimmedText) {
      setDeferDatePreview(null)
      return
    }
    
    setDeferDatePreview(describeNaturalDate(trimmedText))
    const parsed = parseNaturalDate(trimmedText)
    if (parsed) {
      setDeferDate(parsed)
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

    // Attempt to add the pending tag input before saving
    if (tagInput.trim()) {
      const added = addTagFromInput(tagInput)
      if (!added) {
        return
      }
    }

    const normalizedTags = Array.from(new Set(
      selectedTags
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
    ))

    if (isEditMode) {
      // Edit mode - return partial updates
      // Only include fields that were actually changed
      const updates: Partial<TaskDTO> = {}
      
      // Always update name if it changed (compare trimmed versions to avoid false positives)
      const newName = name.trim()
      const originalName = (task?.name || '').trim()
      if (newName !== originalName) {
        updates.name = newName
      }

      // Only include dueDate if it changed
      const newDueDate = dueDate ? createDueDate(dueDate) : undefined
      const originalDueDate = task?.dueDate ? task.dueDate.split('T')[0] : undefined
      const dueDateChanged = (dueDate || '') !== (originalDueDate || '')
      if (dueDateChanged) {
        updates.dueDate = newDueDate
      }

      // Only include deferDate if it changed
      const newDeferDate = deferDate ? createDeferDate(deferDate) : undefined
      const originalDeferDate = task?.deferDate ? task.deferDate.split('T')[0] : undefined
      const deferDateChanged = (deferDate || '') !== (originalDeferDate || '')
      if (deferDateChanged) {
        updates.deferDate = newDeferDate
      }

      // Only include tags if they changed
      const originalTags = task?.tags || []
      const normalizedOriginal = Array.from(new Set(
        originalTags.map(tag => tag.trim()).filter(tag => tag.length > 0).map(tag => tag.toLowerCase())
      ))
      const normalizedNew = normalizedTags.map(tag => tag.toLowerCase())
      normalizedNew.sort()
      normalizedOriginal.sort()
      const tagsChanged = normalizedNew.length !== normalizedOriginal.length ||
        normalizedNew.some((tag, index) => tag !== normalizedOriginal[index])
      if (tagsChanged) {
        updates.tags = normalizedTags
      }

      // Only include note if it changed (compare trimmed versions to avoid false positives)
      const newNote = note.trim()
      const originalNote = (task?.note || '').trim()
      const noteChanged = newNote !== originalNote
      if (noteChanged) {
        updates.note = newNote || undefined
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
        tags: normalizedTags,
        dueDate: dueDate ? createDueDate(dueDate) : undefined,
        deferDate: deferDate ? createDeferDate(deferDate) : undefined,
      }

      onSave(newTask)
      
      // Reset form after successful creation
      setName('')
      setDueDate('')
      setDeferDate('')
      setSelectedTags([])
      setTagInput('')
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

  const handleKeyDown = (e: React.KeyboardEvent, allowPlainEnter = false) => {
    if (e.key === 'Enter' && (allowPlainEnter || e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault() // Prevent browser save dialog
      handleSave()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const maxVisibleIndex = Math.min(7, filteredTags.length - 1)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredTags.length > 0) {
        setShowTagDropdown(true)
        setHighlightedTagIndex(prev => {
          if (prev < 0) return 0
          return Math.min(prev + 1, maxVisibleIndex)
        })
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (showTagDropdown && filteredTags.length > 0) {
        setHighlightedTagIndex(prev => Math.max(0, prev - 1))
      }
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (showTagDropdown && highlightedTagIndex >= 0 && highlightedTagIndex <= maxVisibleIndex && filteredTags.length > 0) {
        const selectedTag = filteredTags[highlightedTagIndex]
        addTagFromInput(selectedTag.name)
        return
      }
      addTagFromInput(tagInput)
      return
    }

    if (e.key === 'Backspace' && tagInput === '' && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1])
      return
    }

    handleKeyDown(e)
  }

  return (
    <div className="task-editor-inline">
      <div className="editor-field">
        <input
          className="task-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, true)}
          placeholder={isEditMode ? "Task name" : "Type task name and press Enter..."}
          autoFocus
        />
      </div>

      <div className="editor-row">
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
      </div>

      <div className="editor-field context-field-wrapper">
        <label className="field-label">
          Tags {loadingTags && <span className="loading-indicator">Loading...</span>}
        </label>
        <div className="selected-tags">
          {selectedTags.length === 0 && (
            <span className="tag-placeholder">No tags selected</span>
          )}
          {selectedTags.map(tag => (
            <span key={tag} className="tag-chip">
              <span className="tag-name">{tag}</span>
              <button
                type="button"
                className="tag-remove-btn"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="context-autocomplete">
          <input
            className="task-context-input"
            type="text"
            value={tagInput}
            onChange={(e) => {
              setTagInput(e.target.value)
              setShowTagDropdown(true)
            }}
            onFocus={() => {
              setShowTagDropdown(true)
            }}
            onBlur={() => setTimeout(() => setShowTagDropdown(false), 200)}
            onKeyDown={handleTagInputKeyDown}
            placeholder="Type to add tag"
          />
          {showTagDropdown && filteredTags.length > 0 && (
            <div className="context-dropdown">
              {filteredTags.slice(0, 8).map((tag, index) => (
                <div
                  key={tag.id}
                  className={`context-option ${index === highlightedTagIndex ? 'highlighted' : ''}`}
                  onClick={() => addTagFromInput(tag.name)}
                  onMouseEnter={() => setHighlightedTagIndex(index)}
                >
                  {tag.name}
                </div>
              ))}
              {filteredTags.length > 8 && (
                <div className="context-option-more">
                  + {filteredTags.length - 8} more
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
        Enter or ⌘Enter to save • Esc to cancel
      </div>
    </div>
  )
}

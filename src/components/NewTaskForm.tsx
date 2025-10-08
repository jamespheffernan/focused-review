import { useState, useEffect } from 'react'
import type { TaskDTO, TaskStatus } from '../types'
import { omnifocusBridge } from '../services/omnifocus-bridge'

interface NewTaskFormProps {
  projectId: string
  onSave: (task: Omit<TaskDTO, 'id' | 'lastModified' | 'syncState'>) => void
  onCancel: () => void
}

export default function NewTaskForm({ projectId, onSave, onCancel }: NewTaskFormProps) {
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [deferDate, setDeferDate] = useState('')
  const [context, setContext] = useState('')
  const [note, setNote] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [error, setError] = useState('')
  const [availableContexts, setAvailableContexts] = useState<Array<{id: string; name: string}>>([])
  const [loadingContexts, setLoadingContexts] = useState(false)
  const [showContextDropdown, setShowContextDropdown] = useState(false)
  const [filteredContexts, setFilteredContexts] = useState<Array<{id: string; name: string}>>([])

  // Fetch contexts from OmniFocus
  useEffect(() => {
    const fetchContexts = async () => {
      console.log('[NewTaskForm] Starting to fetch contexts...')
      setLoadingContexts(true)
      try {
        const contexts = await omnifocusBridge.getContexts()
        console.log('[NewTaskForm] Received contexts:', contexts)
        setAvailableContexts(contexts)
        setFilteredContexts(contexts)
        console.log(`[NewTaskForm] Loaded ${contexts.length} contexts from OmniFocus`)
      } catch (error) {
        console.error('[NewTaskForm] Failed to fetch contexts:', error)
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
    console.log('[NewTaskForm] Filtered contexts:', filteredContexts.length, 'Show dropdown:', showContextDropdown)
  }, [context, availableContexts])

  const handleSave = () => {
    if (!name.trim()) {
      setError('Task name is required')
      return
    }

    const newTask: Omit<TaskDTO, 'id' | 'lastModified' | 'syncState'> = {
      projectId,
      name: name.trim(),
      status: 'available' as TaskStatus,
      flagged: false,
      completed: false,
      note: note.trim() || undefined,
      context: context.trim() || undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      deferDate: deferDate ? new Date(deferDate).toISOString() : undefined,
    }

    onSave(newTask)
    // Reset form
    setName('')
    setDueDate('')
    setDeferDate('')
    setContext('')
    setNote('')
    setShowDetails(false)
    setError('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave()
    } else if (e.key === 'Escape') {
      onCancel()
    } else if (e.key === 'Enter' && !showDetails && name.trim()) {
      // Quick add: Enter key saves task with just name
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div className="new-task-form">
      <div className="task-editor-inline">
        <div className="editor-field">
          <input
            className="task-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type task name and press Enter..."
            autoFocus
          />
        </div>

        {showDetails && (
          <>
            <div className="editor-row">
              <div className="editor-field">
                <label className="field-label">Due Date</label>
                <input
                  className="task-date-input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder="Due date"
                />
              </div>

              <div className="editor-field">
                <label className="field-label">Defer Date</label>
                <input
                  className="task-date-input"
                  type="date"
                  value={deferDate}
                  onChange={(e) => setDeferDate(e.target.value)}
                  placeholder="Defer until"
                />
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
                    console.log('[NewTaskForm] Context input focused, showing dropdown')
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
          </>
        )}

        {error && <div className="editor-error">{error}</div>}

        <div className="task-editor-actions">
          {!showDetails && (
            <button 
              className="details-btn" 
              onClick={() => setShowDetails(true)}
              type="button"
            >
              + Add Details
            </button>
          )}
          <button className="save-btn" onClick={handleSave} type="button">
            {showDetails ? 'Save' : 'Add Task'}
          </button>
          <button className="cancel-btn" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>

        <div className="editor-hint">
          {showDetails ? '⌘Enter to save • Esc to cancel' : 'Enter to add • Esc to cancel'}
        </div>
      </div>
    </div>
  )
}


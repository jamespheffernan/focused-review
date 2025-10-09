import { useState } from 'react'
import type { TaskDTO } from '../types'
import TaskEditor from './TaskEditor'
import { parseNaturalDate, describeNaturalDate } from '../utils/date-parser'

interface TaskItemProps {
  task: TaskDTO
  onUpdate: (updates: Partial<TaskDTO>) => void
  onDelete: () => void
  onComplete: (completed: boolean) => void
  isEditing: boolean
  onEditToggle: () => void
}

export default function TaskItem({ 
  task, 
  onUpdate, 
  // onDelete, // Not used in simplified view
  onComplete,
  isEditing, 
  onEditToggle 
}: TaskItemProps) {
  const [isEditingDate, setIsEditingDate] = useState(false)
  const [editingDueDate, setEditingDueDate] = useState(task.dueDate ? task.dueDate.split('T')[0] : '')
  const [naturalDateInput, setNaturalDateInput] = useState('')
  const [datePreview, setDatePreview] = useState<string | null>(null)

  // Show TaskEditor when in edit mode
  if (isEditing) {
    return (
      <TaskEditor
        task={task}
        onSave={(updates) => {
          onUpdate(updates)
          onEditToggle()
        }}
        onCancel={onEditToggle}
      />
    )
  }

  // Format date helper
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const now = new Date()
    const isOverdue = date < now
    const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { formatted, isOverdue }
  }

  const dueInfo = formatDate(task.dueDate)

  // Helper to parse date from YYYY-MM-DD to ISO
  const createDueDate = (dateString: string): string => {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setHours(21, 0, 0, 0)
    return date.toISOString()
  }

  // Handle date save
  const handleDateSave = () => {
    if (editingDueDate) {
      onUpdate({ dueDate: createDueDate(editingDueDate) })
    } else {
      onUpdate({ dueDate: undefined })
    }
    setIsEditingDate(false)
    setNaturalDateInput('')
    setDatePreview(null)
  }

  // Handle natural language input
  const handleNaturalDateChange = (text: string) => {
    setNaturalDateInput(text)
    if (text.trim()) {
      const parsed = parseNaturalDate(text)
      const preview = describeNaturalDate(text)
      setDatePreview(preview)
      if (parsed) {
        setEditingDueDate(parsed)
      }
    } else {
      setDatePreview(null)
    }
  }

  // Simplified view: checkbox + task name + metadata
  return (
    <div className={`task-card ${task.completed ? 'completed' : ''} ${task.flagged ? 'flagged' : ''}`}>
      <div className="task-main">
        <button 
          className="task-complete-btn"
          onClick={(e) => {
            e.stopPropagation() // Prevent triggering edit mode
            onComplete(!task.completed)
          }}
          title={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
          aria-label={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {task.completed ? '✓' : '○'}
        </button>

        <div 
          className="task-content" 
          onClick={onEditToggle}
        >
          <div className="task-name">{task.name}</div>
          {(task.context || task.dueDate) && (
            <div className="task-meta">
              {task.context && (
                <span 
                  className="context-tag clickable"
                  onClick={(e) => {
                    e.stopPropagation()
                    alert(`Filter by context: ${task.context}`)
                  }}
                  title="Click to filter by context"
                  style={{ cursor: 'pointer' }}
                >
                  🏷️ {task.context}
                </span>
              )}
              {dueInfo && !isEditingDate && (
                <span 
                  className={`due-date ${dueInfo.isOverdue ? 'overdue' : ''} clickable`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsEditingDate(true)
                    setEditingDueDate(task.dueDate ? task.dueDate.split('T')[0] : '')
                  }}
                  title="Click to edit date"
                  style={{ cursor: 'pointer' }}
                >
                  📅 {dueInfo.formatted}
                </span>
              )}
              {isEditingDate && (
                <div 
                  className="inline-date-editor"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}
                >
                  <input
                    type="date"
                    value={editingDueDate}
                    onChange={(e) => setEditingDueDate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleDateSave()
                      if (e.key === 'Escape') {
                        setIsEditingDate(false)
                        setNaturalDateInput('')
                        setDatePreview(null)
                      }
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: 'white',
                      fontSize: '0.85em'
                    }}
                    autoFocus
                  />
                  <input
                    type="text"
                    value={naturalDateInput}
                    onChange={(e) => handleNaturalDateChange(e.target.value)}
                    placeholder="Or: tomorrow, next Friday..."
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: 'white',
                      fontSize: '0.8em',
                      opacity: 0.9
                    }}
                  />
                  {datePreview && (
                    <div style={{ fontSize: '0.75em', color: '#4CAF50' }}>
                      ✓ {datePreview}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={handleDateSave}
                      style={{
                        background: 'rgba(76, 175, 80, 0.3)',
                        border: '1px solid rgba(76, 175, 80, 0.5)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        color: 'white',
                        fontSize: '0.75em',
                        cursor: 'pointer'
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingDate(false)
                        setNaturalDateInput('')
                        setDatePreview(null)
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        color: 'white',
                        fontSize: '0.75em',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

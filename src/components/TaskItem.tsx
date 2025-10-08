import type { TaskDTO } from '../types'
import TaskEditor from './TaskEditor'

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
                <span className="context-tag">🏷️ {task.context}</span>
              )}
              {dueInfo && (
                <span className={`due-date ${dueInfo.isOverdue ? 'overdue' : ''}`}>
                  📅 {dueInfo.formatted}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

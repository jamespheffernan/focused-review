import type { TaskDTO } from '../types'
import TaskForm from './TaskForm'

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
  // Show TaskForm when in edit mode
  if (isEditing) {
    return (
      <TaskForm
        projectId={task.projectId}
        task={task}
        onSave={(updates) => {
          onUpdate(updates as Partial<TaskDTO>)
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

  const taskTags = Array.isArray(task.tags) && task.tags.length > 0
    ? task.tags
    : (task.context ? [task.context] : [])

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
          {(taskTags.length > 0 || task.dueDate) && (
            <div className="task-meta">
              {taskTags.length > 0 && (
                <div className="task-tags">
                  {taskTags.map(tag => (
                    <span 
                      key={tag}
                      className="context-tag clickable"
                      onClick={(e) => {
                        e.stopPropagation()
                        alert(`Filter by tag: ${tag}`)
                      }}
                      title="Click to filter by tag"
                      style={{ cursor: 'pointer' }}
                    >
                      🏷️ {tag}
                    </span>
                  ))}
                </div>
              )}
              {dueInfo && (
                <span 
                  className={`due-date ${dueInfo.isOverdue ? 'overdue' : ''}`}
                  title={`Due ${dueInfo.formatted}${dueInfo.isOverdue ? ' (overdue)' : ''}`}
                >
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
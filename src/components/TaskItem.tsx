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

  // Simplified view: checkbox + task name only
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
        </div>
      </div>
    </div>
  )
}

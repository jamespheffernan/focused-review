import { useState, useEffect } from 'react'
import type { TaskDTO } from '../types'
import { fetchTasksForProject, createTask, updateTask } from '../repos/tasksRepo'
import TaskItem from './TaskItem'
import TaskForm from './TaskForm'
import { taskSyncQueue } from '../services/taskSyncQueue'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface TaskListProps {
  projectId: string
  onTaskUpdate: (taskId: string, updates: Partial<TaskDTO>) => void
  onTaskDelete: (taskId: string) => void
  showFilter?: boolean
  showStatistics?: boolean
}

export default function TaskList({ 
  projectId, 
  onTaskUpdate, 
  onTaskDelete
}: TaskListProps) {
  
  const [tasks, setTasks] = useState<TaskDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [showNewTaskForm, setShowNewTaskForm] = useState(false)
  const [failedSyncCount, setFailedSyncCount] = useState(0)

  // Load tasks for the project
  useEffect(() => {
    loadTasks()
  }, [projectId])

  // Subscribe to sync queue changes
  useEffect(() => {
    const unsubscribe = taskSyncQueue.onChange(() => {
      setFailedSyncCount(taskSyncQueue.getFailedCount())
    })
    
    // Set initial count
    setFailedSyncCount(taskSyncQueue.getFailedCount())
    
    return unsubscribe
  }, [])

  const loadTasks = async () => {
    try {
      setLoading(true)
      setError(null)
      const projectTasks = await fetchTasksForProject(projectId)
      setTasks(projectTasks)
    } catch (err) {
      console.error('Error loading tasks:', err)
      setError('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  const handleTaskUpdate = async (taskId: string, updates: Partial<TaskDTO>) => {
    try {
      // Optimistic update: Update local state immediately
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { ...task, ...updates } : task
        )
      )
      
      // Update IndexedDB immediately (non-blocking)
      updateTask(taskId, updates).catch(error => {
        console.error('Error updating task in IndexedDB:', error)
      })
      
      // Queue background sync to OmniFocus
      taskSyncQueue.add(taskId, updates)
      
      // Call parent handler (may do additional work)
      onTaskUpdate(taskId, updates)
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    try {
      await onTaskDelete(taskId)
      await loadTasks() // Reload to get fresh data
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const handleTaskComplete = async (taskId: string, completed: boolean) => {
    // In OmniFocus 4, completedDate is read-only and set automatically by markComplete()
    await handleTaskUpdate(taskId, { 
      completed
      // Don't set completedDate - it's handled by OmniFocus when using markComplete()
    })
  }

  const handleTaskCreate = async (taskData: Omit<TaskDTO, 'id' | 'lastModified' | 'syncState'>) => {
    try {
      const newTask = await createTask(projectId, taskData)
      setTasks(prev => [...prev, newTask])
      setShowNewTaskForm(false)
      console.log('Task created successfully:', newTask)
    } catch (error) {
      console.error('Error creating task:', error)
      setError('Failed to create task')
    }
  }

  // Sort tasks: next → available → blocked → completed
  const sortedTasks = [...tasks].sort((a, b) => {
    // Priority order: next > available > blocked > completed
    const getPriority = (task: TaskDTO) => {
      if (task.completed) return 4
      if (task.status === 'blocked') return 3
      if (task.status === 'available' && !task.flagged) return 2
      if (task.status === 'next' || task.flagged) return 1
      return 5
    }
    return getPriority(a) - getPriority(b)
  })

  if (loading) {
    return (
      <div className="task-flow">
        <div className="task-loading">Loading tasks...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="task-flow">
        <div className="task-error">{error}</div>
      </div>
    )
  }

  return (
    <div className="task-flow">
      {/* Failed Sync Indicator */}
      {failedSyncCount > 0 && (
        <div className="sync-error-banner">
          <span className="sync-error-message" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={16} /> {failedSyncCount} task{failedSyncCount > 1 ? 's' : ''} failed to sync
          </span>
          <button 
            className="retry-sync-btn"
            onClick={() => taskSyncQueue.retryFailed()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}
      
      {/* Add Task Button/Form */}
      <div className="task-list-header">
        {!showNewTaskForm ? (
          <button 
            className="add-task-btn"
            onClick={() => setShowNewTaskForm(true)}
          >
            + Add Task
          </button>
        ) : (
          <TaskForm
            projectId={projectId}
            onSave={(taskData) => {
              // TaskForm will pass the correct type for create mode
              if ('projectId' in taskData && taskData.projectId) {
                handleTaskCreate(taskData as Omit<TaskDTO, 'id' | 'lastModified' | 'syncState'>)
              }
            }}
            onCancel={() => setShowNewTaskForm(false)}
          />
        )}
      </div>

      {/* Task List - Show only 3 most recent */}
      {tasks.length === 0 && !showNewTaskForm ? (
        <div className="task-empty">
          <div className="task-empty-cta">
            <button 
              className="add-task-btn"
              onClick={() => setShowNewTaskForm(true)}
              type="button"
            >
              + Add Task
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Simplified flat list - show top 3 tasks only */}
          {sortedTasks.slice(0, 3).map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onUpdate={(updates) => handleTaskUpdate(task.id, updates)}
              onDelete={() => handleTaskDelete(task.id)}
              onComplete={(completed) => handleTaskComplete(task.id, completed)}
              isEditing={editingTaskId === task.id}
              onEditToggle={() => setEditingTaskId(editingTaskId === task.id ? null : task.id)}
            />
          ))}
          {sortedTasks.length > 3 && (
            <div className="task-more-indicator">
              + {sortedTasks.length - 3} more {sortedTasks.length - 3 === 1 ? 'task' : 'tasks'}
            </div>
          )}
        </>
      )}
    </div>
  )
}

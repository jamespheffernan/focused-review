import { useState, useEffect, useRef } from 'react'

interface QuickInboxCaptureProps {
  onSave: (taskName: string) => Promise<void>
  onCancel: () => void
}

export default function QuickInboxCapture({ onSave, onCancel }: QuickInboxCaptureProps) {
  const [taskName, setTaskName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const handleSave = async () => {
    if (!taskName.trim()) {
      setError('Task name is required')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await onSave(taskName.trim())
      // Clear form after successful save
      setTaskName('')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading) {
        handleSave()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (!isLoading) {
        onCancel()
      }
    }
  }

  return (
    <div className="quick-inbox-capture-overlay">
      <div className="quick-inbox-capture-form">
        <div className="quick-inbox-header">
          <h3>Add to Inbox</h3>
        </div>
        
        <div className="quick-inbox-input-container">
          <input
            ref={inputRef}
            className="quick-inbox-input"
            type="text"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What needs to be done?"
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="quick-inbox-error">
            {error}
          </div>
        )}

        <div className="quick-inbox-actions">
          <button
            className="quick-inbox-cancel-btn"
            onClick={onCancel}
            disabled={isLoading}
            type="button"
          >
            Cancel
          </button>
          <button
            className="quick-inbox-add-btn"
            onClick={handleSave}
            disabled={isLoading || !taskName.trim()}
            type="button"
          >
            {isLoading ? 'Adding...' : 'Add Task'}
          </button>
        </div>

        <div className="quick-inbox-hint">
          Enter to save • Esc to cancel
        </div>
      </div>
    </div>
  )
}

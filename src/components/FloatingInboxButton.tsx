import { useState } from 'react'
import { Plus } from 'lucide-react'
import QuickInboxCapture from './QuickInboxCapture'

interface FloatingInboxButtonProps {
  onCreateInboxTask: (taskName: string) => Promise<void>
}

export default function FloatingInboxButton({ onCreateInboxTask }: FloatingInboxButtonProps) {
  const [showQuickCapture, setShowQuickCapture] = useState(false)

  const handleSave = async (taskName: string) => {
    await onCreateInboxTask(taskName)
    setShowQuickCapture(false)
  }

  const handleCancel = () => {
    setShowQuickCapture(false)
  }

  return (
    <>
      <button
        className="floating-inbox-button"
        onClick={() => setShowQuickCapture(true)}
        title="Add task to Inbox"
        type="button"
      >
        <Plus size={24} />
      </button>

      {showQuickCapture && (
        <QuickInboxCapture
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </>
  )
}

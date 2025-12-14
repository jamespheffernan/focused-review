import { useState } from 'react'
import type { PlanningNextAction } from '../../types'
import { X, Check, Edit2 } from 'lucide-react'
import ContextSelector from './ContextSelector'

interface Props {
  action: PlanningNextAction
  isCurrentStage: boolean
  onUpdate: (actionId: string, updates: Partial<PlanningNextAction>) => void
  onDelete: (actionId: string) => void
}

export default function NextActionItem({ action, isCurrentStage, onUpdate, onDelete }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(action.text)
  
  const handleSave = () => {
    if (editText.trim() && editText.trim() !== action.text) {
      onUpdate(action.id, { text: editText.trim() })
    }
    setIsEditing(false)
  }
  
  const handleToggleComplete = () => {
    onUpdate(action.id, { completed: !action.completed })
  }
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 12px',
      background: action.completed 
        ? 'rgba(255, 255, 255, 0.05)' 
        : 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '6px',
      opacity: action.completed ? 0.6 : 1
    }}>
      <button
        onClick={handleToggleComplete}
        disabled={!isCurrentStage}
        style={{
          background: action.completed ? '#22c55e' : 'transparent',
          border: action.completed ? 'none' : '2px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '4px',
          width: '20px',
          height: '20px',
          cursor: isCurrentStage ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        {action.completed && <Check size={12} color="#000" />}
      </button>
      
      {isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave()
              } else if (e.key === 'Escape') {
                setEditText(action.text)
                setIsEditing(false)
              }
            }}
            autoFocus
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              borderRadius: '4px',
              color: 'white',
              padding: '4px 8px',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button
            onClick={handleSave}
            style={{
              background: 'rgba(139, 92, 246, 0.3)',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              padding: '4px 8px',
              cursor: 'pointer'
            }}
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => {
              setEditText(action.text)
              setIsEditing(false)
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              padding: '4px 8px',
              cursor: 'pointer'
            }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <span style={{
            flex: 1,
            fontSize: '13px',
            color: action.completed 
              ? 'rgba(255, 255, 255, 0.5)' 
              : 'rgba(255, 255, 255, 0.9)',
            textDecoration: action.completed ? 'line-through' : 'none'
          }}>
            {action.text}
          </span>
          
          <ContextSelector
            value={action.context}
            onChange={(context) => onUpdate(action.id, { context })}
            disabled={!isCurrentStage || action.completed}
          />
          
          {isCurrentStage && !action.completed && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => onDelete(action.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={14} />
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}


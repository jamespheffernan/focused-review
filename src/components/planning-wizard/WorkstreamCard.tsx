import { useState } from 'react'
import type { PlanningWorkstream, PlanningBrainstormItem } from '../../types'
import { X, GripVertical, Edit2, Check, X as XIcon } from 'lucide-react'

interface Props {
  workstream: PlanningWorkstream
  items: PlanningBrainstormItem[]
  isCurrentStage: boolean
  onRename: (workstreamId: string, newName: string) => void
  onDelete: (workstreamId: string) => void
  onItemDrop: (itemId: string, workstreamId: string) => void
}

export default function WorkstreamCard({ 
  workstream, 
  items, 
  isCurrentStage, 
  onRename, 
  onDelete,
  onItemDrop 
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(workstream.name)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  
  const workstreamItems = items.filter(item => workstream.itemIds.includes(item.id))
  
  const handleRename = () => {
    if (editName.trim() && editName.trim() !== workstream.name) {
      onRename(workstream.id, editName.trim())
    }
    setIsEditing(false)
  }
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(true)
  }
  
  const handleDragLeave = () => {
    setIsDraggingOver(false)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
    
    const itemId = e.dataTransfer.getData('text/plain')
    if (itemId) {
      onItemDrop(itemId, workstream.id)
    }
  }
  
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        background: isDraggingOver 
          ? 'rgba(59, 130, 246, 0.2)' 
          : 'rgba(255, 255, 255, 0.08)',
        border: isDraggingOver 
          ? '2px dashed #3b82f6' 
          : '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '16px',
        minHeight: '120px',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <GripVertical 
            size={16} 
            style={{ 
              color: 'rgba(255, 255, 255, 0.4)',
              cursor: 'grab'
            }} 
          />
          
          {isEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename()
                  } else if (e.key === 'Escape') {
                    setEditName(workstream.name)
                    setIsEditing(false)
                  }
                }}
                autoFocus
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.5)',
                  borderRadius: '4px',
                  color: 'white',
                  padding: '4px 8px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleRename}
                style={{
                  background: 'rgba(59, 130, 246, 0.3)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => {
                  setEditName(workstream.name)
                  setIsEditing(false)
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <XIcon size={14} />
              </button>
            </div>
          ) : (
            <>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '600',
                color: 'white',
                margin: 0,
                flex: 1
              }}>
                {workstream.name}
              </h3>
              {isCurrentStage && (
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
                    onClick={() => onDelete(workstream.id)}
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
      </div>
      
      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {workstreamItems.length === 0 ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '12px',
            fontStyle: 'italic'
          }}>
            Drop brainstorm items here
          </div>
        ) : (
          workstreamItems.map(item => (
            <div
              key={item.id}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                padding: '8px 10px',
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.9)'
              }}
            >
              {item.text}
            </div>
          ))
        )}
      </div>
      
      {/* Count badge */}
      {workstreamItems.length > 0 && (
        <div style={{
          marginTop: '8px',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.5)',
          textAlign: 'right'
        }}>
          {workstreamItems.length} item{workstreamItems.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

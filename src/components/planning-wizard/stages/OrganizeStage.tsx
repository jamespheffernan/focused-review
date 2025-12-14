import { useState } from 'react'
import type { PlanningSessionDTO } from '../../../types'
import { ArrowRight, ArrowLeft, Plus, GripVertical } from 'lucide-react'
import StageHeader from '../StageHeader'
import WorkstreamCard from '../WorkstreamCard'
import { addWorkstream, moveItemToWorkstream, moveItemToUnorganized } from '../../../repos/planningSessionsRepo'

interface Props {
  session: PlanningSessionDTO
  isCurrentStage: boolean
  onUpdate: (updates: Partial<PlanningSessionDTO>) => Promise<void>
  onContinue: () => void
  onBack: () => void
}

export default function OrganizeStage({ session, isCurrentStage, onUpdate, onContinue, onBack }: Props) {
  const [newWorkstreamName, setNewWorkstreamName] = useState('')
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  
  const unorganizedItems = session.brainstormItems.filter(
    item => session.unorganizedItemIds.includes(item.id)
  )
  
  const sortedWorkstreams = [...session.workstreams].sort((a, b) => a.order - b.order)
  
  const handleCreateWorkstream = async () => {
    if (!newWorkstreamName.trim()) return
    
    try {
      const newWorkstream = await addWorkstream(session.id, newWorkstreamName.trim())
      await onUpdate({
        workstreams: [...session.workstreams, newWorkstream]
      })
      setNewWorkstreamName('')
    } catch (error) {
      console.error('Failed to create workstream:', error)
    }
  }
  
  const handleRenameWorkstream = async (workstreamId: string, newName: string) => {
    const updatedWorkstreams = session.workstreams.map(ws =>
      ws.id === workstreamId ? { ...ws, name: newName } : ws
    )
    await onUpdate({ workstreams: updatedWorkstreams })
  }
  
  const handleDeleteWorkstream = async (workstreamId: string) => {
    const workstream = session.workstreams.find(ws => ws.id === workstreamId)
    if (!workstream) return
    
    // Move items back to unorganized
    const updatedUnorganized = [...new Set([...session.unorganizedItemIds, ...workstream.itemIds])]
    
    // Remove workstream
    const updatedWorkstreams = session.workstreams
      .filter(ws => ws.id !== workstreamId)
      .map((ws, idx) => ({ ...ws, order: idx }))
    
    // Mark items as unorganized
    const updatedItems = session.brainstormItems.map(item =>
      workstream.itemIds.includes(item.id) ? { ...item, organized: false } : item
    )
    
    await onUpdate({
      workstreams: updatedWorkstreams,
      unorganizedItemIds: updatedUnorganized,
      brainstormItems: updatedItems
    })
  }
  
  const handleItemDrop = async (itemId: string, workstreamId: string) => {
    try {
      await moveItemToWorkstream(session.id, itemId, workstreamId)
      
      const updatedUnorganized = session.unorganizedItemIds.filter(id => id !== itemId)
      const updatedWorkstreams = session.workstreams.map(ws =>
        ws.id === workstreamId
          ? { ...ws, itemIds: [...ws.itemIds, itemId] }
          : { ...ws, itemIds: ws.itemIds.filter(id => id !== itemId) }
      )
      const updatedItems = session.brainstormItems.map(item =>
        item.id === itemId ? { ...item, organized: true } : item
      )
      
      await onUpdate({
        unorganizedItemIds: updatedUnorganized,
        workstreams: updatedWorkstreams,
        brainstormItems: updatedItems
      })
    } catch (error) {
      console.error('Failed to move item to workstream:', error)
    }
  }
  
  const handleMoveToUnorganized = async (itemId: string) => {
    try {
      await moveItemToUnorganized(session.id, itemId)
      
      const updatedUnorganized = session.unorganizedItemIds.includes(itemId)
        ? session.unorganizedItemIds
        : [...session.unorganizedItemIds, itemId]
      const updatedWorkstreams = session.workstreams.map(ws => ({
        ...ws,
        itemIds: ws.itemIds.filter(id => id !== itemId)
      }))
      const updatedItems = session.brainstormItems.map(item =>
        item.id === itemId ? { ...item, organized: false } : item
      )
      
      await onUpdate({
        unorganizedItemIds: updatedUnorganized,
        workstreams: updatedWorkstreams,
        brainstormItems: updatedItems
      })
    } catch (error) {
      console.error('Failed to move item to unorganized:', error)
    }
  }
  
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('text/plain', itemId)
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleUnorganizedDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(true)
  }
  
  const handleUnorganizedDragLeave = () => {
    setIsDraggingOver(false)
  }
  
  const handleUnorganizedDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
    
    const itemId = e.dataTransfer.getData('text/plain')
    if (itemId) {
      await handleMoveToUnorganized(itemId)
    }
  }
  
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.08)',
      border: isCurrentStage ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
      borderLeft: '3px solid #3b82f6',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: isCurrentStage ? '0 0 0 1px rgba(59, 130, 246, 0.3)' : 'none'
    }}>
      <StageHeader
        stageNumber={4}
        stageName="Organize"
        description="Group related items into workstreams. What are the major components or themes?"
        color="#3b82f6"
      />
      
      <div style={{ marginTop: '24px' }}>
        {/* Create workstream */}
        {isCurrentStage && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <input
              type="text"
              value={newWorkstreamName}
              onChange={(e) => setNewWorkstreamName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreateWorkstream()
                }
              }}
              placeholder="Create a new workstream..."
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: 'white',
                padding: '10px 12px',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <button
              onClick={handleCreateWorkstream}
              disabled={!newWorkstreamName.trim()}
              style={{
                background: newWorkstreamName.trim() ? '#3b82f6' : 'rgba(59, 130, 246, 0.3)',
                border: 'none',
                borderRadius: '6px',
                color: newWorkstreamName.trim() ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                padding: '10px 16px',
                fontSize: '13px',
                cursor: newWorkstreamName.trim() ? 'pointer' : 'not-allowed',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={14} />
              Add Workstream
            </button>
          </div>
        )}
        
        {/* Workstreams grid */}
        {sortedWorkstreams.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            {sortedWorkstreams.map(workstream => (
              <WorkstreamCard
                key={workstream.id}
                workstream={workstream}
                items={session.brainstormItems}
                isCurrentStage={isCurrentStage}
                onRename={handleRenameWorkstream}
                onDelete={handleDeleteWorkstream}
                onItemDrop={handleItemDrop}
              />
            ))}
          </div>
        )}
        
        {/* Unorganized items */}
        <div>
          <h3 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '12px',
            letterSpacing: '0.5px'
          }}>
            UNORGANIZED ITEMS
          </h3>
          
          <div
            onDragOver={handleUnorganizedDragOver}
            onDragLeave={handleUnorganizedDragLeave}
            onDrop={handleUnorganizedDrop}
            style={{
              background: isDraggingOver 
                ? 'rgba(59, 130, 246, 0.2)' 
                : 'rgba(255, 255, 255, 0.05)',
              border: isDraggingOver 
                ? '2px dashed #3b82f6' 
                : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '16px',
              minHeight: '100px',
              transition: 'all 0.2s ease'
            }}
          >
            {unorganizedItems.length === 0 ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '12px',
                fontStyle: 'italic'
              }}>
                {isCurrentStage ? 'Drag items here to unorganize them' : 'All items organized'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {unorganizedItems.map(item => (
                  <div
                    key={item.id}
                    draggable={isCurrentStage}
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      cursor: isCurrentStage ? 'grab' : 'default',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      if (isCurrentStage) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isCurrentStage) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                      }
                    }}
                  >
                    {isCurrentStage && (
                      <GripVertical 
                        size={14} 
                        style={{ 
                          color: 'rgba(255, 255, 255, 0.4)',
                          flexShrink: 0
                        }} 
                      />
                    )}
                    <span style={{
                      fontSize: '13px',
                      color: 'rgba(255, 255, 255, 0.9)',
                      flex: 1
                    }}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      {isCurrentStage && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: '20px' 
        }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              color: 'white',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <button
            onClick={onContinue}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Continue
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

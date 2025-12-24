import React, { useState } from 'react'
import type { PlanningSessionDTO } from '../../../types'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import StageHeader from '../StageHeader'
import BrainstormCanvas from '../BrainstormCanvas'
import TriggerList from '../TriggerList'
import { addBrainstormItem, updateBrainstormPosition, removeBrainstormItem } from '../../../repos/planningSessionsRepo'
import { getInitialPosition } from '../../../hooks/useCanvasPlacement'

interface BrainstormStageProps {
  session: PlanningSessionDTO
  isCurrentStage: boolean
  onUpdate: (updates: Partial<PlanningSessionDTO>) => Promise<void>
  onContinue: () => void
  onBack: () => void
}

const BrainstormStage: React.FC<BrainstormStageProps> = ({ session, isCurrentStage, onUpdate, onContinue, onBack }) => {
  const [newItemText, setNewItemText] = useState('')
  const [saving, setSaving] = useState(false)
  
  const handleAddItem = async () => {
    if (!newItemText.trim() || saving) return
    
    setSaving(true)
    try {
      // Split by comma to allow adding multiple items at once
      const itemTexts = newItemText
        .split(',')
        .map(text => text.trim())
        .filter(text => text.length > 0)
      
      if (itemTexts.length === 0) return
      
      const newItems: typeof session.brainstormItems = []
      let currentItems = [...session.brainstormItems]
      
      for (const text of itemTexts) {
        const position = getInitialPosition(currentItems)
        await addBrainstormItem(session.id, text, position)
        
        const newItem = {
          id: crypto.randomUUID(),
          text,
          createdAt: new Date().toISOString(),
          organized: false,
          position
        }
        
        newItems.push(newItem)
        currentItems = [...currentItems, newItem]
      }
      
      await onUpdate({
        brainstormItems: [...session.brainstormItems, ...newItems],
        unorganizedItemIds: [...session.unorganizedItemIds, ...newItems.map(item => item.id)]
      })
      
      setNewItemText('')
    } catch (error) {
      console.error('Failed to add brainstorm item:', error)
    } finally {
      setSaving(false)
    }
  }
  
  const handlePositionChange = async (itemId: string, position: { x: number; y: number }) => {
    try {
      await updateBrainstormPosition(session.id, itemId, position)
      
      const updatedItems = session.brainstormItems.map(item =>
        item.id === itemId ? { ...item, position } : item
      )
      
      await onUpdate({ brainstormItems: updatedItems })
    } catch (error) {
      console.error('Failed to update position:', error)
    }
  }
  
  const handleDelete = async (itemId: string) => {
    try {
      await removeBrainstormItem(session.id, itemId)
      
      const updatedItems = session.brainstormItems.filter(item => item.id !== itemId)
      const updatedUnorganized = session.unorganizedItemIds.filter(id => id !== itemId)
      const updatedWorkstreams = session.workstreams.map(ws => ({
        ...ws,
        itemIds: ws.itemIds.filter(id => id !== itemId)
      }))
      
      await onUpdate({
        brainstormItems: updatedItems,
        unorganizedItemIds: updatedUnorganized,
        workstreams: updatedWorkstreams
      })
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }
  
  const handleTriggerSelect = (text: string) => {
    setNewItemText(text)
  }
  
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.08)',
      border: isCurrentStage ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
      borderLeft: '3px solid #22c55e',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: isCurrentStage ? '0 0 0 1px rgba(34, 197, 94, 0.3)' : 'none'
    }}>
      <StageHeader
        stageNumber={3}
        stageName="Brainstorm"
        description="What ideas, thoughts, or considerations come to mind? Capture everything without judgment."
        color="#22c55e"
      />
      
      <div style={{ marginTop: '24px' }}>
        {/* Canvas */}
        <BrainstormCanvas
          items={session.brainstormItems}
          isCurrentStage={isCurrentStage}
          onPositionChange={handlePositionChange}
          onDelete={handleDelete}
        />
        
        {/* Add item input */}
        {isCurrentStage && (
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleAddItem()
                }
              }}
              placeholder="Add ideas (separate multiple with commas)..."
              disabled={saving}
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
              onClick={handleAddItem}
              disabled={!newItemText.trim() || saving}
              style={{
                background: newItemText.trim() && !saving ? '#22c55e' : 'rgba(34, 197, 94, 0.3)',
                border: 'none',
                borderRadius: '6px',
                color: newItemText.trim() && !saving ? '#000' : 'rgba(0, 0, 0, 0.5)',
                padding: '10px 20px',
                fontSize: '13px',
                cursor: newItemText.trim() && !saving ? 'pointer' : 'not-allowed',
                fontWeight: '500'
              }}
            >
              Add
            </button>
          </div>
        )}
        
        {/* Item counter */}
        <div style={{
          marginTop: '12px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.5)',
          textAlign: 'right'
        }}>
          {session.brainstormItems.length} item{session.brainstormItems.length !== 1 ? 's' : ''} captured
        </div>
        
        {/* Trigger list */}
        {isCurrentStage && (
          <TriggerList onSelectTrigger={handleTriggerSelect} />
        )}
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
              background: '#22c55e',
              border: 'none',
              borderRadius: '6px',
              color: '#000',
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

export default BrainstormStage

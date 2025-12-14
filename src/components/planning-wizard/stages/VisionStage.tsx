import { useState, useEffect } from 'react'
import type { PlanningSessionDTO, PlanningSuccessCriterion } from '../../../types'
import { X, ArrowRight, ArrowLeft, GripVertical } from 'lucide-react'
import StageHeader from '../StageHeader'

interface Props {
  session: PlanningSessionDTO
  isCurrentStage: boolean
  onUpdate: (updates: Partial<PlanningSessionDTO>) => Promise<void>
  onContinue: () => void
  onBack: () => void
}

export default function VisionStage({ session, isCurrentStage, onUpdate, onContinue, onBack }: Props) {
  const [description, setDescription] = useState(session.visionDescription)
  const [criteria, setCriteria] = useState<PlanningSuccessCriterion[]>(session.successCriteria)
  const [newCriterion, setNewCriterion] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  
  // Sync with session
  useEffect(() => {
    setDescription(session.visionDescription)
    setCriteria(session.successCriteria)
  }, [session.visionDescription, session.successCriteria])
  
  // Debounced save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (description !== session.visionDescription || 
          JSON.stringify(criteria) !== JSON.stringify(session.successCriteria)) {
        onUpdate({ visionDescription: description, successCriteria: criteria })
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [description, criteria, session.visionDescription, session.successCriteria, onUpdate])
  
  const handleAddCriterion = () => {
    if (!newCriterion.trim()) return
    if (criteria.length >= 20) return
    
    const newItem: PlanningSuccessCriterion = {
      id: crypto.randomUUID(),
      text: newCriterion.trim(),
      completed: false,
      order: criteria.length
    }
    
    setCriteria([...criteria, newItem])
    setNewCriterion('')
  }
  
  const handleRemoveCriterion = (id: string) => {
    const updated = criteria.filter(c => c.id !== id)
      .map((c, idx) => ({ ...c, order: idx }))
    setCriteria(updated)
  }
  
  const handleToggleCriterion = (id: string) => {
    setCriteria(criteria.map(c => 
      c.id === id ? { ...c, completed: !c.completed } : c
    ))
  }
  
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }
  
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    
    const newCriteria = [...criteria]
    const dragged = newCriteria[draggedIndex]
    newCriteria.splice(draggedIndex, 1)
    newCriteria.splice(index, 0, dragged)
    
    // Update order
    const reordered = newCriteria.map((c, idx) => ({ ...c, order: idx }))
    setCriteria(reordered)
    setDraggedIndex(index)
  }
  
  const handleDragEnd = () => {
    setDraggedIndex(null)
  }
  
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.08)',
      border: isCurrentStage ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
      borderLeft: '3px solid #eab308',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: isCurrentStage ? '0 0 0 1px rgba(234, 179, 8, 0.3)' : 'none'
    }}>
      <StageHeader
        stageNumber={2}
        stageName="Vision"
        description="Before you do anything, get a clear picture of what success looks like. Describe the end state: what will be different, who will notice, how will it feel?"
        color="#eab308"
      />
      
      <div style={{ marginTop: '24px' }}>
        {/* Vision description */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px', 
            fontWeight: '600',
            letterSpacing: '1px',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '8px'
          }}>
            VISION DESCRIPTION
            <span style={{ 
              width: '6px', 
              height: '6px', 
              borderRadius: '50%', 
              background: '#eab308' 
            }} />
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
            placeholder="How will I know this is successful? What does 'done' look like?"
            disabled={!isCurrentStage}
            rows={5}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderLeft: '3px solid #eab308',
              borderRadius: '6px',
              color: 'white',
              padding: '12px',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              opacity: isCurrentStage ? 1 : 0.7,
              minHeight: '120px',
              maxHeight: '300px'
            }}
          />
          {description.length > 800 && (
            <div style={{ 
              fontSize: '11px', 
              color: description.length >= 1000 ? '#ef4444' : 'rgba(255, 255, 255, 0.5)',
              textAlign: 'right',
              marginTop: '4px'
            }}>
              {description.length}/1000
            </div>
          )}
        </div>
        
        {/* Success criteria */}
        <div>
          <label style={{ 
            display: 'block',
            fontSize: '11px', 
            fontWeight: '600',
            letterSpacing: '1px',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '4px'
          }}>
            SUCCESS CRITERIA
          </label>
          <p style={{ 
            fontSize: '12px', 
            color: 'rgba(255, 255, 255, 0.5)', 
            margin: '0 0 12px 0' 
          }}>
            Specific indicators, metrics, or observable conditions that define success
          </p>
          
          {/* Add criterion input */}
          {isCurrentStage && criteria.length < 20 && (
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              marginBottom: '12px' 
            }}>
              <input
                type="text"
                value={newCriterion}
                onChange={(e) => setNewCriterion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCriterion()
                  }
                }}
                placeholder="Add a success criterion..."
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  color: 'white',
                  padding: '8px 12px',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleAddCriterion}
                disabled={!newCriterion.trim()}
                style={{
                  background: 'rgba(234, 179, 8, 0.2)',
                  border: '1px solid rgba(234, 179, 8, 0.4)',
                  borderRadius: '6px',
                  color: '#eab308',
                  padding: '8px 16px',
                  fontSize: '13px',
                  cursor: newCriterion.trim() ? 'pointer' : 'not-allowed',
                  opacity: newCriterion.trim() ? 1 : 0.5
                }}
              >
                Add
              </button>
            </div>
          )}
          
          {/* Criteria list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {criteria.map((criterion, index) => (
              <div
                key={criterion.id}
                draggable={isCurrentStage}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  cursor: isCurrentStage ? 'move' : 'default',
                  opacity: draggedIndex === index ? 0.5 : 1,
                  transition: 'opacity 0.2s'
                }}
              >
                {isCurrentStage && (
                  <GripVertical 
                    size={16} 
                    style={{ 
                      color: 'rgba(255, 255, 255, 0.4)',
                      cursor: 'grab'
                    }} 
                  />
                )}
                <input
                  type="checkbox"
                  checked={criterion.completed}
                  onChange={() => handleToggleCriterion(criterion.id)}
                  disabled={!isCurrentStage}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: isCurrentStage ? 'pointer' : 'default'
                  }}
                />
                <span style={{
                  flex: 1,
                  fontSize: '13px',
                  color: criterion.completed 
                    ? 'rgba(255, 255, 255, 0.5)' 
                    : 'rgba(255, 255, 255, 0.85)',
                  textDecoration: criterion.completed ? 'line-through' : 'none'
                }}>
                  {criterion.text}
                </span>
                {isCurrentStage && (
                  <button
                    onClick={() => handleRemoveCriterion(criterion.id)}
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
                )}
              </div>
            ))}
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
              background: '#eab308',
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

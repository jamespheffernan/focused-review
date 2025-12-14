import { useState } from 'react'
import type { PlanningSessionDTO } from '../../../types'
import { ArrowLeft, Plus, CheckCircle } from 'lucide-react'
import StageHeader from '../StageHeader'
import NextActionItem from '../NextActionItem'
import CompletionSummary from '../CompletionSummary'
import { addNextAction, updateNextAction } from '../../../repos/planningSessionsRepo'

interface Props {
  session: PlanningSessionDTO
  isCurrentStage: boolean
  onUpdate: (updates: Partial<PlanningSessionDTO>) => Promise<void>
  onBack: () => void
}

export default function NextActionsStage({ session, isCurrentStage, onUpdate, onBack }: Props) {
  const [newActionText, setNewActionText] = useState('')
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const handleAddAction = async () => {
    if (!newActionText.trim()) return
    
    try {
      const newAction = await addNextAction(
        session.id,
        newActionText.trim(),
        selectedWorkstreamId,
        null
      )
      
      await onUpdate({
        nextActions: [...session.nextActions, newAction]
      })
      
      setNewActionText('')
      setSelectedWorkstreamId(null)
    } catch (error) {
      console.error('Failed to add next action:', error)
    }
  }
  
  const handleUpdateAction = async (actionId: string, updates: Partial<typeof session.nextActions[0]>) => {
    try {
      await updateNextAction(session.id, actionId, updates)
      
      const updatedActions = session.nextActions.map(action =>
        action.id === actionId ? { ...action, ...updates } : action
      )
      
      await onUpdate({ nextActions: updatedActions })
    } catch (error) {
      console.error('Failed to update action:', error)
    }
  }
  
  const handleDeleteAction = async (actionId: string) => {
    const updatedActions = session.nextActions.filter(action => action.id !== actionId)
    await onUpdate({ nextActions: updatedActions })
  }
  
  const handleComplete = () => {
    if (session.nextActions.length === 0) {
      setError('Please define at least one next action to complete planning.')
      return
    }
    
    setError(null)
    setShowSummary(true)
  }
  
  // Group actions by workstream
  const actionsByWorkstream = new Map<string | null, typeof session.nextActions>()
  session.nextActions.forEach(action => {
    const key = action.workstreamId
    if (!actionsByWorkstream.has(key)) {
      actionsByWorkstream.set(key, [])
    }
    actionsByWorkstream.get(key)!.push(action)
  })
  
  const sortedWorkstreams = [...session.workstreams].sort((a, b) => a.order - b.order)
  
  return (
    <>
      <div style={{
        background: 'rgba(255, 255, 255, 0.08)',
        border: isCurrentStage ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
        borderLeft: '3px solid #8b5cf6',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: isCurrentStage ? '0 0 0 1px rgba(139, 92, 246, 0.3)' : 'none'
      }}>
        <StageHeader
          stageNumber={5}
          stageName="Next Actions"
          description="What are the very next physical actions needed to move this project forward?"
          color="#8b5cf6"
        />
        
        <div style={{ marginTop: '24px' }}>
          {/* Add action input */}
          {isCurrentStage && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  value={newActionText}
                  onChange={(e) => setNewActionText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAddAction()
                    }
                  }}
                  placeholder="What's the next action?"
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
                <select
                  value={selectedWorkstreamId || ''}
                  onChange={(e) => setSelectedWorkstreamId(e.target.value || null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: 'white',
                    padding: '10px 12px',
                    fontSize: '13px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Other</option>
                  {sortedWorkstreams.map(ws => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddAction}
                  disabled={!newActionText.trim()}
                  style={{
                    background: newActionText.trim() ? '#8b5cf6' : 'rgba(139, 92, 246, 0.3)',
                    border: 'none',
                    borderRadius: '6px',
                    color: newActionText.trim() ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                    padding: '10px 16px',
                    fontSize: '13px',
                    cursor: newActionText.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
            </div>
          )}
          
          {/* Actions by workstream */}
          {sortedWorkstreams.map(workstream => {
            const actions = actionsByWorkstream.get(workstream.id) || []
            if (actions.length === 0 && !isCurrentStage) return null
            
            return (
              <div key={workstream.id} style={{ marginBottom: '20px' }}>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '10px',
                  letterSpacing: '0.5px'
                }}>
                  {workstream.name.toUpperCase()}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {actions.length === 0 ? (
                    <div style={{
                      padding: '12px',
                      color: 'rgba(255, 255, 255, 0.4)',
                      fontSize: '12px',
                      fontStyle: 'italic',
                      textAlign: 'center'
                    }}>
                      No actions yet
                    </div>
                  ) : (
                    actions.map(action => (
                      <NextActionItem
                        key={action.id}
                        action={action}
                        isCurrentStage={isCurrentStage}
                        onUpdate={handleUpdateAction}
                        onDelete={handleDeleteAction}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
          
          {/* Other actions */}
          {(() => {
            const otherActions = actionsByWorkstream.get(null) || []
            if (otherActions.length === 0 && !isCurrentStage) return null
            
            return (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '10px',
                  letterSpacing: '0.5px'
                }}>
                  OTHER NEXT ACTIONS
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {otherActions.length === 0 ? (
                    <div style={{
                      padding: '12px',
                      color: 'rgba(255, 255, 255, 0.4)',
                      fontSize: '12px',
                      fontStyle: 'italic',
                      textAlign: 'center'
                    }}>
                      No actions yet
                    </div>
                  ) : (
                    otherActions.map(action => (
                      <NextActionItem
                        key={action.id}
                        action={action}
                        isCurrentStage={isCurrentStage}
                        onUpdate={handleUpdateAction}
                        onDelete={handleDeleteAction}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })()}
          
          {/* Error message */}
          {error && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '13px'
            }}>
              {error}
            </div>
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
              onClick={handleComplete}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#8b5cf6',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <CheckCircle size={16} />
              Complete Planning
            </button>
          </div>
        )}
      </div>
      
      {showSummary && (
        <CompletionSummary
          session={session}
          onUpdate={onUpdate}
          onClose={() => setShowSummary(false)}
          onEdit={() => setShowSummary(false)}
        />
      )}
    </>
  )
}

import React, { useState } from 'react'
import type { PlanningSessionDTO } from '../../../types'
import { ArrowLeft, Plus, CheckCircle } from 'lucide-react'
import StageHeader from '../StageHeader'
import NextActionItem from '../NextActionItem'
import CompletionSummary from '../CompletionSummary'
import { addNextAction, updateNextAction } from '../../../repos/planningSessionsRepo'

interface NextActionsStageProps {
  session: PlanningSessionDTO
  isCurrentStage: boolean
  onUpdate: (updates: Partial<PlanningSessionDTO>) => Promise<void>
  onBack: () => void
}

const NextActionsStage: React.FC<NextActionsStageProps> = ({ session, isCurrentStage, onUpdate, onBack }) => {
  const [newActionText, setNewActionText] = useState('')
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const handleAddAction = async () => {
    if (!newActionText.trim()) return
    
    try {
      // First, create the action locally
      let newAction = await addNextAction(
        session.id,
        newActionText.trim(),
        selectedWorkstreamId,
        null
      )
      
      // Then create and flag the task in OmniFocus
      if (window.electronAPI?.omnifocus) {
        try {
          console.log(`🏁 [Planning] Creating task in OmniFocus: "${newActionText.trim()}" for project ${session.projectId}`)
          
          // Create the task in OmniFocus
          const createResult = await window.electronAPI.omnifocus.createTask(
            session.projectId,
            newActionText.trim()
          )
          
          if (createResult.success && createResult.taskId) {
            console.log(`✅ [Planning] Task created in OmniFocus: ${createResult.taskId}`)
            
            // Flag the task as next action
            const flagResult = await window.electronAPI.omnifocus.updateTask(
              createResult.taskId,
              { flagged: true }
            )
            
            if (flagResult.success) {
              console.log(`✅ [Planning] Task flagged as next action in OmniFocus`)
              
              // If context is provided, set tags
              if (newAction.context) {
                const contextTag = [newAction.context.replace('@', '')]
                const tagResult = await window.electronAPI.omnifocus.setTaskTags(
                  createResult.taskId,
                  contextTag
                )
                
                if (tagResult.success) {
                  console.log(`✅ [Planning] Task tags set in OmniFocus: ${contextTag.join(', ')}`)
                } else {
                  console.error(`❌ [Planning] Failed to set task tags: ${tagResult.error}`)
                }
              }
              
              // Update the action with the OmniFocus task ID
              await updateNextAction(session.id, newAction.id, {
                exportedToOmniFocus: true,
                omniFocusTaskId: createResult.taskId
              })
              
              // Update local action object
              newAction = {
                ...newAction,
                exportedToOmniFocus: true,
                omniFocusTaskId: createResult.taskId
              }
            } else {
              console.error(`❌ [Planning] Failed to flag task: ${flagResult.error}`)
            }
          } else {
            console.error(`❌ [Planning] Failed to create task: ${createResult.error || 'Unknown error'}`)
          }
        } catch (omniFocusError) {
          console.error('❌ [Planning] Error creating task in OmniFocus:', omniFocusError)
          // Continue anyway - action is saved locally
        }
      }
      
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
      
      const action = session.nextActions.find(a => a.id === actionId)
      const updatedAction = action ? { ...action, ...updates } : null
      
      // If context is being updated and task exists in OmniFocus, sync the tags
      if (updatedAction && 'context' in updates && updatedAction.omniFocusTaskId && window.electronAPI?.omnifocus) {
        try {
          const contextTag = updates.context ? [updates.context.replace('@', '')] : []
          console.log(`🏁 [Planning] Updating task tags in OmniFocus: ${updatedAction.omniFocusTaskId} with context: ${contextTag.join(', ')}`)
          
          const tagResult = await window.electronAPI.omnifocus.setTaskTags(
            updatedAction.omniFocusTaskId,
            contextTag
          )
          
          if (tagResult.success) {
            console.log(`✅ [Planning] Task tags updated in OmniFocus`)
          } else {
            console.error(`❌ [Planning] Failed to update task tags: ${tagResult.error}`)
          }
        } catch (tagError) {
          console.error('❌ [Planning] Error updating task tags:', tagError)
        }
      }
      
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

export default NextActionsStage

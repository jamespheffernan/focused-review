import { useState, useEffect } from 'react'
import type { PlanningSessionDTO } from '../../../types'
import { X, ArrowRight } from 'lucide-react'
import StageHeader from '../StageHeader'

interface Props {
  session: PlanningSessionDTO
  isCurrentStage: boolean
  onUpdate: (updates: Partial<PlanningSessionDTO>) => Promise<void>
  onContinue: () => void
}

export default function PurposeStage({ session, isCurrentStage, onUpdate, onContinue }: Props) {
  const [statement, setStatement] = useState(session.purposeStatement)
  const [principles, setPrinciples] = useState<string[]>(session.principles)
  const [newPrinciple, setNewPrinciple] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  // Sync with session
  useEffect(() => {
    setStatement(session.purposeStatement)
    setPrinciples(session.principles)
  }, [session.purposeStatement, session.principles])
  
  // Debounced save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (statement !== session.purposeStatement || 
          JSON.stringify(principles) !== JSON.stringify(session.principles)) {
        onUpdate({ purposeStatement: statement, principles })
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [statement, principles, session.purposeStatement, session.principles, onUpdate])
  
  const handleAddPrinciple = () => {
    if (!newPrinciple.trim()) return
    if (principles.length >= 10) return
    setPrinciples([...principles, newPrinciple.trim()])
    setNewPrinciple('')
  }
  
  const handleRemovePrinciple = (index: number) => {
    setPrinciples(principles.filter((_, i) => i !== index))
  }
  
  const handleContinue = () => {
    if (!statement.trim()) {
      setError('Please add a purpose statement before continuing.')
      return
    }
    setError(null)
    onContinue()
  }
  
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.08)',
      border: isCurrentStage ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
      borderLeft: '3px solid #f97316',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: isCurrentStage ? '0 0 0 1px rgba(249, 115, 22, 0.3)' : 'none'
    }}>
      <StageHeader
        stageNumber={1}
        stageName="Purpose"
        description="Why does this project exist? What's the enduring criterion that tells you when something is 'on purpose'?"
        color="#f97316"
      />
      
      <div style={{ marginTop: '24px' }}>
        {/* Purpose statement */}
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
            PURPOSE STATEMENT
            <span style={{ 
              width: '6px', 
              height: '6px', 
              borderRadius: '50%', 
              background: '#f97316' 
            }} />
          </label>
          <textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value.slice(0, 500))}
            placeholder="Why does this project exist?"
            disabled={!isCurrentStage}
            rows={3}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: error && !statement.trim() 
                ? '1px solid #ef4444' 
                : '1px solid rgba(255, 255, 255, 0.15)',
              borderLeft: '3px solid #f97316',
              borderRadius: '6px',
              color: 'white',
              padding: '12px',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              opacity: isCurrentStage ? 1 : 0.7,
              minHeight: '80px',
              maxHeight: '200px'
            }}
          />
          {statement.length > 400 && (
            <div style={{ 
              fontSize: '11px', 
              color: statement.length >= 500 ? '#ef4444' : 'rgba(255, 255, 255, 0.5)',
              textAlign: 'right',
              marginTop: '4px'
            }}>
              {statement.length}/500
            </div>
          )}
        </div>
        
        {/* Principles */}
        <div>
          <label style={{ 
            display: 'block',
            fontSize: '11px', 
            fontWeight: '600',
            letterSpacing: '1px',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '4px'
          }}>
            GUIDING PRINCIPLES
          </label>
          <p style={{ 
            fontSize: '12px', 
            color: 'rgba(255, 255, 255, 0.5)', 
            margin: '0 0 12px 0' 
          }}>
            Budget limits, quality standards, ethical lines, timing constraints
          </p>
          
          {/* Add principle input */}
          {isCurrentStage && principles.length < 10 && (
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              marginBottom: '12px' 
            }}>
              <input
                type="text"
                value={newPrinciple}
                onChange={(e) => setNewPrinciple(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddPrinciple()
                  }
                }}
                placeholder="Add a guiding principle..."
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
                onClick={handleAddPrinciple}
                disabled={!newPrinciple.trim()}
                style={{
                  background: 'rgba(249, 115, 22, 0.2)',
                  border: '1px solid rgba(249, 115, 22, 0.4)',
                  borderRadius: '6px',
                  color: '#f97316',
                  padding: '8px 16px',
                  fontSize: '13px',
                  cursor: newPrinciple.trim() ? 'pointer' : 'not-allowed',
                  opacity: newPrinciple.trim() ? 1 : 0.5
                }}
              >
                Add
              </button>
            </div>
          )}
          
          {/* Principles list */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {principles.map((principle, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.85)'
                }}
              >
                {principle}
                {isCurrentStage && (
                  <button
                    onClick={() => handleRemovePrinciple(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.5)',
                      cursor: 'pointer',
                      padding: '2px',
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
      
      {/* Navigation */}
      {isCurrentStage && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          marginTop: '20px' 
        }}>
          <button
            onClick={handleContinue}
            disabled={!statement.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: statement.trim() ? '#f97316' : 'rgba(249, 115, 22, 0.3)',
              border: 'none',
              borderRadius: '6px',
              color: statement.trim() ? '#000' : 'rgba(0, 0, 0, 0.5)',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: statement.trim() ? 'pointer' : 'not-allowed'
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

// Placeholder - will be implemented in Stream F
import type { PlanningSessionDTO } from '../../../types'
import StageHeader from '../StageHeader'

interface Props {
  session: PlanningSessionDTO
  isCurrentStage: boolean
  onUpdate: (updates: Partial<PlanningSessionDTO>) => Promise<void>
  onContinue: () => void
  onBack: () => void
}

export default function BrainstormStage({ session, isCurrentStage, onUpdate, onContinue, onBack }: Props) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.08)',
      border: isCurrentStage ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
      borderLeft: '3px solid #22c55e',
      borderRadius: '8px',
      padding: '20px'
    }}>
      <StageHeader
        stageNumber={3}
        stageName="Brainstorm"
        description="What ideas, thoughts, or considerations come to mind? Capture everything without judgment."
        color="#22c55e"
      />
      
      <div style={{ marginTop: '24px', textAlign: 'center', padding: '40px', opacity: 0.6 }}>
        <p>🚧 Brainstorm Canvas - Coming Soon</p>
        <p style={{ fontSize: '0.9em', marginTop: '8px' }}>This will include a freeform canvas for capturing ideas</p>
      </div>
      
      {isCurrentStage && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              color: 'white',
              padding: '10px 20px',
              cursor: 'pointer'
            }}
          >
            ← Back
          </button>
          <button
            onClick={onContinue}
            style={{
              background: '#22c55e',
              border: 'none',
              borderRadius: '6px',
              color: '#000',
              padding: '10px 20px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  )
}

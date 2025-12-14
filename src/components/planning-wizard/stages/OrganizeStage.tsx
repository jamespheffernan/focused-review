// Placeholder - will be implemented in Stream G
import type { PlanningSessionDTO } from '../../../types'
import StageHeader from '../StageHeader'

interface Props {
  session: PlanningSessionDTO
  isCurrentStage: boolean
  onUpdate: (updates: Partial<PlanningSessionDTO>) => Promise<void>
  onContinue: () => void
  onBack: () => void
}

export default function OrganizeStage({ session, isCurrentStage, onUpdate, onContinue, onBack }: Props) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.08)',
      border: isCurrentStage ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
      borderLeft: '3px solid #3b82f6',
      borderRadius: '8px',
      padding: '20px'
    }}>
      <StageHeader
        stageNumber={4}
        stageName="Organize"
        description="Group related items into workstreams. What are the major components or themes?"
        color="#3b82f6"
      />
      
      <div style={{ marginTop: '24px', textAlign: 'center', padding: '40px', opacity: 0.6 }}>
        <p>🚧 Organize Workstreams - Coming Soon</p>
        <p style={{ fontSize: '0.9em', marginTop: '8px' }}>This will include drag-and-drop organization of brainstorm items</p>
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
              background: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
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

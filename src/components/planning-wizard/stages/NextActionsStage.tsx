// Placeholder - will be implemented in Stream H
import type { PlanningSessionDTO } from '../../../types'
import StageHeader from '../StageHeader'

interface Props {
  session: PlanningSessionDTO
  isCurrentStage: boolean
  onUpdate: (updates: Partial<PlanningSessionDTO>) => Promise<void>
  onBack: () => void
}

export default function NextActionsStage({ session, isCurrentStage, onUpdate, onBack }: Props) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.08)',
      border: isCurrentStage ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
      borderLeft: '3px solid #8b5cf6',
      borderRadius: '8px',
      padding: '20px'
    }}>
      <StageHeader
        stageNumber={5}
        stageName="Next Actions"
        description="What are the very next physical actions needed to move this project forward?"
        color="#8b5cf6"
      />
      
      <div style={{ marginTop: '24px', textAlign: 'center', padding: '40px', opacity: 0.6 }}>
        <p>🚧 Next Actions - Coming Soon</p>
        <p style={{ fontSize: '0.9em', marginTop: '8px' }}>This will include action items with context tags</p>
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
            onClick={() => alert('Planning complete! 🎉')}
            style={{
              background: '#8b5cf6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              padding: '10px 20px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Complete Planning ✓
          </button>
        </div>
      )}
    </div>
  )
}

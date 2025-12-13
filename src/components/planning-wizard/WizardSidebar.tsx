import { Check } from 'lucide-react'

const STAGE_COLORS = {
  1: '#f97316',
  2: '#eab308', 
  3: '#22c55e',
  4: '#3b82f6',
  5: '#8b5cf6',
}

const STAGE_NAMES = ['Purpose', 'Vision', 'Brainstorm', 'Organize', 'Next Actions']

interface Props {
  currentStage: 1 | 2 | 3 | 4 | 5
  completedStages: number[]
  onStageClick: (stage: number) => void
}

export default function WizardSidebar({ currentStage, completedStages, onStageClick }: Props) {
  return (
    <div style={{
      width: '180px',
      borderRight: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      background: 'rgba(255, 255, 255, 0.02)'
    }}>
      {[1, 2, 3, 4, 5].map(stage => {
        const isCompleted = completedStages.includes(stage)
        const isCurrent = stage === currentStage
        const isFuture = stage > currentStage && !isCompleted
        const isClickable = !isFuture
        const stageColor = STAGE_COLORS[stage as keyof typeof STAGE_COLORS]
        
        return (
          <button
            key={stage}
            onClick={() => isClickable && onStageClick(stage)}
            disabled={isFuture}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              background: isCurrent ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              border: 'none',
              borderLeft: isCurrent ? `3px solid ${stageColor}` : '3px solid transparent',
              borderRadius: '0 6px 6px 0',
              cursor: isClickable ? 'pointer' : 'default',
              opacity: isFuture ? 0.4 : 1,
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              if (isClickable && !isCurrent) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isCurrent) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            {/* Stage number/check circle */}
            <div style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: '600',
              background: isCompleted ? '#4ade80' : 'transparent',
              border: isCompleted 
                ? 'none' 
                : `2px solid ${isCurrent ? stageColor : 'rgba(255, 255, 255, 0.3)'}`,
              color: isCompleted ? '#000' : (isCurrent ? '#fff' : 'rgba(255, 255, 255, 0.5)')
            }}>
              {isCompleted ? <Check size={12} strokeWidth={3} /> : stage}
            </div>
            
            {/* Stage name */}
            <span style={{
              fontSize: '13px',
              fontWeight: isCurrent ? '600' : '400',
              color: isCurrent ? '#fff' : 'rgba(255, 255, 255, 0.7)'
            }}>
              {STAGE_NAMES[stage - 1]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

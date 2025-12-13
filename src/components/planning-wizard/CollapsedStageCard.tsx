import type { PlanningSessionDTO } from '../../types'
import { ChevronDown } from 'lucide-react'

const STAGE_COLORS = {
  1: '#f97316',
  2: '#eab308',
  3: '#22c55e',
  4: '#3b82f6',
  5: '#8b5cf6',
}

const STAGE_NAMES = ['PURPOSE', 'VISION', 'BRAINSTORM', 'ORGANIZE', 'NEXT ACTIONS']

interface Props {
  stage: number
  session: PlanningSessionDTO
  onExpand: () => void
}

export default function CollapsedStageCard({ stage, session, onExpand }: Props) {
  const stageColor = STAGE_COLORS[stage as keyof typeof STAGE_COLORS]
  
  const getSummary = () => {
    switch (stage) {
      case 1:
        const purposeText = session.purposeStatement 
          ? `"${session.purposeStatement.slice(0, 80)}${session.purposeStatement.length > 80 ? '...' : ''}"`
          : 'No purpose defined'
        const principleCount = session.principles.length
        return (
          <>
            <span>{purposeText}</span>
            {principleCount > 0 && (
              <span style={{ opacity: 0.6 }}> • {principleCount} principle{principleCount !== 1 ? 's' : ''}</span>
            )}
          </>
        )
      
      case 2:
        const visionText = session.visionDescription
          ? `"${session.visionDescription.slice(0, 80)}${session.visionDescription.length > 80 ? '...' : ''}"`
          : 'No vision defined'
        const criteriaCount = session.successCriteria.length
        const criteriaCompleted = session.successCriteria.filter(c => c.completed).length
        return (
          <>
            <span>{visionText}</span>
            {criteriaCount > 0 && (
              <span style={{ opacity: 0.6 }}> • {criteriaCompleted}/{criteriaCount} criteria met</span>
            )}
          </>
        )
      
      case 3:
        return (
          <span style={{ opacity: 0.7 }}>{session.brainstormItems.length} items captured</span>
        )
      
      case 4:
        const wsNames = session.workstreams.slice(0, 3).map(ws => ws.name).join(', ')
        const moreWs = session.workstreams.length > 3 ? `, +${session.workstreams.length - 3} more` : ''
        const unorgCount = session.unorganizedItemIds.length
        return (
          <>
            <span>Workstreams: {wsNames || 'None'}{moreWs}</span>
            {unorgCount > 0 && (
              <span style={{ opacity: 0.6 }}> • {unorgCount} unorganized</span>
            )}
          </>
        )
      
      case 5:
        const actionCount = session.nextActions.length
        return (
          <span>{actionCount} action{actionCount !== 1 ? 's' : ''} defined</span>
        )
      
      default:
        return null
    }
  }
  
  return (
    <button
      onClick={onExpand}
      style={{
        width: '100%',
        height: '60px',
        padding: '16px 20px',
        background: 'rgba(255, 255, 255, 0.08)',
        border: 'none',
        borderLeft: `3px solid ${stageColor}`,
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        transition: 'background 0.15s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: stageColor,
          flexShrink: 0
        }} />
        <span style={{ 
          fontSize: '11px', 
          fontWeight: '600', 
          letterSpacing: '1px',
          color: 'rgba(255, 255, 255, 0.6)',
          flexShrink: 0
        }}>
          {STAGE_NAMES[stage - 1]}
        </span>
        <span style={{ 
          fontSize: '13px', 
          color: 'rgba(255, 255, 255, 0.8)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left'
        }}>
          {getSummary()}
        </span>
      </div>
      <ChevronDown size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
    </button>
  )
}

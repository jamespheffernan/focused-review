import { useRef, useEffect } from 'react'
import type { PlanningSessionDTO } from '../../types'
import { Loader2 } from 'lucide-react'
import PurposeStage from './stages/PurposeStage'
import VisionStage from './stages/VisionStage'
import BrainstormStage from './stages/BrainstormStage'
import OrganizeStage from './stages/OrganizeStage'
import NextActionsStage from './stages/NextActionsStage'
import CollapsedStageCard from './CollapsedStageCard'

interface Props {
  session: PlanningSessionDTO | null
  loading: boolean
  collapsedStages: Set<number>
  onSessionUpdate: (updates: Partial<PlanningSessionDTO>) => Promise<void>
  onStageChange: (stage: 1 | 2 | 3 | 4 | 5) => Promise<void>
  onToggleCollapsed: (stage: number) => void
}

export default function WizardContent({
  session,
  loading,
  collapsedStages,
  onSessionUpdate,
  onStageChange,
  onToggleCollapsed
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  
  // Scroll to current stage when it changes
  useEffect(() => {
    if (session && contentRef.current) {
      const stageElement = document.getElementById(`planning-stage-${session.currentStage}`)
      if (stageElement) {
        setTimeout(() => {
          stageElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      }
    }
  }, [session?.currentStage])
  
  if (loading) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px'
      }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ opacity: 0.7 }}>Loading planning session...</span>
      </div>
    )
  }
  
  if (!session) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '12px',
        padding: '40px'
      }}>
        <span style={{ fontSize: '1.2em', opacity: 0.8 }}>Select a project to begin planning</span>
        <span style={{ fontSize: '0.9em', opacity: 0.6 }}>
          Use the dropdown above to choose a project
        </span>
      </div>
    )
  }
  
  const reachedStages = [...session.completedStages, session.currentStage]
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b)
  
  return (
    <div 
      ref={contentRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}
    >
      {reachedStages.map(stage => {
        const isCurrentStage = stage === session.currentStage
        const isCollapsed = collapsedStages.has(stage) && !isCurrentStage
        
        if (isCollapsed) {
          return (
            <CollapsedStageCard
              key={stage}
              stage={stage}
              session={session}
              onExpand={() => onToggleCollapsed(stage)}
            />
          )
        }
        
        return (
          <div key={stage} id={`planning-stage-${stage}`}>
            {stage === 1 && (
              <PurposeStage
                session={session}
                isCurrentStage={isCurrentStage}
                onUpdate={onSessionUpdate}
                onContinue={() => onStageChange(2)}
              />
            )}
            {stage === 2 && (
              <VisionStage
                session={session}
                isCurrentStage={isCurrentStage}
                onUpdate={onSessionUpdate}
                onContinue={() => onStageChange(3)}
                onBack={() => onStageChange(1)}
              />
            )}
            {stage === 3 && (
              <BrainstormStage
                session={session}
                isCurrentStage={isCurrentStage}
                onUpdate={onSessionUpdate}
                onContinue={() => onStageChange(4)}
                onBack={() => onStageChange(2)}
              />
            )}
            {stage === 4 && (
              <OrganizeStage
                session={session}
                isCurrentStage={isCurrentStage}
                onUpdate={onSessionUpdate}
                onContinue={() => onStageChange(5)}
                onBack={() => onStageChange(3)}
              />
            )}
            {stage === 5 && (
              <NextActionsStage
                session={session}
                isCurrentStage={isCurrentStage}
                onUpdate={onSessionUpdate}
                onBack={() => onStageChange(4)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

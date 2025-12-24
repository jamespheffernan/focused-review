import type { PlanningSessionDTO } from '../types'

/**
 * Format planning session data as markdown for Notion
 */
export function formatPlanningAsMarkdown(session: PlanningSessionDTO): string {
  const lines: string[] = []
  
  // Header
  lines.push(`## Natural Planning Summary`)
  lines.push(`*Generated ${new Date(session.updatedAt).toLocaleDateString()}*`)
  lines.push('')
  
  // Stage 1: Purpose
  lines.push(`### Purpose`)
  lines.push(session.purposeStatement || '*No purpose defined*')
  lines.push('')
  
  if (session.principles.length > 0) {
    lines.push(`**Guiding Principles:**`)
    session.principles.forEach(p => {
      lines.push(`- ${p}`)
    })
    lines.push('')
  }
  
  // Stage 2: Vision
  lines.push(`### Vision`)
  lines.push(session.visionDescription || '*No vision defined*')
  lines.push('')
  
  if (session.successCriteria.length > 0) {
    lines.push(`**Success Criteria:**`)
    session.successCriteria.forEach(c => {
      const checkbox = c.completed ? '[x]' : '[ ]'
      lines.push(`- ${checkbox} ${c.text}`)
    })
    lines.push('')
  }
  
  // Stage 3: Brainstorm (summary only, not canvas positions)
  if (session.brainstormItems.length > 0) {
    lines.push(`### Brainstorm Ideas`)
    lines.push(`*${session.brainstormItems.length} items captured*`)
    lines.push('')
  }
  
  // Stage 4: Organize - Workstreams
  if (session.workstreams.length > 0) {
    lines.push(`### Workstreams`)
    session.workstreams.forEach(ws => {
      lines.push(`**${ws.name}**`)
      const items = session.brainstormItems.filter(item => ws.itemIds.includes(item.id))
      items.forEach(item => {
        lines.push(`- ${item.text}`)
      })
      lines.push('')
    })
  }
  
  // Unorganized items
  const unorganizedItems = session.brainstormItems.filter(
    item => session.unorganizedItemIds.includes(item.id)
  )
  if (unorganizedItems.length > 0) {
    lines.push(`**Unorganized:**`)
    unorganizedItems.forEach(item => {
      lines.push(`- ${item.text}`)
    })
    lines.push('')
  }
  
  // Stage 5: Next Actions
  if (session.nextActions.length > 0) {
    lines.push(`### Next Actions`)
    
    // Group by workstream
    const byWorkstream = new Map<string | null, typeof session.nextActions>()
    session.nextActions.forEach(action => {
      const key = action.workstreamId
      if (!byWorkstream.has(key)) {
        byWorkstream.set(key, [])
      }
      byWorkstream.get(key)!.push(action)
    })
    
    byWorkstream.forEach((actions, workstreamId) => {
      if (workstreamId) {
        const ws = session.workstreams.find(w => w.id === workstreamId)
        lines.push(`**${ws?.name || 'Unknown'}:**`)
      } else {
        lines.push(`**Other Actions:**`)
      }
      
      actions.forEach(action => {
        const checkbox = action.completed ? '[x]' : '[ ]'
        const context = action.context ? ` @${action.context}` : ''
        lines.push(`- ${checkbox} ${action.text}${context}`)
      })
      lines.push('')
    })
  }
  
  return lines.join('\n')
}



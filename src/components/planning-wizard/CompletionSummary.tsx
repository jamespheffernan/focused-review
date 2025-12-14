import { useState } from 'react'
import type { PlanningSessionDTO } from '../../types'
import { X, CheckCircle, FileText, Copy, ExternalLink } from 'lucide-react'

interface Props {
  session: PlanningSessionDTO
  onUpdate: (updates: Partial<PlanningSessionDTO>) => Promise<void>
  onClose: () => void
  onEdit: () => void
}

export default function CompletionSummary({ session, onUpdate, onClose, onEdit }: Props) {
  const [copied, setCopied] = useState(false)
  
  const formatSummary = (): string => {
    const lines: string[] = []
    
    lines.push(`# Natural Planning Summary: ${session.projectName}`)
    lines.push(`*Generated ${new Date().toLocaleDateString()}*`)
    lines.push('')
    
    // Purpose
    lines.push('## Purpose')
    lines.push(session.purposeStatement || '*No purpose defined*')
    lines.push('')
    
    if (session.principles.length > 0) {
      lines.push('**Guiding Principles:**')
      session.principles.forEach(p => lines.push(`- ${p}`))
      lines.push('')
    }
    
    // Vision
    lines.push('## Vision')
    lines.push(session.visionDescription || '*No vision defined*')
    lines.push('')
    
    if (session.successCriteria.length > 0) {
      lines.push('**Success Criteria:**')
      session.successCriteria.forEach(c => {
        const checkbox = c.completed ? '[x]' : '[ ]'
        lines.push(`- ${checkbox} ${c.text}`)
      })
      lines.push('')
    }
    
    // Brainstorm summary
    if (session.brainstormItems.length > 0) {
      lines.push(`## Brainstorm Ideas`)
      lines.push(`*${session.brainstormItems.length} items captured*`)
      lines.push('')
    }
    
    // Workstreams
    if (session.workstreams.length > 0) {
      lines.push('## Workstreams')
      session.workstreams.forEach(ws => {
        lines.push(`### ${ws.name}`)
        const items = session.brainstormItems.filter(item => ws.itemIds.includes(item.id))
        items.forEach(item => lines.push(`- ${item.text}`))
        lines.push('')
      })
    }
    
    // Unorganized items
    const unorganizedItems = session.brainstormItems.filter(
      item => session.unorganizedItemIds.includes(item.id)
    )
    if (unorganizedItems.length > 0) {
      lines.push('### Unorganized')
      unorganizedItems.forEach(item => lines.push(`- ${item.text}`))
      lines.push('')
    }
    
    // Next Actions
    if (session.nextActions.length > 0) {
      lines.push('## Next Actions')
      
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
          lines.push(`### ${ws?.name || 'Unknown'}`)
        } else {
          lines.push('### Other Actions')
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
  
  const handleCopy = async () => {
    const summary = formatSummary()
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }
  
  const handleExportToOmniFocus = async () => {
    // TODO: Implement OmniFocus export
    alert('OmniFocus export coming soon!')
  }
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(30, 30, 40, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '12px',
        maxWidth: '800px',
        maxHeight: '90vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle size={24} color="#22c55e" />
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: 'white',
              margin: 0
            }}>
              Planning Complete!
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '20px',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.9)',
            lineHeight: 1.6
          }}>
            {formatSummary()}
          </div>
        </div>
        
        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '20px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <button
            onClick={handleCopy}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: 'white',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy as Text'}
          </button>
          
          <button
            onClick={handleExportToOmniFocus}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: 'white',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <ExternalLink size={16} />
            Export to OmniFocus
          </button>
          
          <button
            onClick={onEdit}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: '#8b5cf6',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <FileText size={16} />
            Edit Planning
          </button>
        </div>
      </div>
    </div>
  )
}

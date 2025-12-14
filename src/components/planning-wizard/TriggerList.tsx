import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'

interface Props {
  onSelectTrigger: (text: string) => void
}

const TRIGGER_CATEGORIES = {
  'Logistics': [
    'Timeline and deadlines',
    'Budget and costs',
    'Location and venue',
    'Equipment needed',
    'Transportation requirements'
  ],
  'People': [
    'Stakeholders involved',
    'Approvals needed',
    'Expertise required',
    'Who to inform',
    'Team members'
  ],
  'Communications': [
    'Updates to share',
    'Documentation needed',
    'Announcements',
    'Reports to generate',
    'Feedback to collect'
  ],
  'Risks': [
    'What could go wrong',
    'Dependencies',
    'Assumptions',
    'Blockers',
    'Contingency plans'
  ],
  'Resources': [
    'Tools needed',
    'Materials required',
    'Information to gather',
    'Existing assets',
    'External services'
  ],
  'Legal/Admin': [
    'Contracts',
    'Permissions',
    'Compliance',
    'Insurance',
    'Regulations'
  ]
}

export default function TriggerList({ onSelectTrigger }: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  
  return (
    <div style={{
      marginTop: '16px',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      padding: '12px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        fontSize: '12px',
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.7)',
        letterSpacing: '0.5px'
      }}>
        <Sparkles size={14} />
        BRAINSTORM TRIGGERS
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Object.entries(TRIGGER_CATEGORIES).map(([category, triggers]) => (
          <div key={category}>
            <button
              onClick={() => setExpandedCategory(
                expandedCategory === category ? null : category
              )}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: 'white',
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span>{category}</span>
              {expandedCategory === category ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
            
            {expandedCategory === category && (
              <div style={{
                marginTop: '8px',
                paddingLeft: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                {triggers.map((trigger, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onSelectTrigger(trigger)
                      setExpandedCategory(null)
                    }}
                    style={{
                      padding: '6px 10px',
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                      borderRadius: '4px',
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)'
                    }}
                  >
                    {trigger}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}


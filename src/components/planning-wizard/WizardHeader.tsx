import { useState } from 'react'
import type { ProjectDTO } from '../../types'
import { ArrowLeft, Check, Loader2, ChevronDown, Search } from 'lucide-react'

// Stage colors from design spec
const STAGE_COLORS = {
  1: '#f97316', // Orange - Purpose
  2: '#eab308', // Yellow - Vision
  3: '#22c55e', // Green - Brainstorm
  4: '#3b82f6', // Blue - Organize
  5: '#8b5cf6', // Purple - Next Actions
}

interface Props {
  projects: ProjectDTO[]
  selectedProjectId: string | null
  onProjectSelect: (projectId: string) => void
  currentStage: 1 | 2 | 3 | 4 | 5
  saving: boolean
  onBack: () => void
}

export default function WizardHeader({ 
  projects, 
  selectedProjectId, 
  onProjectSelect, 
  currentStage, 
  saving,
  onBack 
}: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  const stageNames = ['Purpose', 'Vision', 'Brainstorm', 'Organize', 'Next Actions']
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      gap: '24px'
    }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          color: 'white',
          padding: '8px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px'
        }}
      >
        <ArrowLeft size={16} />
        Back
      </button>
      
      {/* Project selector */}
      <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: 'white',
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '14px'
          }}
        >
          <span style={{ 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap' 
          }}>
            {selectedProject?.name || 'Select a project...'}
          </span>
          <ChevronDown size={16} style={{ 
            transform: dropdownOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s'
          }} />
        </button>
        
        {dropdownOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: 'rgba(30, 30, 40, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            maxHeight: '400px',
            overflow: 'hidden',
            zIndex: 100,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
            {/* Search field */}
            <div style={{ padding: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ 
                  position: 'absolute', 
                  left: '10px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  opacity: 0.5
                }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    color: 'white',
                    padding: '8px 10px 8px 32px',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                  autoFocus
                />
              </div>
            </div>
            
            {/* Project list */}
            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
              {filteredProjects.map(project => (
                <button
                  key={project.id}
                  onClick={() => {
                    onProjectSelect(project.id)
                    setDropdownOpen(false)
                    setSearchQuery('')
                  }}
                  style={{
                    width: '100%',
                    background: project.id === selectedProjectId 
                      ? 'rgba(249, 115, 22, 0.2)' 
                      : 'transparent',
                    border: 'none',
                    borderLeft: project.id === selectedProjectId 
                      ? '3px solid #f97316' 
                      : '3px solid transparent',
                    color: 'white',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (project.id !== selectedProjectId) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (project.id !== selectedProjectId) {
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  {project.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Progress indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '13px', opacity: 0.7 }}>
          Stage {currentStage} of 5 — {stageNames[currentStage - 1]}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[1, 2, 3, 4, 5].map(stage => (
            <div
              key={stage}
              style={{
                width: '40px',
                height: '4px',
                borderRadius: '2px',
                background: stage <= currentStage 
                  ? STAGE_COLORS[stage as keyof typeof STAGE_COLORS]
                  : 'rgba(255, 255, 255, 0.2)'
              }}
            />
          ))}
        </div>
      </div>
      
      {/* Save indicator */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px',
        fontSize: '12px',
        opacity: 0.7
      }}>
        {saving ? (
          <>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Saving...
          </>
        ) : (
          <>
            <Check size={14} />
            Saved
          </>
        )}
      </div>
    </div>
  )
}

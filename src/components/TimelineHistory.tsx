// components/TimelineHistory.tsx
import { useEffect, useState } from 'react'
import type { TimelineCommitmentDTO } from '../types'
import { getCommitmentsForProject } from '../repos/timelineCommitmentsRepo'
import { formatDisplayDate, formatWeekLabel } from '../utils/calendar-utils'
import { X } from 'lucide-react'

interface TimelineHistoryProps {
  projectId: string
  projectName: string
  visible: boolean
  onClose: () => void
}

export default function TimelineHistory({ projectId, projectName, visible, onClose }: TimelineHistoryProps) {
  const [commitments, setCommitments] = useState<TimelineCommitmentDTO[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible && projectId) {
      loadCommitments()
    }
  }, [visible, projectId])

  const loadCommitments = async () => {
    setLoading(true)
    try {
      const allCommitments = await getCommitmentsForProject(projectId)
      // Sort by weekOf descending (most recent first)
      allCommitments.sort((a, b) => b.weekOf.localeCompare(a.weekOf))
      setCommitments(allCommitments)
    } catch (error) {
      console.error('Error loading timeline history:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateDateShift = (current: TimelineCommitmentDTO, previous?: TimelineCommitmentDTO): string | null => {
    if (!previous) return null
    
    const currentDate = new Date(current.committedDate)
    const previousDate = new Date(previous.committedDate)
    const diffDays = Math.round((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'No change'
    if (diffDays > 0) return `+${diffDays} days`
    return `${diffDays} days`
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div style={{
        background: 'rgba(30, 30, 30, 0.95)',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.5em',
            fontWeight: '600',
            color: 'white'
          }}>
            Timeline History: {projectName}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.7)' }}>
            Loading timeline history...
          </div>
        ) : commitments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.7)' }}>
            No timeline commitments found for this project.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {commitments.map((commitment, index) => {
              const previous = index < commitments.length - 1 ? commitments[index + 1] : undefined
              const dateShift = calculateDateShift(commitment, previous)
              
              return (
                <div
                  key={commitment.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                  }}>
                    <div style={{ fontSize: '0.9em', color: 'rgba(255, 255, 255, 0.7)' }}>
                      {formatWeekLabel(commitment.weekOf)}
                    </div>
                    {dateShift && (
                      <div style={{
                        fontSize: '0.85em',
                        color: dateShift.startsWith('+') ? '#FFC107' : dateShift.startsWith('-') ? '#FF5722' : 'rgba(255, 255, 255, 0.6)',
                        fontWeight: '500'
                      }}>
                        {dateShift}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: '1.1em',
                    fontWeight: '600',
                    color: 'white',
                    marginTop: '4px'
                  }}>
                    {formatDisplayDate(commitment.committedDate)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


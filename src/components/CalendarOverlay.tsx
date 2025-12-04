// components/CalendarOverlay.tsx
import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import type { TimelineCommitmentDTO } from '../types'
import { getCommitmentsForWeek } from '../repos/timelineCommitmentsRepo'
import { formatWeekLabel, getWeekOffset } from '../utils/calendar-utils'
import { exportCalendarAsPDF } from '../utils/calendar-export'
import CalendarGanttChart from './CalendarGanttChart'
import './CalendarOverlay.css'

interface CalendarOverlayProps {
  visible: boolean
  weekOf: string
  currentSessionProjects?: Set<string> // Only for current week during active review
  onClose: () => void
  isCurrentWeek: boolean
}

export default function CalendarOverlay({
  visible,
  weekOf,
  currentSessionProjects,
  onClose,
  isCurrentWeek
}: CalendarOverlayProps) {
  const [commitments, setCommitments] = useState<TimelineCommitmentDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(weekOf)
  const [exporting, setExporting] = useState(false)

  // Load commitments when week changes
  useEffect(() => {
    if (!visible) return
    
    loadCommitments()
  }, [visible, selectedWeek, currentSessionProjects])

  const loadCommitments = async () => {
    setLoading(true)
    try {
      const allCommitments = await getCommitmentsForWeek(selectedWeek)
      
      // Filter to only reviewed projects if this is the current week during active review
      // AND we have session projects (meaning we're in an active review session)
      // Otherwise, show all commitments for the week (including from previous sessions)
      let filtered = allCommitments
      if (isCurrentWeek && currentSessionProjects && currentSessionProjects.size > 0) {
        // During active review session: show only commitments from projects reviewed this session
        filtered = allCommitments.filter(c => currentSessionProjects.has(c.projectId))
        console.log(`📅 Calendar filtered to ${filtered.length}/${allCommitments.length} commitments (reviewed projects this session only)`)
      } else {
        // Not in active session or viewing past week: show all commitments for the week
        console.log(`📅 Calendar showing all ${allCommitments.length} commitments for week ${selectedWeek}`)
      }
      
      setCommitments(filtered)
    } catch (error) {
      console.error('Error loading calendar commitments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePreviousWeek = () => {
    setSelectedWeek(getWeekOffset(selectedWeek, -1))
  }

  const handleNextWeek = () => {
    setSelectedWeek(getWeekOffset(selectedWeek, 1))
  }

  const handleExport = async () => {
    if (exporting) return
    
    setExporting(true)
    try {
      await exportCalendarAsPDF(selectedWeek, commitments)
      console.log('✅ Calendar exported successfully')
    } catch (error) {
      console.error('❌ Calendar export failed:', error)
      alert('Failed to export calendar. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePreviousWeek()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNextWeek()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible, selectedWeek])

  if (!visible) return null

  return (
    <div className="calendar-overlay-backdrop" onClick={onClose}>
      <div 
        className="calendar-overlay-container" 
        onClick={(e) => e.stopPropagation()}
        id="calendar-export-container"
      >
        {/* Header */}
        <div className="calendar-overlay-header">
          <div className="calendar-header-left">
            <button
              className="calendar-nav-button"
              onClick={handlePreviousWeek}
              title="Previous week (←)"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="calendar-title">
              {formatWeekLabel(selectedWeek)}
              {isCurrentWeek && selectedWeek === weekOf && (
                <span className="current-week-badge">Current</span>
              )}
            </h2>
            <button
              className="calendar-nav-button"
              onClick={handleNextWeek}
              title="Next week (→)"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="calendar-header-actions">
            <button
              className="calendar-export-button"
              onClick={handleExport}
              disabled={exporting}
              title="Download as PDF"
            >
              <Download size={18} />
              {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              className="calendar-close-button"
              onClick={onClose}
              title="Close (Esc)"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="calendar-overlay-content">
          {loading ? (
            <div className="calendar-loading">
              Loading calendar...
            </div>
          ) : (
            <CalendarGanttChart commitments={commitments} />
          )}
        </div>

        {/* Footer info */}
        {!loading && (
          <div className="calendar-footer">
            <span className="commitment-count">
              {commitments.length} {commitments.length === 1 ? 'commitment' : 'commitments'}
            </span>
            {isCurrentWeek && selectedWeek === weekOf && currentSessionProjects && (
              <span className="session-info">
                {currentSessionProjects.size} {currentSessionProjects.size === 1 ? 'project' : 'projects'} reviewed this session
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


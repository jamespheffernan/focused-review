import { useEffect, useState } from 'react'
import { db } from '../db'
import { getStartOfISOWeek } from '../services/review-formatter'
import { getCommitmentsForWeek } from '../repos/timelineCommitmentsRepo'
import { exportCalendarAsPNG } from '../utils/calendar-export'
import CalendarGanttChart from '../components/CalendarGanttChart'
import type { TimelineCommitmentDTO } from '../types'
import { Calendar, Download } from 'lucide-react'

export default function SummaryScreen() {
  const [sessionStats, setSessionStats] = useState({
    projectsReviewed: 0,
    projectsSkipped: 0,
    totalTime: 0,
    avgTimePerProject: 0
  })
  const [showCalendar, setShowCalendar] = useState(false)
  const [commitments, setCommitments] = useState<TimelineCommitmentDTO[]>([])
  const [exporting, setExporting] = useState(false)
  
  useEffect(() => {
    loadSessionStats()
    loadCommitments()
  }, [])

  const loadSessionStats = async () => {
    try {
      const sessions = await db.sessions.orderBy('startedAt').reverse().limit(1).toArray()
      if (sessions.length > 0) {
        const latestSession = sessions[0]
        setSessionStats({
          projectsReviewed: latestSession.projectsReviewed,
          projectsSkipped: latestSession.projectsSkipped,
          totalTime: latestSession.avgTimePerProjectSec * latestSession.projectsReviewed,
          avgTimePerProject: latestSession.avgTimePerProjectSec
        })
      }
    } catch (error) {
      console.error('Error loading session stats:', error)
    }
  }

  const loadCommitments = async () => {
    try {
      const weekOf = getStartOfISOWeek()
      const weekCommitments = await getCommitmentsForWeek(weekOf)
      setCommitments(weekCommitments)
      console.log(`📅 Loaded ${weekCommitments.length} commitments for summary screen`)
    } catch (error) {
      console.error('Error loading commitments:', error)
    }
  }

  const handleExportCalendar = async () => {
    if (exporting) return
    
    setExporting(true)
    try {
      const weekOf = getStartOfISOWeek()
      await exportCalendarAsPNG(weekOf)
      console.log('✅ Calendar exported successfully from summary screen')
    } catch (error) {
      console.error('❌ Calendar export failed:', error)
      alert('Failed to export calendar. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  
  return (
    <div className="page">
      <div className="summary-content">
        <h1 style={{ 
          fontSize: '3em', 
          fontWeight: '700', 
          textAlign: 'center', 
          marginBottom: '40px',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          Review Complete! 🎉
        </h1>
        
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.1)', 
          borderRadius: '16px', 
          padding: '32px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)',
          marginBottom: '40px'
        }}>
          <h2 style={{ 
            margin: '0 0 24px 0', 
            fontSize: '1.5em', 
            textAlign: 'center',
            opacity: 0.9
          }}>
            Great job completing your weekly review!
          </h2>
          
          <div className="summary-stats">
            <div className="stat-card">
              <div className="stat-number">{sessionStats.projectsReviewed}</div>
              <div className="stat-label">Projects Reviewed</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{sessionStats.projectsSkipped}</div>
              <div className="stat-label">Projects Skipped</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{formatTime(sessionStats.totalTime)}</div>
              <div className="stat-label">Total Time</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{formatTime(sessionStats.avgTimePerProject)}</div>
              <div className="stat-label">Avg per Project</div>
            </div>
          </div>
          
          <p style={{ 
            textAlign: 'center', 
            fontSize: '1.1em', 
            opacity: 0.8,
            lineHeight: 1.6,
            marginBottom: '32px'
          }}>
            You've taken time to reflect on your projects and ensure they're aligned with your goals. 
            This regular practice will help you stay focused and productive.
          </p>
          
          {/* Start New Review button removed as it doesn't fit the summary context */}
        </div>

        {/* Calendar Section */}
        {commitments.length > 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            marginTop: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px'
            }}>
              <h3 style={{
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '1.3em'
              }}>
                <Calendar size={24} />
                Timeline Commitments
                <span style={{
                  fontSize: '0.7em',
                  padding: '4px 12px',
                  background: 'rgba(33, 150, 243, 0.2)',
                  border: '1px solid rgba(33, 150, 243, 0.4)',
                  borderRadius: '12px',
                  color: '#2196F3',
                  fontWeight: '500'
                }}>
                  {commitments.length}
                </span>
              </h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowCalendar(!showCalendar)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    padding: '8px 16px',
                    fontSize: '0.9em',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {showCalendar ? 'Hide' : 'Show'} Calendar
                </button>
                <button
                  onClick={handleExportCalendar}
                  disabled={exporting}
                  style={{
                    background: 'rgba(76, 175, 80, 0.15)',
                    border: '1px solid rgba(76, 175, 80, 0.3)',
                    borderRadius: '8px',
                    color: '#4CAF50',
                    padding: '8px 16px',
                    fontSize: '0.9em',
                    fontWeight: '500',
                    cursor: exporting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: exporting ? 0.5 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Download size={16} />
                  {exporting ? 'Exporting...' : 'Download PNG'}
                </button>
              </div>
            </div>
            
            {showCalendar && (
              <div id="calendar-export-container" style={{
                background: 'rgba(20, 20, 30, 0.5)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                overflow: 'hidden'
              }}>
                <CalendarGanttChart commitments={commitments} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

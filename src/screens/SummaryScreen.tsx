import { useApp } from '../store'
import { useEffect, useState } from 'react'
import { db } from '../db'

export default function SummaryScreen() {
  const { gotoSummary } = useApp()
  const [sessionStats, setSessionStats] = useState({
    projectsReviewed: 0,
    projectsSkipped: 0,
    totalTime: 0,
    avgTimePerProject: 0
  })
  
  useEffect(() => {
    loadSessionStats()
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
          
          <div className="actions">
            <button 
              className="primary" 
              onClick={() => gotoSummary()}
              style={{ fontSize: '1.2em', padding: '20px 40px' }}
            >
              Start New Review
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

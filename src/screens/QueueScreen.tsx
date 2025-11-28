import { useMemo, useState, useEffect } from 'react'
import { useApp } from '../store'
import { getOmniFocusIntegrationStatus } from '../repos/projectsRepo'
import { getTaskStatisticsBatch } from '../repos/tasksRepo'
import { syncManager } from '../services/syncManager'
import { RefreshCw, Info, AlertTriangle, ClipboardList, CheckCircle2, Ban, Settings, Sparkles } from 'lucide-react'
import ThemeSelector from '../components/ThemeSelector'
import { themeManager } from '../services/themeManager'
import { DataSourceBanner } from '../components/DataSourceBanner'
import * as WeeklyReviews from '../repos/weeklyReviewsRepo'
import * as Answers from '../repos/answersRepo'
import { getStartOfISOWeek } from '../services/review-formatter'

export default function QueueScreen() {
  const { queue, start, syncFromOmniFocus, gotoQuestions, gotoSomedayReview } = useApp()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [weeklyReview, setWeeklyReview] = useState<{ state: string } | null>(null)
  const [reviewedProjects, setReviewedProjects] = useState<Set<string>>(new Set())
  
  // Track data source for banner
  const dataSourceInfo = syncManager.getDataSource()
  
  // Load weekly review state and reviewed projects
  useEffect(() => {
    const loadWeeklyReviewState = async () => {
      const weekOf = getStartOfISOWeek()
      const review = await WeeklyReviews.getWeeklyReviewForWeek(weekOf)
      if (review) {
        setWeeklyReview({ state: review.state })
        
        // Load which projects have been reviewed this week
        const reviewed = new Set<string>()
        for (const project of queue) {
          const answers = await Answers.getProjectAnswersForWeek(project.id, weekOf)
          if (answers.length > 0) {
            reviewed.add(project.id)
          }
        }
        setReviewedProjects(reviewed)
      } else {
        setWeeklyReview(null)
        setReviewedProjects(new Set())
      }
    }
    
    if (queue.length > 0) {
      loadWeeklyReviewState()
    }
  }, [queue])
  
  // Auto-select all projects when queue changes
  useEffect(() => {
    setSel(new Set(queue.map(p => p.id)))
  }, [queue])
  const [showOF4Note, setShowOF4Note] = useState(() => {
    // Check localStorage on mount
    return localStorage.getItem('blinders-hide-of4-note') !== 'true'
  })
  const [taskStats, setTaskStats] = useState<Record<string, {total: number, next: number, available: number, blocked: number, completed: number}>>({})
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncText, setLastSyncText] = useState<string>('')
  const [syncError, setSyncError] = useState<string | null>(null)
  const ids = useMemo(() => Array.from(sel), [sel])
  
  const integrationStatus = getOmniFocusIntegrationStatus()
  
  // Update last sync text on mount and when queue changes
  useEffect(() => {
    setLastSyncText(syncManager.getTimeSinceLastSync())
  }, [queue])
  
  // Initialize theme on mount
  useEffect(() => {
    themeManager.initializeTheme()
  }, [])
  
  const handleSync = async () => {
    setIsSyncing(true)
    setSyncError(null)
    try {
      console.log('🔄 Starting sync from QueueScreen...')
      await syncFromOmniFocus()
      console.log('✅ Sync completed, queue length:', queue.length)
      setLastSyncText(syncManager.getTimeSinceLastSync())
      // Reload task statistics after sync
      await loadTaskStatistics()
      console.log('✅ Task statistics loaded')
    } catch (error) {
      console.error('❌ Sync failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setSyncError(`Sync failed: ${errorMessage}`)
      alert(`Sync failed: ${errorMessage}\n\nCheck console for details.`)
    } finally {
      setIsSyncing(false)
    }
  }

  // Load task statistics for all projects using batch query
  const loadTaskStatistics = async () => {
    try {
      console.time('loadTaskStatistics')
      
      // Get all project IDs
      const projectIds = queue.map(p => p.id)
      
      // Single batch query to load all task statistics at once
      const stats = await getTaskStatisticsBatch(projectIds)
      
      setTaskStats(stats)
      console.log('All task stats loaded:', stats)
      console.timeEnd('loadTaskStatistics')
    } catch (error) {
      console.error('Error loading task statistics:', error)
      // Set empty stats for all projects on error
      const emptyStats: Record<string, {total: number, next: number, available: number, blocked: number, completed: number}> = {}
      queue.forEach(project => {
        emptyStats[project.id] = { total: 0, next: 0, available: 0, blocked: 0, completed: 0 }
      })
      setTaskStats(emptyStats)
    }
  }

  // Load task statistics when component mounts or queue changes
  // But NOT during a sync operation (to avoid database lock conflicts)
  useEffect(() => {
    if (queue.length > 0 && !isSyncing) {
      loadTaskStatistics()
    }
  }, [queue, isSyncing])
  
  return (
    <>
      <div className="page">
        <h1 style={{ 
          fontSize: '3em', 
          fontWeight: '700', 
          textAlign: 'center', 
          marginBottom: '40px',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          Blinders
        </h1>
      
      <div style={{ 
        background: 'rgba(255, 255, 255, 0.1)', 
        borderRadius: '16px', 
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ 
              margin: '0 0 4px 0', 
              fontSize: '1.2em', 
              opacity: 0.9
            }}>
              Select projects to review
            </h2>
            {weeklyReview && (
              <div style={{ 
                fontSize: '0.85em', 
                opacity: 0.7,
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {weeklyReview.state === 'in_progress' && (
                  <span style={{ color: '#FFC107' }}>● Review in progress</span>
                )}
                {weeklyReview.state === 'completed' && (
                  <span style={{ color: '#4CAF50' }}>✓ Review completed</span>
                )}
                {reviewedProjects.size > 0 && (
                  <span>({reviewedProjects.size} reviewed this week)</span>
                )}
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <ThemeSelector />
            
            <button
              onClick={gotoSomedayReview}
              style={{
                background: 'rgba(255, 193, 7, 0.2)',
                color: '#FFC107',
                border: '1px solid rgba(255, 193, 7, 0.4)',
                borderRadius: '8px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '0.9em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
              title="Review Someday/Maybe items"
            >
              <Sparkles size={16} />
            </button>
            
            <button
              onClick={gotoQuestions}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '0.9em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
              title="Edit Questions"
            >
              <Settings size={16} />
            </button>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                style={{
                  background: isSyncing ? 'rgba(255, 255, 255, 0.1)' : 'rgba(76, 175, 80, 0.3)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  cursor: isSyncing ? 'not-allowed' : 'pointer',
                  fontSize: '0.9em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <RefreshCw size={16} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
                {isSyncing ? 'Syncing...' : 'Re-Sync'}
              </button>
              
              <div style={{ 
                fontSize: '0.75em', 
                opacity: 0.6,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>Last synced: {lastSyncText}</span>
                {syncManager.shouldAutoSync() && (
                  <span style={{ color: '#ffd700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> Cache is old
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Data source banner - shows when using JXA fallback */}
        <DataSourceBanner 
          dataSource={dataSourceInfo.source} 
          fallbackReason={dataSourceInfo.reason} 
        />
        
        {syncError && (
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            background: 'rgba(255, 68, 68, 0.2)',
            border: '1px solid rgba(255, 68, 68, 0.4)',
            borderRadius: '8px',
            color: '#ff4444',
            fontSize: '0.9em'
          }}>
            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} /> Error:
            </strong> {syncError}
          </div>
        )}
        
        {showOF4Note && (
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            background: 'rgba(100, 181, 246, 0.2)',
            border: '1px solid rgba(100, 181, 246, 0.3)',
            borderRadius: '8px',
            fontSize: '0.85em',
            opacity: 0.9,
            position: 'relative'
          }}>
            <button
              onClick={() => {
                localStorage.setItem('blinders-hide-of4-note', 'true')
                setShowOF4Note(false)
              }}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.7)',
                cursor: 'pointer',
                fontSize: '1.2em',
                padding: '4px 8px',
                lineHeight: 1
              }}
              title="Dismiss"
            >
              ✕
            </button>
            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Info size={16} /> Note:
            </strong> This app is designed for OmniFocus 4 and may not work with earlier versions.
          </div>
        )}
        
        {integrationStatus.method === 'file-upload' && (
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            background: 'rgba(255, 193, 7, 0.2)',
            border: '1px solid rgba(255, 193, 7, 0.3)',
            borderRadius: '8px',
            fontSize: '0.9em',
            opacity: 0.9
          }}>
            <strong>Note:</strong> {integrationStatus.message}
          </div>
        )}
        
        <ul className="list">
          {queue.map(p => {
            const stats = taskStats[p.id] || { total: 0, next: 0, available: 0, blocked: 0, completed: 0 }
            return (
              <li key={p.id}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  cursor: 'pointer',
                  fontSize: '1.1em'
                }}>
                  <input 
                    type="checkbox" 
                    checked={sel.has(p.id)} 
                    onChange={e => {
                      const s = new Set(sel); 
                      if (e.target.checked) {
                        s.add(p.id)
                      } else {
                        s.delete(p.id)
                      }
                      setSel(s)
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>{p.name}</span>
                    {reviewedProjects.has(p.id) && (
                      <span title="Reviewed this week">
                        <CheckCircle2 size={16} style={{ color: '#4CAF50', opacity: 0.8 }} />
                      </span>
                    )}
                    {stats.total > 0 && (
                        <div style={{ 
                          display: 'flex', 
                          gap: '8px', 
                          fontSize: '0.9em',
                          opacity: 0.8
                        }}>
                          {stats.next > 0 && (
                            <span style={{ color: '#4CAF50', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Next Actions">
                              <ClipboardList size={14} /> {stats.next}
                            </span>
                          )}
                          {stats.available > 0 && (
                            <span style={{ color: '#2196F3', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Available">
                              <ClipboardList size={14} /> {stats.available}
                            </span>
                          )}
                          {stats.blocked > 0 && (
                            <span style={{ color: '#FF9800', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Blocked">
                              <Ban size={14} /> {stats.blocked}
                            </span>
                          )}
                          {stats.completed > 0 && (
                            <span style={{ color: '#9E9E9E', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Completed">
                              <CheckCircle2 size={14} /> {stats.completed}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {stats.total > 0 && (
                      <div style={{ 
                        fontSize: '0.8em', 
                        opacity: 0.6, 
                        marginTop: '2px',
                        color: 'rgba(255, 255, 255, 0.7)'
                      }}>
                        {stats.total} total tasks
                      </div>
                    )}
                  </div>
                </label>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
    
    {/* Sticky button - OUTSIDE .page div so it's truly fixed to viewport */}
    <div className="actions sticky-actions">
      <button 
        className="primary" 
        onClick={() => start(ids.length ? ids : queue.map(p=>p.id))}
        style={{ fontSize: '1.2em', padding: '20px 40px' }}
      >
        {weeklyReview?.state === 'in_progress' ? 'Resume Weekly Review' : 'Start Weekly Review'} ({ids.length || queue.length} projects)
      </button>
    </div>
    </>
  )
}

import { useMemo, useState, useEffect } from 'react'
import { useApp } from '../store'
import OmniFocusImporter from '../components/OmniFocusImporter'
import { importOmniFocusProjectsWithTasks, getOmniFocusIntegrationStatus } from '../repos/projectsRepo'
import { getTaskStatisticsBatch } from '../repos/tasksRepo'
import { syncManager } from '../services/syncManager'
import type { ProjectDTO } from '../types'

export default function QueueScreen() {
  const { queue, start, loadQueue, syncFromOmniFocus } = useApp()
  const [sel, setSel] = useState<Set<string>>(new Set())
  
  // Auto-select all projects when queue changes
  useEffect(() => {
    setSel(new Set(queue.map(p => p.id)))
  }, [queue])
  const [showImporter, setShowImporter] = useState(false)
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
  
  const handleProjectsImported = async (projects: ProjectDTO[]) => {
    await importOmniFocusProjectsWithTasks(projects)
    await loadQueue()
    setShowImporter(false)
  }
  
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
  useEffect(() => {
    if (queue.length > 0) {
      loadTaskStatistics()
    }
  }, [queue])
  
  return (
    <div className="page">
      <h1 style={{ 
        fontSize: '3em', 
        fontWeight: '700', 
        textAlign: 'center', 
        marginBottom: '40px',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}>
        Weekly Review Queue
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
            <div style={{ 
              fontSize: '0.85em', 
              opacity: 0.7,
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span>Last synced: {lastSyncText}</span>
              {syncManager.shouldAutoSync() && (
                <span style={{ color: '#ffd700' }}>⚠️ Cache is old - consider syncing</span>
              )}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
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
              {isSyncing ? '⏳ Syncing...' : '🔄 Sync from OmniFocus'}
            </button>
            
            <button
              onClick={() => setShowImporter(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '0.9em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📁 Import File
            </button>
          </div>
        </div>
        
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
            <strong>⚠️ Error:</strong> {syncError}
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
                      e.target.checked ? s.add(p.id) : s.delete(p.id); 
                      setSel(s)
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span>{p.name}</span>
                      {stats.total > 0 && (
                        <div style={{ 
                          display: 'flex', 
                          gap: '8px', 
                          fontSize: '0.9em',
                          opacity: 0.8
                        }}>
                          {stats.next > 0 && (
                            <span style={{ color: '#4CAF50' }} title="Next Actions">
                              ▶️ {stats.next}
                            </span>
                          )}
                          {stats.available > 0 && (
                            <span style={{ color: '#2196F3' }} title="Available">
                              📋 {stats.available}
                            </span>
                          )}
                          {stats.blocked > 0 && (
                            <span style={{ color: '#FF9800' }} title="Blocked">
                              🚫 {stats.blocked}
                            </span>
                          )}
                          {stats.completed > 0 && (
                            <span style={{ color: '#9E9E9E' }} title="Completed">
                              ✅ {stats.completed}
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
        
        <div className="actions">
          <button 
            className="primary" 
            onClick={() => start(ids.length ? ids : queue.map(p=>p.id))}
            style={{ fontSize: '1.2em', padding: '20px 40px' }}
          >
            Start Review ({ids.length || queue.length} projects)
          </button>
        </div>
      </div>
      
      {showImporter && (
        <OmniFocusImporter
          onProjectsImported={handleProjectsImported}
          onClose={() => setShowImporter(false)}
        />
      )}
    </div>
  )
}

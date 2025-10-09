import { useEffect } from 'react'
import { useApp } from './store'
import QueueScreen from './screens/QueueScreen'
import FocusScreen from './screens/FocusScreen'
import SummaryScreen from './screens/SummaryScreen'
import { taskSyncQueue } from './services/taskSyncQueue'
import './App.css'

export default function App() {
  const { route, loadQueue } = useApp()
  
  useEffect(() => { 
    // Clear any stale sync queue items from previous sessions
    // This prevents issues with invalid merged updates from before bug fixes
    console.log('[App] Clearing task sync queue on startup')
    taskSyncQueue.clearAll()
    
    loadQueue()
    
    // Check Notion configuration on startup
    if (window.electronAPI?.notion) {
      window.electronAPI.notion.isConfigured().then(result => {
        if (result.configured) {
          console.log('✅ Notion sync is configured and enabled')
        } else {
          console.log('⚠️ Notion sync is NOT configured')
          console.log('   To enable: Set NOTION_TOKEN and NOTION_PROJECT_DB environment variables')
          console.log('   See: docs/omnifocus-notion-sync/README.md')
        }
      }).catch(error => {
        console.error('❌ Error checking Notion configuration:', error)
      })
    }
  }, [])
  
  if (route.name === 'queue') return <QueueScreen />
  if (route.name === 'focus') return <FocusScreen projectIndex={route.idx} />
  return <SummaryScreen />
}

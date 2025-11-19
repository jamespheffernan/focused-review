import { useEffect } from 'react'
import { useApp } from './store'
import QueueScreen from './screens/QueueScreen'
import FocusScreen from './screens/FocusScreen'
import SummaryScreen from './screens/SummaryScreen'
import QuestionsScreen from './screens/QuestionsScreen'
import DateParsingTest from './components/DateParsingTest'
import { taskSyncQueue } from './services/taskSyncQueue'
import { migrateToQuestionPackages } from './services/questionPackage-migration'
import './App.css'

export default function App() {
  const { route, syncFromOmniFocus } = useApp()
  
  // Debug route changes
  console.log('🔍 Current route:', route)
  
  useEffect(() => { 
    // Clear any stale sync queue items from previous sessions
    // This prevents issues with invalid merged updates from before bug fixes
    console.log('[App] Clearing task sync queue on startup')
    taskSyncQueue.clearAll()
    
    // Migrate questions from markdown to database (runs once)
    // migrateQuestionsToDatabase().catch(error => {
    //   console.error('❌ Question migration failed:', error)
    // })
    
    // Migrate to QuestionPackage system (runs once)
    migrateToQuestionPackages().catch(error => {
      console.error('❌ QuestionPackage migration failed:', error)
    })
    
    syncFromOmniFocus()
    
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
  }, []) // Remove syncFromOmniFocus from dependencies to prevent duplicate calls
  
  // Test page - accessible via URL parameter: ?test=date-parsing
  if (typeof window !== 'undefined' && window.location.search.includes('test=date-parsing')) {
    return <DateParsingTest />
  }
  
  if (route.name === 'queue') return <QueueScreen />
  if (route.name === 'focus') return <FocusScreen projectIndex={route.idx} />
  if (route.name === 'questions') return <QuestionsScreen />
  return <SummaryScreen />
}

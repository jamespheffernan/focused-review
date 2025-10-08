import { create } from 'zustand'
import type { ProjectDTO, QuestionDTO, AnswerDraft } from './types'
import * as Projects from './repos/projectsRepo'
import * as Answers from './repos/answersRepo'
import * as Sessions from './repos/sessionsRepo'
import { fetchTasksForProject } from './repos/tasksRepo'
import { getQuestionsForProject } from './services/question-loader'
import { getStartOfISOWeek } from './services/review-formatter'
import * as NotionSyncQueue from './repos/notionSyncQueueRepo'

// Fallback questions if markdown file can't be loaded
const FALLBACK_QUESTIONS: QuestionDTO[] = [
  { id:'q-purpose',  prompt:'Why am I doing this project?', type:'text', order:1 },
  { id:'q-reality',  prompt:'Where am I right now with it?', type:'text', order:2 },
  { id:'q-next',     prompt:'Is this the clearly defined, physical Next Action?', type:'text', order:3 },
  { id:'q-timeline', prompt:'What\'s the realistic timeline for this project?', type:'text', order:4 },
  { id:'q-align',    prompt:'Does this align with higher-level goals?', type:'text', order:5 },
  { id:'q-engage',   prompt:'Am I engaged and motivated?', type:'slider', order:6 }
]

/**
 * Trigger Notion sync for a project's weekly review
 * Fetches answers, formats as markdown, and sends to main process
 * Non-blocking - fires and forgets, errors are added to retry queue
 */
async function triggerNotionSync(projectId: string, weekOf: string): Promise<void> {
  // Check if we're in Electron environment
  if (!window.electronAPI?.notion) {
    console.log('⏭️ Notion sync skipped: not in Electron environment')
    return
  }
  
  console.log(`🔄 Triggering Notion sync for project ${projectId}, week ${weekOf}`)
  
  try {
    // Step 1: Get answers for this project and week
    const answers = await Answers.getProjectAnswersForWeek(projectId, weekOf)
    
    if (answers.length === 0) {
      console.log(`⏭️ No answers found for project ${projectId}, week ${weekOf} - skipping sync`)
      return
    }
    
    console.log(`✅ Found ${answers.length} answers for project ${projectId}`)
    
    // Step 2: Get questions for formatting
    const hasHistory = await Answers.hasBeenReviewedBefore(projectId)
    const questions = await getQuestionsForProject(projectId, hasHistory)
    
    // Step 3: Format as markdown using review-formatter
    // Import dynamically to avoid circular dependencies
    const { formatReviewAsMarkdown } = await import('./services/review-formatter')
    const markdown = formatReviewAsMarkdown(answers, questions, weekOf)
    
    console.log(`✅ Formatted review as markdown (${markdown.length} characters)`)
    
    // Step 4: Send to main process for Notion API call
    const result = await window.electronAPI.notion.syncReview(projectId, weekOf, markdown)
    
    if (result.success) {
      console.log(`✅ Notion sync completed for project ${projectId}`)
    } else if (result.skipped) {
      console.log(`⏭️ Notion sync skipped: ${result.reason}`)
      // Don't queue if skipped (e.g., not configured, no page found, duplicate)
    } else {
      console.error(`❌ Notion sync failed: ${result.error}`)
      // Add to queue for retry
      await NotionSyncQueue.addToQueue(projectId, weekOf)
      throw new Error(result.error || 'Unknown sync error')
    }
  } catch (error) {
    console.error('❌ Notion sync error:', error)
    // Ensure it's in the queue
    await NotionSyncQueue.addToQueue(projectId, weekOf)
    throw error
  }
}

// Generate context-aware questions based on project tasks and review history
const generateContextAwareQuestions = async (project: ProjectDTO): Promise<QuestionDTO[]> => {
  try {
    // Check if project has been reviewed before
    const hasBeenReviewed = await Answers.hasBeenReviewedBefore(project.id)
    
    // Get appropriate questions based on review history
    const baseQuestions = await getQuestionsForProject(project.id, hasBeenReviewed)
    
    const tasks = await fetchTasksForProject(project.id)
    const nextTasks = tasks.filter(t => t.status === 'next' && !t.completed)
    const blockedTasks = tasks.filter(t => t.status === 'blocked' && !t.completed)
    const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed)
    
    const questions = [...baseQuestions]
    
    // Add task-specific questions if there are tasks
    if (tasks.length > 0) {
      if (nextTasks.length > 0) {
        questions.push({
          id: 'q-next-tasks',
          prompt: `What are your next actions for this project? (${nextTasks.length} identified)`,
          type: 'text',
          order: 3.5
        })
      }
      
      if (blockedTasks.length > 0) {
        questions.push({
          id: 'q-blocked-tasks',
          prompt: `What's blocking progress on this project? (${blockedTasks.length} blocked tasks)`,
          type: 'text',
          order: 4.5
        })
      }
      
      if (overdueTasks.length > 0) {
        questions.push({
          id: 'q-overdue-tasks',
          prompt: `How will you handle overdue tasks? (${overdueTasks.length} overdue)`,
          type: 'text',
          order: 5.5
        })
      }
      
      // Add a general task review question
      questions.push({
        id: 'q-task-review',
        prompt: `Review your project tasks - any updates needed? (${tasks.length} total tasks)`,
        type: 'text',
        order: 6
      })
    }
    
    return questions.sort((a, b) => a.order - b.order)
  } catch (error) {
    console.error('Error generating context-aware questions:', error)
    return FALLBACK_QUESTIONS
  }
}

type Route = { name:'queue' } | { name:'focus', idx:number } | { name:'summary' }

type State = {
  route: Route
  queue: ProjectDTO[]
  sessionID?: string
  questions: QuestionDTO[]
  currentProjectQuestions: QuestionDTO[]
  drafts: Record<string, AnswerDraft> // key = projectID|questionID
  projectStartTime: number | null
  loadQueue: () => Promise<void>
  syncFromOmniFocus: () => Promise<void>
  start: (ids: string[]) => Promise<void>
  setDraft: (d: AnswerDraft) => Promise<void>
  markReviewedAndNext: (project: ProjectDTO, idx: number) => Promise<void>
  skipAndNext: (idx: number) => void
  gotoSummary: () => void
  loadProjectQuestions: (project: ProjectDTO) => Promise<void>
}

export const useApp = create<State>((set, get) => ({
  route: { name:'queue' },
  queue: [],
  questions: FALLBACK_QUESTIONS,
  currentProjectQuestions: FALLBACK_QUESTIONS,
  drafts: {},
  projectStartTime: null,

  loadQueue: async () => {
    console.log('📦 [Store] loadQueue called')
    const projects = await Projects.fetchDueForReview()
    console.log(`📦 [Store] loadQueue received ${projects.length} projects`)
    console.log('📦 [Store] Sample project:', projects[0])
    set({ queue: projects })
    console.log('📦 [Store] Queue state updated')
  },

  syncFromOmniFocus: async () => {
    console.log('🔄 [Store] syncFromOmniFocus called')
    const projects = await Projects.syncFromOmniFocus()
    console.log(`🔄 [Store] syncFromOmniFocus received ${projects.length} projects`)
    if (projects.length > 0) {
      console.log('🔄 [Store] Sample project:', projects[0])
    } else {
      console.warn('⚠️ [Store] No projects returned from syncFromOmniFocus!')
    }
    set({ queue: projects })
    console.log('🔄 [Store] Queue state updated, new queue length:', projects.length)
  },

  start: async (ids) => {
    const queue = (await Projects.fetchDueForReview()).filter(p => ids.includes(p.id))
    const s = await Sessions.startSession(queue)
    set({ queue, sessionID: s.id, route: { name:'focus', idx: 0 }, projectStartTime: Date.now() })
    
    // Load context-aware questions for the first project
    if (queue.length > 0) {
      const questions = await generateContextAwareQuestions(queue[0])
      set({ currentProjectQuestions: questions })
    }
  },

  loadProjectQuestions: async (project) => {
    const questions = await generateContextAwareQuestions(project)
    set({ currentProjectQuestions: questions })
  },

  setDraft: async (d) => {
    await Answers.upsert(d)
    const key = `${d.projectID}|${d.questionID}`
    set({ drafts: { ...get().drafts, [key]: d } })
  },

  markReviewedAndNext: async (project, idx) => {
    // Calculate time spent on this project
    const timeSpentSec = get().projectStartTime 
      ? Math.round((Date.now() - get().projectStartTime!) / 1000)
      : 0
    
    // Mark project as reviewed in OmniFocus
    await Projects.markReviewed(project.id, new Date().toISOString())
    
    // Update session statistics
    await Sessions.incrementProjectsReviewed(get().sessionID, timeSpentSec)
    
    // Trigger Notion sync asynchronously (non-blocking)
    // If it fails, it will be queued for retry
    const weekOf = getStartOfISOWeek()
    triggerNotionSync(project.id, weekOf).catch(error => {
      console.error('❌ Notion sync failed (queued for retry):', error)
    })
    
    // Continue to next project without waiting for sync
    const next = idx + 1
    if (next < get().queue.length) {
      const nextProject = get().queue[next]
      const questions = await generateContextAwareQuestions(nextProject)
      set({ 
        route: { name:'focus', idx: next },
        currentProjectQuestions: questions,
        projectStartTime: Date.now() // Reset timer for next project
      })
    } else {
      set({ route: { name:'summary' } })
    }
  },

  skipAndNext: async (idx) => {
    // Calculate time spent on this project
    const timeSpentSec = get().projectStartTime 
      ? Math.round((Date.now() - get().projectStartTime!) / 1000)
      : 0
    
    // Update session statistics
    await Sessions.incrementProjectsSkipped(get().sessionID, timeSpentSec)
    
    const next = idx + 1
    if (next < get().queue.length) {
      const nextProject = get().queue[next]
      const questions = await generateContextAwareQuestions(nextProject)
      set({ 
        route: { name:'focus', idx: next },
        currentProjectQuestions: questions,
        projectStartTime: Date.now() // Reset timer for next project
      })
    } else {
      set({ route: { name:'summary' } })
    }
  },

  gotoSummary: () => set({ route: { name:'summary' } })
}))

/**
 * Background process to retry failed Notion syncs
 * Runs every 5 minutes
 */
async function startQueueProcessor() {
  const INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
  
  // Clean up any duplicate queue items on startup
  try {
    const removed = await NotionSyncQueue.removeDuplicates()
    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} duplicate queue items on startup`)
    }
  } catch (error) {
    console.error('❌ Error removing duplicates:', error)
  }
  
  async function processRetries() {
    try {
      const stats = await NotionSyncQueue.getQueueStats()
      const totalQueued = stats.pending + stats.retrying
      
      if (totalQueued === 0) {
        return
      }
      
      console.log(`🔄 Processing Notion sync queue: ${totalQueued} items (${stats.pending} pending, ${stats.retrying} retrying, ${stats.failed} failed)`)
      
      // Process queue using triggerNotionSync as the sync function
      const syncFunction = async (projectId: string, weekOf: string) => {
        try {
          await triggerNotionSync(projectId, weekOf)
          return true
        } catch (error) {
          // Error already logged and queued by triggerNotionSync
          return false
        }
      }
      
      const result = await NotionSyncQueue.processQueue(syncFunction)
      console.log(`✅ Queue processing complete: ${result.processed} succeeded, ${result.failed} failed`)
    } catch (error) {
      console.error('❌ Error processing Notion sync queue:', error)
    }
  }
  
  // Run immediately on startup
  processRetries()
  
  // Then run periodically
  setInterval(processRetries, INTERVAL_MS)
  
  console.log('🔄 Notion sync queue processor started (runs every 5 minutes)')
}

// Start queue processor when module loads
if (typeof window !== 'undefined' && window.electronAPI?.notion) {
  startQueueProcessor()
}

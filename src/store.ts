import { create } from 'zustand'
import type { ProjectDTO, QuestionDTO, AnswerDraft, WeeklyReviewDTO, TimelineCommitmentDTO, QuestionType, TaskDTO } from './types'
import * as Projects from './repos/projectsRepo'
import * as Answers from './repos/answersRepo'
import * as Sessions from './repos/sessionsRepo'
import * as WeeklyReviews from './repos/weeklyReviewsRepo'
import * as Tasks from './repos/tasksRepo'
import { getQuestionsForProject } from './services/question-loader'
import { getStartOfISOWeek } from './services/review-formatter'
import { hasValidTimeline } from './utils/timeline-validation'
import * as NotionSyncQueue from './repos/notionSyncQueueRepo'
import { syncAnswerToTimelineCache, shouldSyncToTimelineCache } from './services/timeline-cache'
import { getCommitmentsForWeek, getCommitmentsForProject } from './repos/timelineCommitmentsRepo'
import { getLastWeekAnswerHint } from './utils/question-hints'
import { db } from './db'

declare global {
  interface Window {
    __APP_TEST_API__?: {
      resetDatabase: () => Promise<void>
      insertProject: (project: ProjectDTO) => Promise<void>
      insertAnswer: (answer: AnswerDraft) => Promise<void>
      syncTimeline: (answer: AnswerDraft, project: ProjectDTO) => Promise<void>
      getCommitmentsForWeek: (weekOf: string) => Promise<TimelineCommitmentDTO[]>
      getCommitmentsForProject: (projectId: string) => Promise<TimelineCommitmentDTO[]>
      getLastWeekAnswerHint: (questionId: string, questionType: QuestionType) => string | null
      createTask: (projectId: string, task: Omit<TaskDTO, 'id' | 'lastModified' | 'syncState'>) => Promise<TaskDTO>
      getTasks: () => Promise<TaskDTO[]>
      clearTasks: () => Promise<void>
    }
    __TEST_STUBS__?: {
      createTaskCalls: Array<{ projectId: string; taskName: string; taskId: string }>
      setTaskTagsCalls: Array<{ taskId: string; tags: string[] }>
      setTaskDueDateCalls: Array<{ taskId: string; dueDate: string | null }>
      updateTaskCalls: Array<{ taskId: string; updates: any }>
    }
  }
}

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
  
  // Add to queue FIRST to prevent race conditions (even if sync succeeds immediately)
  const queueItem = await NotionSyncQueue.addToQueue(projectId, weekOf)
  if (!queueItem) {
    console.log(`⏭️ Notion sync already queued/in-progress for project ${projectId}, week ${weekOf}`)
    return
  }
  
  try {
    // Step 1: Get answers for this project and week
    const answers = await Answers.getProjectAnswersForWeek(projectId, weekOf)
    
    if (answers.length === 0) {
      console.log(`⏭️ No answers found for project ${projectId}, week ${weekOf} - skipping sync`)
      await NotionSyncQueue.markCompleted(queueItem.id) // Remove from queue
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
      await NotionSyncQueue.markCompleted(queueItem.id) // Remove from queue
    } else if (result.skipped) {
      console.log(`⏭️ Notion sync skipped: ${result.reason}`)
      await NotionSyncQueue.markCompleted(queueItem.id) // Remove from queue (already synced)
    } else {
      console.error(`❌ Notion sync failed: ${result.error}`)
      await NotionSyncQueue.markFailed(queueItem.id, result.error || 'Unknown error')
      throw new Error(result.error || 'Unknown sync error')
    }
  } catch (error) {
    console.error('❌ Notion sync error:', error)
    // Mark as failed (already in queue from line above)
    await NotionSyncQueue.markFailed(queueItem.id, error instanceof Error ? error.message : 'Unknown error')
    throw error
  }
}

// Generate context-aware questions based on project tasks and review history
const generateContextAwareQuestions = async (project: ProjectDTO): Promise<QuestionDTO[]> => {
  try {
    // Check if project has been reviewed before
    const hasBeenReviewed = await Answers.hasBeenReviewedBefore(project.id)
    
    // Get questions from QuestionPackage system
    const questions = await getQuestionsForProject(project.id, hasBeenReviewed)
    
    console.log(`📋 Questions for ${project.name} (hasBeenReviewed=${hasBeenReviewed}):`, questions.map(q => q.id))
    
    return questions
  } catch (error) {
    console.error('Error generating context-aware questions:', error)
    return FALLBACK_QUESTIONS
  }
}

type Route = { name:'queue' } | { name:'focus', idx:number } | { name:'summary' } | { name:'questions' }

type State = {
  route: Route
  queue: ProjectDTO[]
  sessionID?: string
  weeklyReview?: WeeklyReviewDTO
  questions: QuestionDTO[]
  currentProjectQuestions: QuestionDTO[]
  drafts: Record<string, AnswerDraft> // key = projectID|questionID
  projectStartTime: number | null
  calendarVisible: boolean
  calendarWeekOf: string
  reviewedProjectsThisSession: Set<string>
  loadQueue: () => Promise<void>
  syncFromOmniFocus: () => Promise<void>
  start: (ids: string[]) => Promise<void>
  setDraft: (d: AnswerDraft) => Promise<void>
  markReviewedAndNext: (project: ProjectDTO, idx: number) => Promise<void>
  skipAndNext: (idx: number) => void
  markCompleteAndNext: (project: ProjectDTO, idx: number) => Promise<void>
  archiveAndNext: (project: ProjectDTO, idx: number) => Promise<void>
  somedayMaybeAndNext: (project: ProjectDTO, idx: number) => Promise<void>
  gotoSummary: () => void
  gotoQuestions: () => void
  gotoQueue: () => void
  loadProjectQuestions: (project: ProjectDTO) => Promise<void>
  toggleCalendar: () => void
}

export const useApp = create<State>((set, get) => ({
  route: { name:'queue' },
  queue: [],
  questions: FALLBACK_QUESTIONS,
  currentProjectQuestions: FALLBACK_QUESTIONS,
  drafts: {},
  projectStartTime: null,
  calendarVisible: false,
  calendarWeekOf: getStartOfISOWeek(),
  reviewedProjectsThisSession: new Set<string>(),

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
    try {
      const projects = await Projects.syncFromOmniFocus()
      console.log(`🔄 [Store] syncFromOmniFocus received ${projects.length} projects`)
      if (projects.length > 0) {
        console.log('🔄 [Store] Sample project:', projects[0])
      } else {
        console.warn('⚠️ [Store] No projects returned from syncFromOmniFocus!')
      }
      set({ queue: projects })
      console.log('🔄 [Store] Queue state updated, new queue length:', projects.length)
    } catch (error) {
      console.error('❌ [Store] Error in syncFromOmniFocus:', error)
      console.error('❌ [Store] Error details:', error)
      // Set empty queue on error to prevent hanging
      set({ queue: [] })
      throw error
    }
  },

  start: async (ids) => {
    const weekOf = getStartOfISOWeek()
    
    // TEMPORARILY DISABLED: WeeklyReview functionality
    // TODO: Re-enable after fixing production build hang
    /*
    // Get or create weekly review for this week
    const weeklyReview = await WeeklyReviews.getOrCreateWeeklyReviewForWeek(weekOf)
    
    // Update state to in_progress if not already
    if (weeklyReview.state !== 'in_progress') {
      await WeeklyReviews.updateWeeklyReviewState(weeklyReview.id, 'in_progress')
      weeklyReview.state = 'in_progress'
      if (!weeklyReview.startedAt) {
        weeklyReview.startedAt = new Date().toISOString()
      }
    }
    */
    const weeklyReview = undefined
    
    // Get all due projects (including already reviewed ones)
    const allDueProjects = await Projects.fetchDueForReview()
    const queue = allDueProjects.filter(p => ids.includes(p.id))
    
    // Find first unreviewed project (no answers for this week)
    let firstUnreviewedIdx = 0
    const reviewedThisWeek = new Set<string>()
    for (let i = 0; i < queue.length; i++) {
      const project = queue[i]
      const answers = await Answers.getProjectAnswersForWeek(project.id, weekOf)
      if (answers.length === 0) {
        if (firstUnreviewedIdx === 0) {
          firstUnreviewedIdx = i
        }
      } else {
        // Project has been reviewed this week
        reviewedThisWeek.add(project.id)
      }
    }
    
    // Start session linked to weekly review
    const s = await Sessions.startSession(undefined) // weeklyReview?.id)
    
    set({ 
      queue, 
      sessionID: s.id, 
      weeklyReview,
      route: { name:'focus', idx: firstUnreviewedIdx }, 
      projectStartTime: Date.now(),
      reviewedProjectsThisSession: reviewedThisWeek
    })
    
    // Load context-aware questions for the first project
    if (queue.length > 0) {
      const questions = await generateContextAwareQuestions(queue[firstUnreviewedIdx])
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
    
    // Sync to timeline cache if this is a timeline question
    if (shouldSyncToTimelineCache(d.questionID)) {
      // Try to find project in queue first, otherwise fetch from database
      let project = get().queue.find(p => p.id === d.projectID)
      if (!project) {
        project = await db.projects.get(d.projectID) || undefined
      }
      if (project) {
        syncAnswerToTimelineCache(d, project).catch(error => {
          console.error('❌ Failed to sync answer to timeline cache:', error)
        })
      } else {
        console.warn(`⚠️ Could not find project ${d.projectID} for timeline sync`)
      }
    }
  },

  markReviewedAndNext: async (project, idx) => {
    // Validate that project has a valid timeline before marking reviewed
    const weekOf = getStartOfISOWeek()
    const hasTimeline = await hasValidTimeline(project.id, weekOf)
    if (!hasTimeline) {
      throw new Error('Cannot mark project as reviewed: A valid timeline date is required. Please answer the timeline question with a date before marking reviewed.')
    }
    
    // Calculate time spent on this project
    const timeSpentSec = get().projectStartTime 
      ? Math.round((Date.now() - get().projectStartTime!) / 1000)
      : 0
    
    // Track reviewed project for calendar filtering
    const reviewed = new Set(get().reviewedProjectsThisSession)
    reviewed.add(project.id)
    
    // Queue OmniFocus update in background (non-blocking)
    Projects.markReviewed(project.id, new Date().toISOString()).catch(error => {
      console.error('❌ Mark reviewed failed:', error)
    })
    
    // Update session statistics in background (non-blocking)
    Sessions.incrementProjectsReviewed(get().sessionID, timeSpentSec).catch(error => {
      console.error('❌ Update session stats failed:', error)
    })
    
    // Trigger Notion sync asynchronously (non-blocking)
    // If it fails, it will be queued for retry
    triggerNotionSync(project.id, weekOf).catch(error => {
      console.error('❌ Notion sync failed (queued for retry):', error)
    })
    
    // Continue to next project immediately without waiting
    const next = idx + 1
    if (next < get().queue.length) {
      const nextProject = get().queue[next]
      const questions = await generateContextAwareQuestions(nextProject)
      set({ 
        route: { name:'focus', idx: next },
        currentProjectQuestions: questions,
        projectStartTime: Date.now(), // Reset timer for next project
        reviewedProjectsThisSession: reviewed
      })
    } else {
      // All projects reviewed - mark weekly review as completed
      // TEMPORARILY DISABLED
      /*
      const weeklyReview = get().weeklyReview
      if (weeklyReview) {
        await WeeklyReviews.updateWeeklyReviewState(weeklyReview.id, 'completed')
        weeklyReview.state = 'completed'
        weeklyReview.completedAt = new Date().toISOString()
      }
      */
      set({ route: { name:'summary' }, reviewedProjectsThisSession: reviewed })
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

  markCompleteAndNext: async (project, idx) => {
    // Calculate time spent on this project
    const timeSpentSec = get().projectStartTime 
      ? Math.round((Date.now() - get().projectStartTime!) / 1000)
      : 0
    
    // Mark project as reviewed AND complete in OmniFocus (background)
    if (window.electronAPI?.omnifocus) {
      window.electronAPI.omnifocus.markProjectReviewed(project.id).catch(error => {
        console.error('❌ Mark reviewed failed:', error)
      })
      window.electronAPI.omnifocus.markProjectComplete(project.id).catch(error => {
        console.error('❌ Mark complete failed:', error)
      })
    }
    
    // Update local database
    Projects.markReviewed(project.id, new Date().toISOString()).catch(error => {
      console.error('❌ Local mark reviewed failed:', error)
    })
    
    // Update session statistics (count as reviewed)
    Sessions.incrementProjectsReviewed(get().sessionID, timeSpentSec).catch(error => {
      console.error('❌ Update session stats failed:', error)
    })
    
    // Continue to next project immediately
    const next = idx + 1
    if (next < get().queue.length) {
      const nextProject = get().queue[next]
      const questions = await generateContextAwareQuestions(nextProject)
      set({ 
        route: { name:'focus', idx: next },
        currentProjectQuestions: questions,
        projectStartTime: Date.now()
      })
    } else {
      set({ route: { name:'summary' } })
    }
  },

  archiveAndNext: async (project, idx) => {
    // Calculate time spent on this project
    const timeSpentSec = get().projectStartTime 
      ? Math.round((Date.now() - get().projectStartTime!) / 1000)
      : 0
    
    // Mark project as reviewed AND complete in OmniFocus (background)
    if (window.electronAPI?.omnifocus) {
      window.electronAPI.omnifocus.markProjectReviewed(project.id).catch(error => {
        console.error('❌ Mark reviewed failed:', error)
      })
      window.electronAPI.omnifocus.markProjectComplete(project.id).catch(error => {
        console.error('❌ Mark complete failed:', error)
      })
    }
    
    // Move Notion page to Archive database (background)
    if (window.electronAPI?.notion) {
      const notionApi = window.electronAPI.notion
      // Get archive database ID from main process
      notionApi.isConfigured().then(config => {
        if (config.archiveDb) {
          // Now move to archive
          notionApi.moveToDatabase(project.id, config.archiveDb, {
            ofId: project.id,
            name: project.name,
            status: 'done status'
          }).catch(error => {
            console.error('❌ Archive to Notion failed:', error)
          })
        } else {
          console.log('⏭️ Notion archive not configured, skipping')
        }
      }).catch(error => {
        console.error('❌ Get Notion config failed:', error)
      })
    }
    
    // Update local database
    Projects.markReviewed(project.id, new Date().toISOString()).catch(error => {
      console.error('❌ Local mark reviewed failed:', error)
    })
    
    // Update session statistics
    Sessions.incrementProjectsReviewed(get().sessionID, timeSpentSec).catch(error => {
      console.error('❌ Update session stats failed:', error)
    })
    
    // Continue to next project immediately
    const next = idx + 1
    if (next < get().queue.length) {
      const nextProject = get().queue[next]
      const questions = await generateContextAwareQuestions(nextProject)
      set({ 
        route: { name:'focus', idx: next },
        currentProjectQuestions: questions,
        projectStartTime: Date.now()
      })
    } else {
      set({ route: { name:'summary' } })
    }
  },

  somedayMaybeAndNext: async (project, idx) => {
    console.log(`🔄 somedayMaybeAndNext called for project: ${project.name} (${project.id})`)
    
    // Calculate time spent on this project
    const timeSpentSec = get().projectStartTime 
      ? Math.round((Date.now() - get().projectStartTime!) / 1000)
      : 0
    
    // Drop project in OmniFocus (background)
    if (window.electronAPI?.omnifocus) {
      console.log('🔄 Dropping project in OmniFocus...')
      window.electronAPI.omnifocus.dropProject(project.id).then(result => {
        console.log('✅ Drop project result:', result)
      }).catch(error => {
        console.error('❌ Drop project failed:', error)
      })
    } else {
      console.log('⚠️ No OmniFocus API available')
    }
    
    // Move Notion page to Someday/Maybe database (background)
    if (window.electronAPI?.notion) {
      console.log('🔄 Checking Notion configuration...')
      const notionApi = window.electronAPI.notion
      // Get someday database ID from main process
      notionApi.isConfigured().then(async config => {
        console.log('✅ Notion config received:', config)
        if (config.somedayDb) {
          console.log(`🔄 Moving to Someday/Maybe database: ${config.somedayDb}`)
          
          try {
            // Step 1: Fetch tasks from IndexedDB for this project
            console.log('📋 Fetching tasks for project...')
            const { db } = await import('./db')
            const projectTasks = await db.tasks
              .where('projectId')
              .equals(project.id)
              .toArray()
            
            console.log(`📋 Found ${projectTasks.length} tasks for project`)
            
            // Step 2: Find the Notion page ID for this project
            console.log('🔍 Finding Notion page for project...')
            // const pageResult = await notionApi.findPageByProjectId(project.id)
            // const pageId = pageResult.success ? pageResult.pageId : null
            const pageId = null // Temporarily disabled
            
            if (pageId && projectTasks.length > 0) {
              // Step 3: Append tasks log to the Notion page
              console.log('📝 Appending tasks log to Notion page...')
              // const tasksLogResult = await notionApi.appendTasksLog(pageId, projectTasks.map(task => ({
              //   name: task.name,
              //   dueDate: task.dueDate,
              //   context: task.context,
              //   completed: task.completed
              // })))
              
              // if (tasksLogResult.success) {
              //   console.log('✅ Tasks log appended successfully')
              // } else {
              //   console.error('❌ Failed to append tasks log:', tasksLogResult.error)
              // }
            } else if (!pageId) {
              console.log('⏭️ No Notion page found for project, skipping tasks log')
            } else {
              console.log('⏭️ No tasks found for project, skipping tasks log')
            }
            
            // Step 4: Move to someday/maybe database (this will copy all content including the tasks log)
            console.log('🔄 Moving page to Someday/Maybe database...')
            const moveResult = await notionApi.moveToDatabase(project.id, config.somedayDb, {
              ofId: project.id,
              name: project.name,
              status: 'dropped status'
            })
            
            console.log('✅ Move to Someday/Maybe result:', moveResult)
          } catch (error) {
            console.error('❌ Move to Someday/Maybe failed:', error)
          }
        } else {
          console.log('⏭️ Notion someday/maybe not configured, skipping')
          console.log('   config.somedayDb =', config.somedayDb)
        }
      }).catch(error => {
        console.error('❌ Get Notion config failed:', error)
      })
    } else {
      console.log('⚠️ No Notion API available')
    }
    
    // Update session statistics (count as skipped)
    Sessions.incrementProjectsSkipped(get().sessionID, timeSpentSec).catch(error => {
      console.error('❌ Update session stats failed:', error)
    })
    
    // Continue to next project immediately
    const next = idx + 1
    if (next < get().queue.length) {
      const nextProject = get().queue[next]
      const questions = await generateContextAwareQuestions(nextProject)
      set({ 
        route: { name:'focus', idx: next },
        currentProjectQuestions: questions,
        projectStartTime: Date.now()
      })
    } else {
      set({ route: { name:'summary' } })
    }
  },

  gotoSummary: () => set({ route: { name:'summary' } }),
  
  gotoQuestions: () => {
    console.log('🔧 gotoQuestions called, setting route to questions')
    set({ route: { name:'questions' } })
  },
  
  gotoQueue: () => set({ route: { name:'queue' } }),
  
  toggleCalendar: () => {
    set({ calendarVisible: !get().calendarVisible })
  }
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
  
  // Clean up any duplicate answers on startup
  try {
    const removed = await Answers.removeDuplicateAnswers()
    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} duplicate answers on startup`)
    }
  } catch (error) {
    console.error('❌ Error removing duplicate answers:', error)
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

if (typeof window !== 'undefined') {
  const ensureDbOpen = async () => {
    if (!db.isOpen()) {
      await db.open()
    }
  }

  if (!window.__APP_TEST_API__) {
    window.__APP_TEST_API__ = {
      resetDatabase: async () => {
        await db.delete()
        await db.open()
      },
      insertProject: async (project: ProjectDTO) => {
        await ensureDbOpen()
        await db.projects.put(project)
      },
      insertAnswer: async (answer: AnswerDraft) => {
        await ensureDbOpen()
        await db.answers.put(answer)
      },
      syncTimeline: async (answer: AnswerDraft, project: ProjectDTO) => {
        await ensureDbOpen()
        await syncAnswerToTimelineCache(answer, project)
      },
      getCommitmentsForWeek: async (weekOf: string) => {
        await ensureDbOpen()
        return await getCommitmentsForWeek(weekOf)
      },
      getCommitmentsForProject: async (projectId: string) => {
        await ensureDbOpen()
        return await getCommitmentsForProject(projectId)
      },
      getLastWeekAnswerHint: (questionId: string, questionType: QuestionType) => {
        return getLastWeekAnswerHint(questionId, questionType)
      },
      createTask: async (projectId: string, task: Omit<TaskDTO, 'id' | 'lastModified' | 'syncState'>) => {
        await ensureDbOpen()
        return await Tasks.createTask(projectId, task)
      },
      getTasks: async () => {
        await ensureDbOpen()
        return await db.tasks.toArray()
      },
      clearTasks: async () => {
        await ensureDbOpen()
        await db.tasks.clear()
      }
    }
  }
}

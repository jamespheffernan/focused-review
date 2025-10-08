import { create } from 'zustand'
import type { ProjectDTO, QuestionDTO, AnswerDraft } from './types'
import * as Projects from './repos/projectsRepo'
import * as Answers from './repos/answersRepo'
import * as Sessions from './repos/sessionsRepo'
import { fetchTasksForProject } from './repos/tasksRepo'
import { getQuestionsForProject } from './services/question-loader'

// Fallback questions if markdown file can't be loaded
const FALLBACK_QUESTIONS: QuestionDTO[] = [
  { id:'q-purpose',  prompt:'Why am I doing this project?', type:'text', order:1 },
  { id:'q-reality',  prompt:'Where am I right now with it?', type:'text', order:2 },
  { id:'q-next',     prompt:'Is this the clearly defined, physical Next Action?', type:'text', order:3 },
  { id:'q-timeline', prompt:'What\'s the realistic timeline for this project?', type:'text', order:4 },
  { id:'q-align',    prompt:'Does this align with higher-level goals?', type:'text', order:5 },
  { id:'q-engage',   prompt:'Am I engaged and motivated?', type:'slider', order:6 }
]

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
    set({ queue, sessionID: s.id, route: { name:'focus', idx: 0 } })
    
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
    await Projects.markReviewed(project.id, new Date().toISOString())
    const next = idx + 1
    if (next < get().queue.length) {
      const nextProject = get().queue[next]
      const questions = await generateContextAwareQuestions(nextProject)
      set({ 
        route: { name:'focus', idx: next },
        currentProjectQuestions: questions
      })
    } else {
      set({ route: { name:'summary' } })
    }
  },

  skipAndNext: async (idx) => {
    const next = idx + 1
    if (next < get().queue.length) {
      const nextProject = get().queue[next]
      const questions = await generateContextAwareQuestions(nextProject)
      set({ 
        route: { name:'focus', idx: next },
        currentProjectQuestions: questions
      })
    } else {
      set({ route: { name:'summary' } })
    }
  },

  gotoSummary: () => set({ route: { name:'summary' } })
}))

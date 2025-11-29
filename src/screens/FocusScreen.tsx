import { useEffect, useMemo, useState, useCallback } from 'react'
import { useApp } from '../store'
import type { AnswerDraft, TaskDTO, QuestionDTO } from '../types'
import { createTimer } from '../services/timer'
import { latest, getInitialAnswer } from '../repos/answersRepo'
import { fetchTasksForProject, updateTask, deleteTask } from '../repos/tasksRepo'
import { db } from '../db'
import { getStartOfISOWeek } from '../services/review-formatter'
import TimerCircle from '../components/TimerCircle'
import KeyboardShortcuts from '../components/KeyboardShortcuts'
import TaskList from '../components/TaskList'
import FloatingInboxButton from '../components/FloatingInboxButton'
import ProjectNavigator from '../components/ProjectNavigator'
import CalendarOverlay from '../components/CalendarOverlay'
import ActionConfirmationOverlay from '../components/ActionConfirmationOverlay'
import TimelineHistory from '../components/TimelineHistory'
import { extractNotionLink, getNotionLinkError, hasNotionLink } from '../utils/notionLink'
import { parseNaturalDate, describeNaturalDate } from '../utils/date-parser'
import { getLastWeekAnswerHint } from '../utils/question-hints'
import { FileText, SkipForward, CheckCircle, ExternalLink, Calendar, History } from 'lucide-react'

export default function FocusScreen({ projectIndex }: { projectIndex: number }) {
  const { queue, currentProjectQuestions, setDraft, markReviewedAndNext, skipAndNext, markCompleteAndNext, archiveAndNext, somedayMaybeAndNext, loadProjectQuestions, calendarVisible, calendarWeekOf, reviewedProjectsThisSession, toggleCalendar } = useApp()
  const project = queue[projectIndex]
  const [idx, setIdx] = useState(0)
  const [remaining, setRemaining] = useState(30)
  const timer = useMemo(() => createTimer(setRemaining), [])
  const [answeredQuestions, setAnsweredQuestions] = useState<Array<{id: string, prompt: string, answer: string, status: 'answered' | 'skipped', draftStatus?: 'CarriedForward' | 'Updated' | 'New'}>>([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [lastWeekAnswer, setLastWeekAnswer] = useState('')
  const [lastWeekStatus, setLastWeekStatus] = useState<'CarriedForward' | 'Updated' | 'New'>('New')
  const [tasksLoading, setTasksLoading] = useState(false)
  const [selectedMood, setSelectedMood] = useState<number | null>(null)
  const [selectedYesNo, setSelectedYesNo] = useState<boolean | null>(null)
  const [datePreview, setDatePreview] = useState<string | null>(null)
  const [initialAnswer, setInitialAnswer] = useState('')
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [overlayMessage, setOverlayMessage] = useState<string>('')
  const [overlayVariant, setOverlayVariant] = useState<'review' | 'dropped' | 'someday'>('review')
  const [showInboxSuccess, setShowInboxSuccess] = useState(false)
  const [inboxTaskName, setInboxTaskName] = useState('')
  const [showTimelineHistory, setShowTimelineHistory] = useState(false)
  // Local state to track dynamically injected followup questions
  const [injectedFollowups, setInjectedFollowups] = useState<Map<number, QuestionDTO>>(new Map())

  // Merge base questions with injected followups
  const allQuestions = useMemo(() => {
    const questions = [...currentProjectQuestions]
    console.log(`[DEBUG] Merging questions - base:`, questions.map(q => q.id))
    console.log(`[DEBUG] Merging questions - injected followups:`, Array.from(injectedFollowups.entries()))
    // Insert injected followups at their proper positions
    injectedFollowups.forEach((followup, afterIndex) => {
      questions.splice(afterIndex + 1, 0, followup)
    })
    console.log(`[DEBUG] Final merged questions:`, questions.map(q => q.id))
    return questions
  }, [currentProjectQuestions, injectedFollowups])

  const q = allQuestions[idx]

  // Load tasks for the current project
  const loadProjectTasks = useCallback(async () => {
    if (!project) return // Guard clause inside callback
    
    try {
      setTasksLoading(true)
      const tasks = await fetchTasksForProject(project.id)
      console.log(`Loaded ${tasks.length} tasks for project ${project.name}:`, tasks)
      
      // Log if no tasks found
      if (tasks.length === 0) {
        console.log('No tasks found for project:', project.name)
      }
    } catch (error) {
      console.error('Error loading project tasks:', error)
    } finally {
      setTasksLoading(false)
    }
  }, [project?.id, project?.name])

  // Reset question index and answered questions when project changes
  useEffect(() => {
    if (!project) return // Guard against undefined project
    
    setIdx(0)
    setAnsweredQuestions([])
    setCurrentAnswer('')
    setLastWeekAnswer('')
    setSelectedMood(null)
    setSelectedYesNo(null)
    setDatePreview(null)
    setInitialAnswer('')
    setOverlayVisible(false)
    setOverlayMessage('')
    setShowInboxSuccess(false) // Reset inbox success overlay when project changes
    setInjectedFollowups(new Map()) // Clear injected followups when switching projects
    // Load context-aware questions for the current project
    loadProjectQuestions(project)
    // Auto-load tasks for the current project
    loadProjectTasks()
  }, [project?.id, projectIndex, loadProjectQuestions, loadProjectTasks, project])

  // Handle task updates
  const handleTaskUpdate = async (taskId: string, updates: Partial<TaskDTO>) => {
    try {
      await updateTask(taskId, updates)
      await loadProjectTasks() // Reload tasks to get fresh data
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const handleInstructionAcknowledge = () => {
    if (!project || !q) return

    const entry = {
      id: q.id,
      prompt: q.prompt,
      answer: 'Instruction acknowledged',
      status: 'answered' as const,
      draftStatus: 'Updated' as const
    }

    setAnsweredQuestions(prev => {
      const existingIndex = prev.findIndex(aq => aq.id === q.id)
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = entry
        return updated
      }
      return [...prev, entry]
    })

    moveToNextQuestion()
  }

  // Handle task deletion
  const handleTaskDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId)
      await loadProjectTasks() // Reload tasks to get fresh data
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  useEffect(() => { 
    if (!project || !q) return // Guard against undefined
    
    timer.start(30)
    // Load current answer and last week's answer
    loadAnswers()
  }, [idx, project?.id, q?.id])

  // Force re-render when remaining time changes
  useEffect(() => {
    // This will trigger a re-render when remaining changes
  }, [remaining])

  // Date parsing preview for text-parsed questions
  useEffect(() => {
    if (q?.type === 'text-parsed' && currentAnswer.trim()) {
      const preview = describeNaturalDate(currentAnswer)
      setDatePreview(preview)
    } else {
      setDatePreview(null)
    }
  }, [currentAnswer, q?.type])

  // Enhanced keyboard navigation
  useEffect(() => {
    if (!project || !q) return // Guard against undefined
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Handle number keys 1-3 for engagement slider (question 6)
      if (q.id.includes('engagement') && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault()
        const engagementValue = parseInt(e.key)
        handleEngagementChange(engagementValue)
        // handleEngagementChange now handles auto-advance
        return
      }

      // Handle Y and N keys for yes/no questions
      if (q.type === 'yes-no' && ['y', 'Y', 'n', 'N'].includes(e.key)) {
        e.preventDefault()
        const isYes = e.key.toLowerCase() === 'y'
        handleYesNoChange(isYes)
        return
      }

      // Handle 1 and 2 keys for yes/no questions (1 → Yes, 2 → No)
      if (q.type === 'yes-no' && (e.key === '1' || e.key === '2')) {
        e.preventDefault()
        handleYesNoChange(e.key === '1')
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          setIdx(Math.max(0, idx - 1))
          break
        case 'ArrowRight':
          e.preventDefault()
          setIdx(Math.min(allQuestions.length - 1, idx + 1))
          break
        case 's':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            // Save current answer (already handled by autosave)
            console.log('Answer saved')
          }
          break
        case 'n':
          // Ctrl+N (Windows/Linux) or Cmd+N (Mac) to open Notion link
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            openNotionLink()
          }
          break
        case 'o':
          // Ctrl+O (Windows/Linux) or Cmd+O (Mac) to open OmniFocus project
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            openInOmniFocus()
          }
          break
        case '[':
          // Ctrl+[ (Windows/Linux) or Cmd+[ (Mac) to go to previous project
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            if (projectIndex > 0) {
              handleProjectNavigate(projectIndex - 1)
            }
          }
          break
        case ']':
          // Ctrl+] (Windows/Linux) or Cmd+] (Mac) to go to next project
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            if (projectIndex < queue.length - 1) {
              handleProjectNavigate(projectIndex + 1)
            }
          }
          break
        case 'k':
          // Ctrl+K (Windows/Linux) or Cmd+K (Mac) to toggle calendar
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            toggleCalendar()
          }
          break
        case 'Escape':
          e.preventDefault()
          // Skip current project
          skipAndNext(projectIndex)
          break
        case ' ':
          e.preventDefault()
          // Mark reviewed and next (with overlay)
          handleMarkReviewed()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [idx, allQuestions.length, project, projectIndex, skipAndNext, markReviewedAndNext, q?.id, q, handleEngagementChange, openInOmniFocus, handleProjectNavigate, queue.length])

  const loadAnswers = async () => {
    if (!project || !q) return // Guard against undefined
    
    const prev = await latest(project.id, q.id)
    setLastWeekAnswer(prev?.text ?? '')
    setCurrentAnswer(prev?.text ?? '')
    setLastWeekStatus(prev?.status ?? 'New')
    
    // Load initial answer for followup questions
    if (q.id.includes('-followup')) {
      const parentQuestionId = q.id.replace('-followup', '')
      const initial = await getInitialAnswer(project.id, parentQuestionId)
      setInitialAnswer(initial?.text ?? '')
    } else if (q.id.includes('-subsequent')) {
      // For subsequent questions, load the initial answer
      const baseQuestionId = q.id.replace('-subsequent', '-initial')
      const initial = await getInitialAnswer(project.id, baseQuestionId)
      setInitialAnswer(initial?.text ?? '')
    } else {
      setInitialAnswer('')
    }
    
    // Reset question-specific state
    setSelectedMood(null)
    setSelectedYesNo(null)
    setDatePreview(null)
  }

  const startOfISOWeek = () => {
    const d = new Date(); const day = d.getDay() || 7; d.setHours(0,0,0,0); d.setDate(d.getDate() - day + 1); return d.toISOString().slice(0,10)
  }

  async function handleTextChange(text: string) {
    if (!project || !q) return // Guard against undefined
    
    // Auto-prepend "in " for text-parsed questions when parsing fails
    let finalText = text
    if (q.type === 'text-parsed' && text.trim()) {
      const trimmedText = text.trim()
      // Try parsing first
      const parsed = parseNaturalDate(trimmedText)
      // If parsing fails and text doesn't already start with "in ", prepend it
      if (!parsed && !trimmedText.toLowerCase().startsWith('in ')) {
        finalText = `in ${trimmedText}`
        // Update the state with the modified text
        setCurrentAnswer(finalText)
      } else {
        setCurrentAnswer(text)
      }
    } else {
      setCurrentAnswer(text)
    }
    
    const prev = await latest(project.id, q.id)
    
    // Get existing answer for this week to reuse its ID (avoid creating duplicates)
    const currentWeek = startOfISOWeek()
    const existingThisWeek = await db.answers
      .where('[projectID+questionID]')
      .equals([project.id, q.id])
      .filter(a => a.weekOf === currentWeek)
      .first()
    
    // Parse date for text-parsed questions (use finalText which may have "in " prepended)
    let parsedDate: string | undefined
    if (q.type === 'text-parsed' && finalText.trim()) {
      parsedDate = parseNaturalDate(finalText.trim()) || undefined
    }
    
    const draft: AnswerDraft = {
      id: existingThisWeek?.id || crypto.randomUUID(), // Reuse ID if exists
      projectID: project.id, questionID: q.id,
      text: finalText, weekOf: currentWeek,
      status: (!prev || prev.text === finalText) ? 'CarriedForward' : 'Updated',
      parsedDate
    }
    await setDraft(draft)
    
    // Update answered questions list
    const existingIndex = answeredQuestions.findIndex(aq => aq.id === q.id)
    if (existingIndex >= 0) {
      // Update existing answer
      const updated = [...answeredQuestions]
      updated[existingIndex] = { id: q.id, prompt: q.prompt, answer: text, status: 'answered', draftStatus: draft.status }
      setAnsweredQuestions(updated)
    } else {
      // Add new answer
      setAnsweredQuestions([...answeredQuestions, { id: q.id, prompt: q.prompt, answer: text, status: 'answered', draftStatus: draft.status }])
    }
  }


  async function handleEngagementChange(score?: number) {
    if (!project || !q) return // Guard against undefined
    
    console.log(`[DEBUG] handleEngagementChange:`, { score, projectId: project.id, questionId: q.id })
    
    // Set the current answer text for consistency
    const answerText = `Engagement: ${score}/3`
    setCurrentAnswer(answerText)
    
    // Get existing answer for this week to reuse its ID (avoid creating duplicates)
    const currentWeek = startOfISOWeek()
    const existingThisWeek = await db.answers
      .where('[projectID+questionID]')
      .equals([project.id, q.id])
      .filter(a => a.weekOf === currentWeek)
      .first()
    
    const draft: AnswerDraft = {
      id: existingThisWeek?.id || crypto.randomUUID(), // Reuse ID if exists
      projectID: project.id, questionID: q.id,
      engagementScore: score, weekOf: currentWeek, status: 'Updated'
    }
    
    console.log(`[DEBUG] Saving engagement answer:`, draft)
    await setDraft(draft)
    
    // Update answered questions list for engagement slider
    const newAnsweredQuestion = { id: q.id, prompt: q.prompt, answer: answerText, status: 'answered' as const }
    const existingIndex = answeredQuestions.findIndex(aq => aq.id === q.id)
    let updatedAnsweredQuestions
    if (existingIndex >= 0) {
      // Update existing answer
      updatedAnsweredQuestions = [...answeredQuestions]
      updatedAnsweredQuestions[existingIndex] = newAnsweredQuestion
    } else {
      // Add new answer
      updatedAnsweredQuestions = [...answeredQuestions, newAnsweredQuestion]
    }
    setAnsweredQuestions(updatedAnsweredQuestions)
    
    // Check if we need to inject a followup question based on the engagement score
    // Engagement followup logic: show if score <= 1
    let followupInjected = false
    if (score !== undefined && score <= 1) {
      const followupQuestionId = `${q.id}-followup`
      // Check if followup already exists
      if (!allQuestions.some(fq => fq.id === followupQuestionId)) {
        // Inject the followup question right after the current question
        const followupQuestion: QuestionDTO = {
          id: followupQuestionId,
          prompt: "Why do you feel this way?",
          type: 'text',
          order: q.order + 0.1
        }
        console.log(`[DEBUG] Injecting followup question after index ${idx}:`, followupQuestion)
        setInjectedFollowups(prev => new Map(prev).set(idx, followupQuestion))
        followupInjected = true
      }
    }
    
    // Auto-advance to next question (or to injected followup)
    // Use local variable for answer check, not state
    const nextIdx = idx + 1
    // Calculate total questions including any followup that was just injected
    // Use currentProjectQuestions.length as base since allQuestions is memoized and won't update until next render
    const totalQuestions = currentProjectQuestions.length + injectedFollowups.size + (followupInjected ? 1 : 0)
    console.log(`[DEBUG] Engagement auto-advance from ${q.id} to index ${nextIdx}, total questions: ${totalQuestions} (injected: ${followupInjected}, existing followups: ${injectedFollowups.size})`)
    console.log(`[DEBUG] updatedAnsweredQuestions:`, updatedAnsweredQuestions)
    
    if (nextIdx >= totalQuestions) {
      // Last question - trigger completion
      console.log(`[DEBUG] Last question answered, triggering completion`)
      setOverlayVariant('review')
      setOverlayMessage('✓ Project Reviewed')
      setOverlayVisible(true)
      setTimeout(() => {
        setOverlayVisible(false)
        markReviewedAndNext(project, projectIndex)
      }, 1000)
    } else {
      setIdx(nextIdx)
    }
  }

  async function handleYesNoChange(value: boolean) {
    if (!project || !q) return // Guard against undefined
    
    console.log(`[DEBUG] handleYesNoChange:`, { value, projectId: project.id, questionId: q.id })
    
    setSelectedYesNo(value)
    const textValue = value ? 'yes' : 'no'
    setCurrentAnswer(textValue)
    
    // Get existing answer for this week to reuse its ID (avoid creating duplicates)
    const currentWeek = startOfISOWeek()
    const existingThisWeek = await db.answers
      .where('[projectID+questionID]')
      .equals([project.id, q.id])
      .filter(a => a.weekOf === currentWeek)
      .first()
    
    const draft: AnswerDraft = {
      id: existingThisWeek?.id || crypto.randomUUID(), // Reuse ID if exists
      projectID: project.id, questionID: q.id,
      text: textValue, weekOf: currentWeek, status: 'Updated'
    }
    
    console.log(`[DEBUG] Saving yes/no answer:`, draft)
    await setDraft(draft)
    
    // Update answered questions list BEFORE advancing
    const newAnsweredQuestion = { id: q.id, prompt: q.prompt, answer: textValue, status: 'answered' as const, draftStatus: draft.status }
    const existingIndex = answeredQuestions.findIndex(aq => aq.id === q.id)
    let updatedAnsweredQuestions
    if (existingIndex >= 0) {
      // Update existing answer
      updatedAnsweredQuestions = [...answeredQuestions]
      updatedAnsweredQuestions[existingIndex] = newAnsweredQuestion
    } else {
      // Add new answer
      updatedAnsweredQuestions = [...answeredQuestions, newAnsweredQuestion]
    }
    setAnsweredQuestions(updatedAnsweredQuestions)
    
    // Check if we need to inject a followup question based on the yes/no answer
    // Get the question package to check followup logic
    const isInitial = q.id.includes('-initial')
    const isSubsequent = q.id.includes('-subsequent')
    const packageId = q.id.replace('-initial', '').replace('-subsequent', '')
    
    console.log(`[DEBUG] Yes/No answer processing:`, { 
      questionId: q.id, 
      answer: textValue, 
      packageId, 
      isInitial, 
      isSubsequent 
    })
    
    let followupInjected = false
    const followupQuestionId = `${q.id}-followup`
    
    // Remove any previously injected followup if answer changed to something that shouldn't show followup
    // This handles the case where user changes from "no" to "yes" for subsequent questions with if_no logic
    if (isSubsequent && textValue === 'yes') {
      setInjectedFollowups(prev => {
        const updated = new Map(prev)
        // Remove followup for this question if it exists
        let removed = false
        for (const [index, followup] of updated.entries()) {
          if (followup.id === followupQuestionId) {
            updated.delete(index)
            removed = true
            console.log(`[DEBUG] Removed injected followup ${followupQuestionId} because answer changed to 'yes'`)
            break
          }
        }
        return removed ? updated : prev
      })
    }
    
    // Only inject followups for subsequent questions with 'if_no' logic
    // Initial questions don't have yes/no followups in this implementation
    if (isSubsequent && textValue === 'no') {
      console.log(`[DEBUG] Subsequent question answered 'no', checking for followup...`)
      // Check if followup already exists
      if (!allQuestions.some(fq => fq.id === followupQuestionId)) {
        // Determine followup prompt based on question type
        let followupPrompt = ''
        let followupType: QuestionDTO['type'] = 'text'
        
        if (packageId === 'pkg-alignment') {
          followupPrompt = 'Should you deprioritize it then? Why are you still doing this project?'
        } else if (packageId === 'pkg-next-action') {
          followupPrompt = 'Please edit your task details and define a clear next action.'
          followupType = 'instruction'
        } else if (packageId === 'pkg-timeline') {
          followupPrompt = "What's the new realistic timeline for this project?"
          followupType = 'text-parsed'
        }
        
        if (followupPrompt) {
          const followupQuestion: QuestionDTO = {
            id: followupQuestionId,
            prompt: followupPrompt,
            type: followupType,
            order: q.order + 0.1
          }
          console.log(`[DEBUG] Injecting yes/no followup question after index ${idx}:`, followupQuestion)
          setInjectedFollowups(prev => new Map(prev).set(idx, followupQuestion))
          followupInjected = true
        } else {
          console.log(`[DEBUG] No followup prompt found for packageId: ${packageId}`)
        }
      } else {
        console.log(`[DEBUG] Followup ${followupQuestionId} already exists, skipping injection`)
      }
    } else if (isInitial && textValue === 'no') {
      console.log(`[DEBUG] Initial question answered 'no' - checking for initial followup...`)
      // Initial questions can also have followups, but with different logic
      if (!allQuestions.some(fq => fq.id === followupQuestionId)) {
        let followupPrompt = ''
        let followupType: QuestionDTO['type'] = 'text'
        
        if (packageId === 'pkg-alignment') {
          followupPrompt = 'Should you deprioritize it then? Why are you doing this project?'
        } else if (packageId === 'pkg-next-action') {
          followupPrompt = 'Please edit your task details and define a clear next action.'
          followupType = 'instruction'
        }
        // Note: pkg-timeline initial is NOT yes/no, so no followup here
        
        if (followupPrompt) {
          const followupQuestion: QuestionDTO = {
            id: followupQuestionId,
            prompt: followupPrompt,
            type: followupType,
            order: q.order + 0.1
          }
          console.log(`[DEBUG] Injecting initial yes/no followup question after index ${idx}:`, followupQuestion)
          setInjectedFollowups(prev => new Map(prev).set(idx, followupQuestion))
          followupInjected = true
        }
      }
    } else {
      console.log(`[DEBUG] Answer is '${textValue}' for ${isInitial ? 'initial' : 'subsequent'} question - no followup needed`)
    }
    
    // Auto-advance - check if we're on the last question AFTER potential followup injection
    const nextIdx = idx + 1
    // Calculate total questions including any followup that was just injected
    // Use currentProjectQuestions.length as base since allQuestions is memoized and won't update until next render
    const totalQuestions = currentProjectQuestions.length + injectedFollowups.size + (followupInjected ? 1 : 0)
    console.log(`[DEBUG] Yes/No auto-advance from ${q.id} to index ${nextIdx}, total questions: ${totalQuestions} (injected: ${followupInjected}, existing followups: ${injectedFollowups.size})`)
    console.log(`[DEBUG] updatedAnsweredQuestions:`, updatedAnsweredQuestions)
    
    if (nextIdx >= totalQuestions) {
      // Last question - trigger completion
      console.log(`[DEBUG] Last question answered, triggering completion`)
      setOverlayVariant('review')
      setOverlayMessage('✓ Project Reviewed')
      setOverlayVisible(true)
      setTimeout(() => {
        setOverlayVisible(false)
        markReviewedAndNext(project, projectIndex)
      }, 1000)
    } else {
      setIdx(nextIdx)
    }
  }

  // Function to mark a question as skipped
  function markQuestionAsSkipped(questionId: string) {
    const question = allQuestions.find(q => q.id === questionId)
    if (!question) return

    const existingIndex = answeredQuestions.findIndex(aq => aq.id === questionId)
    if (existingIndex >= 0) {
      // Don't overwrite if already answered - only mark as skipped if it was previously skipped or not in the list
      const existing = answeredQuestions[existingIndex]
      if (existing.status === 'answered') {
        console.log(`[DEBUG] Not marking ${questionId} as skipped - already answered with:`, existing.answer)
        return
      }
      // Update existing entry to skipped
      const updated = [...answeredQuestions]
      updated[existingIndex] = { id: questionId, prompt: question.prompt, answer: 'Skipped', status: 'skipped' }
      setAnsweredQuestions(updated)
    } else {
      // Add new skipped entry
      setAnsweredQuestions([...answeredQuestions, { id: questionId, prompt: question.prompt, answer: 'Skipped', status: 'skipped' }])
    }
  }

  // Function to move to next question (and mark current as skipped if not answered)
  function moveToNextQuestion() {
    console.log(`[DEBUG] moveToNextQuestion called from question:`, {
      questionId: q?.id,
      prompt: q?.prompt,
      currentAnswer: currentAnswer,
      answeredQuestions: answeredQuestions.map(aq => ({ id: aq.id, status: aq.status }))
    })
    
    // Calculate current total including any pending injected followups
    // This accounts for followups that were just injected but haven't rendered yet
    const currentTotal = currentProjectQuestions.length + injectedFollowups.size
    const nextIdx = idx + 1
    
    console.log(`[DEBUG] moveToNextQuestion: nextIdx=${nextIdx}, currentTotal=${currentTotal}, allQuestions.length=${allQuestions.length}`)
    
    if (nextIdx >= currentTotal) {
      // Last question - show confirmation and complete the review
      console.log(`[DEBUG] Last question - triggering completion`)
      setOverlayVariant('review')
      setOverlayMessage('✓ Project Reviewed')
      setOverlayVisible(true)
      setTimeout(() => {
        setOverlayVisible(false)
        markReviewedAndNext(project, projectIndex)
      }, 1000)
    } else {
      // Mark current question as skipped if not answered
      const hasAnswerInArray = answeredQuestions.some(aq => aq.id === q.id && aq.status === 'answered')
      const hasAnswerInText = currentAnswer.trim() !== ''
      const hasAnswer = hasAnswerInArray || hasAnswerInText
      
      console.log(`[DEBUG] Skip check for ${q.id}:`, {
        hasAnswerInArray,
        hasAnswerInText,
        hasAnswer,
        willSkip: !hasAnswer
      })
      
      if (!hasAnswer) {
        // Don't mark the PARENT question as skipped if this is a followup
        if (q.id.includes('-followup')) {
          console.log(`[DEBUG] Not marking ${q.id} as skipped - it's a followup question`)
        } else {
          console.log(`[DEBUG] Marking ${q.id} as skipped`)
          markQuestionAsSkipped(q.id)
        }
      }
      setIdx(nextIdx)
    }
  }

  // Function to handle mark reviewed with overlay
  async function handleMarkReviewed() {
    try {
      setOverlayVariant('review')
      setOverlayMessage('✓ Project Reviewed')
      setOverlayVisible(true)
      setTimeout(async () => {
        setOverlayVisible(false)
        await markReviewedAndNext(project, projectIndex)
      }, 1000)
    } catch (error) {
      console.error('Error marking project as reviewed:', error)
    }
  }

  // Function to open Notion deep link for current project
  async function openNotionLink() {
    if (!project) return // Guard against undefined
    
    try {
      // Extract Notion link from project notes
      const notionUrl = extractNotionLink(project.notes)
      
      if (!notionUrl) {
        // No valid Notion link found - show error
        const errorMessage = getNotionLinkError(project.notes)
        alert(errorMessage)
        return
      }

      // Check if Electron API is available
      if (!window.electronAPI?.shell) {
        alert('Cannot open Notion link: Electron API not available. This feature requires the desktop app.')
        return
      }

      // Open the URL using Electron shell
      const result = await window.electronAPI.shell.openExternal(notionUrl)
      
      if (!result.success) {
        alert(`Failed to open Notion link: ${result.error || 'Unknown error'}`)
      } else {
        console.log(`Opened Notion link: ${notionUrl}`)
      }
    } catch (error) {
      console.error('Error opening Notion link:', error)
      alert(`Error opening Notion link: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Function to handle project navigation
  function handleProjectNavigate(newIndex: number) {
    if (newIndex < 0 || newIndex >= queue.length) {
      console.warn(`Invalid project index: ${newIndex}. Queue length: ${queue.length}`)
      return
    }

    // Update the route to the new project index
    // This will trigger the useEffect that loads questions for the new project
    const { route } = useApp.getState()
    if (route.name === 'focus') {
      useApp.setState({ route: { name: 'focus', idx: newIndex } })
    }
  }

  // Function to open current project in OmniFocus
  async function openInOmniFocus() {
    if (!project) return // Guard against undefined
    
    try {
      // Check if Electron API is available
      if (!window.electronAPI?.omnifocus?.openProject) {
        alert('Cannot open OmniFocus project: Electron API not available. This feature requires the desktop app.')
        return
      }

      // Open the project in OmniFocus using deep link
      const result = await window.electronAPI.omnifocus.openProject(project.id)
      
      if (!result.success) {
        alert(`Failed to open OmniFocus project: ${result.error || 'Unknown error'}`)
      } else {
        console.log(`Opened OmniFocus project: ${project.name} (${project.id})`)
      }
    } catch (error) {
      console.error('Error opening OmniFocus project:', error)
      alert(`Error opening OmniFocus project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Function to create inbox task
  async function handleCreateInboxTask(taskName: string) {
    try {
      // Check if Electron API is available
      if (!window.electronAPI?.omnifocus?.createInboxTask) {
        throw new Error('Cannot create inbox task: Electron API not available. This feature requires the desktop app.')
      }

      // Create the inbox task
      const result = await window.electronAPI.omnifocus.createInboxTask(taskName)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create inbox task')
      }

      console.log(`✅ Inbox task created: ${taskName}`)
      
      // Show success overlay
      setInboxTaskName(taskName)
      setShowInboxSuccess(true)
      
      // Auto-hide after 2 seconds
      setTimeout(() => {
        setShowInboxSuccess(false)
      }, 2000)
      
    } catch (error) {
      console.error('Error creating inbox task:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`❌ Failed to create inbox task: ${errorMessage}`)
      throw error // Re-throw so QuickInboxCapture can handle it
    }
  }

  // Safety checks AFTER all hooks have been called
  if (!project) {
    return <div className="focus-screen">Loading project...</div>
  }

  if (allQuestions.length === 0) {
    return <div className="focus-screen">Loading questions...</div>
  }

  if (!q) {
    return <div className="focus-screen">Loading questions...</div>
  }

  // Calculate progress
  const progress = queue.length > 0 ? ((projectIndex + 1) / queue.length) * 100 : 0
  const lastWeekHintText = getLastWeekAnswerHint(q.id, q.type)

  return (
    <>
    {/* Progress Indicator Bar */}
    <div className="progress-bar-container">
      <div 
        className="progress-bar-fill" 
        style={{ width: `${progress}%` }}
      />
    </div>
    
    <div className="focus">
      {/* Left Column: Question Log */}
      <div className="focus-left-column">
        <div className="answered-questions">
          {answeredQuestions.length > 0 && (
            <>
              <h3>Question Log</h3>
              {answeredQuestions.map(aq => (
                <div 
                  key={aq.id}
                  className={`answered-question-item ${aq.id === q.id ? 'active' : ''} ${aq.status === 'skipped' ? 'skipped' : 'answered'}`}
                  onClick={() => setIdx(allQuestions.findIndex(x => x.id === aq.id))}
                >
                  <div className="question">{aq.prompt}</div>
                  <div className="answer">
                    {aq.draftStatus === 'CarriedForward' && '[u] '}{aq.answer}
                  </div>
                  <div className="question-status" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {aq.status === 'skipped' ? (
                      <><SkipForward size={14} /> Skipped</>
                    ) : (
                      <><CheckCircle size={14} /> Answered</>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Center Column: Main content area */}
      <div className="focus-center-column">
        <div className="focus-header-right">
          <div className="project-info">
            <div className="project-header-row title">
              <div className="project-name">Project: {project.name}</div>
            </div>
            <div className="project-header-row actions">
              <ProjectNavigator 
                currentIndex={projectIndex}
                queue={queue}
                onNavigate={handleProjectNavigate}
              />
              <button 
                className="omnifocus-button" 
                onClick={openInOmniFocus} 
                title={`Open in OmniFocus (${window.electronAPI?.platform.isMacOS ? 'Cmd' : 'Ctrl'}+O)`}
              >
                <ExternalLink size={20} />
              </button>
              {hasNotionLink(project.notes) && (
                <span 
                  className="notion-indicator"
                  onClick={openNotionLink}
                  title={`Open in Notion (${window.electronAPI?.platform.isMacOS ? 'Cmd' : 'Ctrl'}+N)`}
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <FileText size={20} />
                </span>
              )}
              <button
                className="calendar-toggle-button"
                onClick={toggleCalendar}
                title={`View Calendar (${window.electronAPI?.platform.isMacOS ? 'Cmd' : 'Ctrl'}+K)`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                <Calendar size={20} color="#ffffff" />
              </button>
              <div className="timer-container">
                <TimerCircle remaining={remaining} total={30} />
              </div>
            </div>
          </div>
        </div>
        <div className="focus-main">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h1 className="main-question">{q.prompt}</h1>
          {(q.id === 'pkg-timeline-subsequent' || q.id === 'pkg-timeline-subsequent-followup' || q.id === 'pkg-timeline-initial') && (
            <button
              onClick={() => setShowTimelineHistory(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: 'white',
                padding: '8px 16px',
                fontSize: '0.9em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                marginLeft: '16px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
              title="View timeline history"
            >
              <History size={16} />
              Timeline History
            </button>
          )}
        </div>
        
        {/* Context Answers Display */}
        {(lastWeekAnswer || initialAnswer) && (
          <div className="context-answers-section">
            {initialAnswer && (
              <div className="initial-answer-section">
                <div className="initial-answer-label">INITIAL ANSWER</div>
                <div className="initial-answer-text">{initialAnswer}</div>
              </div>
            )}
            {lastWeekAnswer && (
              <div className="last-week-section">
                <div className="last-week-label">LAST WEEK</div>
                <div className="last-week-answer">
                  {lastWeekStatus === 'CarriedForward' && '[u] '}{lastWeekAnswer}
                </div>
                {lastWeekHintText && (
                  <div className="last-week-edit-hint">{lastWeekHintText}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Question Input Based on Type */}
        {q.type === 'text' || q.type === 'text-parsed' ? (
          <>
            <textarea
              className="answer-input"
              value={currentAnswer}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  // Move to next question or complete review if last question
                  moveToNextQuestion()
                }
              }}
              placeholder={q.type === 'text-parsed' ? "Type a date like 'next month', 'Q2 2024', 'tomorrow', 'in 2 weeks'..." : "Type your answer here... (Press Enter to go to next question)"}
            />
            {q.type === 'text-parsed' && (
              <div style={{ fontSize: '0.8em', marginTop: '8px' }}>
                {datePreview ? (
                  <div style={{ color: '#4CAF50', fontWeight: '500' }}>📅 Parsed as: {datePreview}</div>
                ) : currentAnswer.trim() ? (
                  <div style={{ color: '#FF9800', opacity: 0.8 }}>⚠️ Could not parse date from: "{currentAnswer}"</div>
                ) : (
                  <div style={{ opacity: 0.7 }}>💡 Try: "next month", "Q2 2024", "tomorrow", "in 2 weeks"</div>
                )}
              </div>
            )}
          </>
        ) : q.type === 'instruction' ? (
          <div
            style={{
              width: '100%',
              background: 'rgba(33, 150, 243, 0.12)',
              border: '1px solid rgba(33, 150, 243, 0.3)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ fontSize: '1em', lineHeight: 1.5 }}>
              {q.prompt}
            </div>
            <div style={{ fontSize: '0.9em', opacity: 0.8 }}>
              Update the task details in the panel on the right, then continue.
            </div>
            <div>
              <button
                onClick={handleInstructionAcknowledge}
                style={{
                  background: '#2196F3',
                  border: 'none',
                  color: 'white',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95em'
                }}
              >
                Continue
              </button>
            </div>
          </div>
        ) : q.type === 'yes-no' ? (
          <div className="yes-no-selector">
            <div className="yes-no-options">
              <button
                className={`yes-no-button ${selectedYesNo === true ? 'selected' : ''}`}
                onClick={() => handleYesNoChange(true)}
              >
                Yes
              </button>
              <button
                className={`yes-no-button ${selectedYesNo === false ? 'selected' : ''}`}
                onClick={() => handleYesNoChange(false)}
              >
                No
              </button>
            </div>
          </div>
        ) : q.type === 'slider' ? (
          <div className="mood-selector">
            <div className="mood-prompt">How do you feel about this project?</div>
            <div className="mood-options">
              <button
                className={`mood-button ${selectedMood === 1 ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedMood(1)
                  handleEngagementChange(1)
                }}
                title="Low energy - Needs attention"
              >
                <span className="mood-label">Low Energy</span>
              </button>
              <button
                className={`mood-button ${selectedMood === 2 ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedMood(2)
                  handleEngagementChange(2)
                }}
                title="Neutral - Steady progress"
              >
                <span className="mood-label">Neutral</span>
              </button>
              <button
                className={`mood-button ${selectedMood === 3 ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedMood(3)
                  handleEngagementChange(3)
                }}
                title="High energy - Motivated and engaged"
              >
                <span className="mood-label">High Energy</span>
              </button>
            </div>
          </div>
        ) : (
          <div>Unknown question type: {q.type}</div>
        )}
        </div>
        
        <KeyboardShortcuts />
      </div>

      {/* Right Column: Task Panel - Always Visible */}
      <div className="task-panel-sidebar">
        <div className="task-panel-header">
          <h3>Tasks</h3>
        </div>
        
        <div className="task-panel-content">
          {tasksLoading ? (
            <div className="no-tasks-message">
              <p>Loading tasks...</p>
            </div>
          ) : (
            <TaskList
              projectId={project.id}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              showFilter={false}
              showStatistics={false}
            />
          )}
        </div>
      </div>
    </div>
    
    {/* Action Confirmation Overlay */}
    <ActionConfirmationOverlay
      visible={overlayVisible}
      message={overlayMessage}
      variant={overlayVariant}
    />
    
    {/* Floating Inbox Button */}
    <FloatingInboxButton onCreateInboxTask={handleCreateInboxTask} />
    
    {/* Inbox Success Overlay */}
    {showInboxSuccess && (
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(76, 175, 80, 0.15)',
        backdropFilter: 'blur(20px)',
        border: '2px solid rgba(76, 175, 80, 0.3)',
        borderRadius: '16px',
        padding: '16px 24px',
        textAlign: 'center',
        fontSize: '1.1em',
        fontWeight: '600',
        color: 'white',
        boxShadow: '0 8px 32px rgba(76, 175, 80, 0.2)',
        zIndex: 10001,
        animation: 'fadeIn 0.3s ease-out'
      }}>
        ✓ Added "{inboxTaskName}" to Inbox
      </div>
    )}
    
    {/* Calendar Overlay */}
    <CalendarOverlay
      visible={calendarVisible}
      weekOf={calendarWeekOf}
      currentSessionProjects={reviewedProjectsThisSession}
      onClose={toggleCalendar}
      isCurrentWeek={calendarWeekOf === getStartOfISOWeek()}
    />
    
    {/* Footer with action buttons - 2-row layout */}
    <div className="focus-footer-two-row">
      {/* Row 1: Primary Actions */}
      <div className="button-row primary-row">
        <div className="button-group">
          <button 
            className="action-button mark-reviewed"
            onClick={handleMarkReviewed}
          >
            Mark Reviewed
          </button>
        </div>
        <button 
          className="action-button skip"
          onClick={() => skipAndNext(projectIndex)}
        >
          Skip
        </button>
      </div>
      
      {/* Row 2: Project Management Actions */}
      <div className="button-row management-row">
        <button 
          className="action-button complete-project"
          onClick={() => markCompleteAndNext(project, projectIndex)}
        >
          Complete Project
        </button>
        <button 
          className="action-button archive"
          onClick={() => {
            setOverlayVariant('dropped')
            setOverlayMessage('✓ Project Dropped')
            setOverlayVisible(true)
            setTimeout(() => {
              setOverlayVisible(false)
              archiveAndNext(project, projectIndex)
            }, 900)
          }}
        >
          Drop
        </button>
        <button 
          className="action-button someday-maybe"
          onClick={() => {
            setOverlayVariant('someday')
            setOverlayMessage('✓ Moved to Someday/Maybe')
            setOverlayVisible(true)
            setTimeout(() => {
              setOverlayVisible(false)
              somedayMaybeAndNext(project, projectIndex)
            }, 900)
          }}
        >
          Someday/Maybe
        </button>
      </div>
    </div>
    <TimelineHistory
      projectId={project.id}
      projectName={project.name}
      visible={showTimelineHistory}
      onClose={() => setShowTimelineHistory(false)}
    />
    </>
  )
}

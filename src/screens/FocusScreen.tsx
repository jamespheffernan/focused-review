import { useEffect, useMemo, useState, useCallback } from 'react'
import { useApp } from '../store'
import type { AnswerDraft, TaskDTO } from '../types'
import { createTimer } from '../services/timer'
import { latest } from '../repos/answersRepo'
import { fetchTasksForProject, updateTask, deleteTask } from '../repos/tasksRepo'
import { db } from '../db'
import TimerCircle from '../components/TimerCircle'
import KeyboardShortcuts from '../components/KeyboardShortcuts'
import TaskList from '../components/TaskList'
import { extractNotionLink, getNotionLinkError, hasNotionLink } from '../utils/notionLink'
import { FileText, SkipForward, CheckCircle, RefreshCw } from 'lucide-react'

export default function FocusScreen({ projectIndex }: { projectIndex: number }) {
  const { queue, currentProjectQuestions, setDraft, markReviewedAndNext, skipAndNext, markCompleteAndNext, archiveAndNext, somedayMaybeAndNext, loadProjectQuestions } = useApp()
  const project = queue[projectIndex]
  const [idx, setIdx] = useState(0)
  const [remaining, setRemaining] = useState(30)
  const timer = useMemo(() => createTimer(setRemaining), [])
  const [answeredQuestions, setAnsweredQuestions] = useState<Array<{id: string, prompt: string, answer: string, status: 'answered' | 'skipped', draftStatus?: 'CarriedForward' | 'Updated' | 'New'}>>([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [lastWeekAnswer, setLastWeekAnswer] = useState('')
  const [lastWeekStatus, setLastWeekStatus] = useState<'CarriedForward' | 'Updated' | 'New'>('New')
  const [projectTasks, setProjectTasks] = useState<TaskDTO[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [selectedMood, setSelectedMood] = useState<number | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const q = currentProjectQuestions[idx]

  // Load tasks for the current project
  const loadProjectTasks = useCallback(async () => {
    if (!project) return // Guard clause inside callback
    
    try {
      setTasksLoading(true)
      const tasks = await fetchTasksForProject(project.id)
      console.log(`Loaded ${tasks.length} tasks for project ${project.name}:`, tasks)
      setProjectTasks(tasks)
      
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
    setShowConfirmation(false) // Reset confirmation overlay when project changes
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

  // Enhanced keyboard navigation
  useEffect(() => {
    if (!project || !q) return // Guard against undefined
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Handle number keys 1-3 for engagement slider (question 6)
      if (q.id === 'q-engage' && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault()
        const engagementValue = parseInt(e.key)
        handleEngagementChange(engagementValue)
        
        // Auto-advance after setting engagement
        moveToNextQuestion()
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          setIdx(Math.max(0, idx - 1))
          break
        case 'ArrowRight':
          e.preventDefault()
          setIdx(Math.min(currentProjectQuestions.length - 1, idx + 1))
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
  }, [idx, currentProjectQuestions.length, project, projectIndex, skipAndNext, markReviewedAndNext, q?.id, q, handleEngagementChange])

  const loadAnswers = async () => {
    if (!project || !q) return // Guard against undefined
    
    const prev = await latest(project.id, q.id)
    setLastWeekAnswer(prev?.text ?? '')
    setCurrentAnswer(prev?.text ?? '')
    setLastWeekStatus(prev?.status ?? 'New')
  }

  const startOfISOWeek = () => {
    const d = new Date(); const day = d.getDay() || 7; d.setHours(0,0,0,0); d.setDate(d.getDate() - day + 1); return d.toISOString().slice(0,10)
  }

  async function handleTextChange(text: string) {
    if (!project || !q) return // Guard against undefined
    
    setCurrentAnswer(text)
    const prev = await latest(project.id, q.id)
    
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
      text, weekOf: currentWeek,
      status: (!prev || prev.text === text) ? 'CarriedForward' : 'Updated'
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
    await setDraft(draft)
    
    // Update answered questions list for engagement slider
    const existingIndex = answeredQuestions.findIndex(aq => aq.id === q.id)
    if (existingIndex >= 0) {
      // Update existing answer
      const updated = [...answeredQuestions]
      updated[existingIndex] = { id: q.id, prompt: q.prompt, answer: `Engagement: ${score}/3`, status: 'answered' }
      setAnsweredQuestions(updated)
    } else {
      // Add new answer
      setAnsweredQuestions([...answeredQuestions, { id: q.id, prompt: q.prompt, answer: `Engagement: ${score}/3`, status: 'answered' }])
    }
  }

  // Function to mark a question as skipped
  function markQuestionAsSkipped(questionId: string) {
    const question = currentProjectQuestions.find(q => q.id === questionId)
    if (!question) return

    const existingIndex = answeredQuestions.findIndex(aq => aq.id === questionId)
    if (existingIndex >= 0) {
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
    const nextIdx = idx + 1
    if (nextIdx >= currentProjectQuestions.length) {
      // Last question - show confirmation and complete the review
      setShowConfirmation(true)
      setTimeout(() => {
        setShowConfirmation(false)
        markReviewedAndNext(project, projectIndex)
      }, 1500)
    } else {
      // Mark current question as skipped if not answered
      const hasAnswer = answeredQuestions.some(aq => aq.id === q.id && aq.status === 'answered')
      if (!hasAnswer) {
        markQuestionAsSkipped(q.id)
      }
      setIdx(nextIdx)
    }
  }

  // Function to handle mark reviewed with overlay
  function handleMarkReviewed() {
    // Show confirmation overlay
    setShowConfirmation(true)
    
    // Wait 1 second, then transition
    setTimeout(() => {
      setShowConfirmation(false)
      markReviewedAndNext(project, projectIndex)
    }, 1000)
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

  // Safety checks AFTER all hooks have been called
  if (!project) {
    return <div className="focus-screen">Loading project...</div>
  }

  if (currentProjectQuestions.length === 0) {
    return <div className="focus-screen">Loading questions...</div>
  }

  if (!q) {
    return <div className="focus-screen">Loading questions...</div>
  }

  // Calculate progress
  const progress = queue.length > 0 ? ((projectIndex + 1) / queue.length) * 100 : 0

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
                  onClick={() => setIdx(currentProjectQuestions.findIndex(x => x.id === aq.id))}
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
            <div className="project-name">
              Project: {project.name}
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
            </div>
            <div className="timer-container">
              <TimerCircle remaining={remaining} total={30} />
            </div>
          </div>
        </div>
        <div className="focus-main">
        <h1 className="main-question">{q.prompt}</h1>
        
        {lastWeekAnswer && (
          <div className="last-week-section">
            <div className="last-week-label">LAST WEEK</div>
            <div className="last-week-answer">
              {lastWeekStatus === 'CarriedForward' && '[u] '}{lastWeekAnswer}
            </div>
            <div className="last-week-edit-hint">(CLICK OR ENTER TO EDIT)</div>
          </div>
        )}

        {q.type === 'text' ? (
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
              placeholder="Type your answer here... (Press Enter to go to next question)"
            />
          </>
        ) : (
          <div className="mood-selector">
            <div className="mood-prompt">How do you feel about this project?</div>
            <div className="mood-options">
              <button
                className={`mood-button ${selectedMood === 1 ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedMood(1)
                  handleEngagementChange(1)
                }}
                title="Not feeling it"
              >
                😔
                <span className="mood-label">Low</span>
              </button>
              <button
                className={`mood-button ${selectedMood === 2 ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedMood(2)
                  handleEngagementChange(2)
                }}
                title="Neutral"
              >
                😐
                <span className="mood-label">Neutral</span>
              </button>
              <button
                className={`mood-button ${selectedMood === 3 ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedMood(3)
                  handleEngagementChange(3)
                }}
                title="Feeling good"
              >
                😊
                <span className="mood-label">High</span>
              </button>
            </div>
          </div>
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
          ) : projectTasks.length === 0 ? (
            <div className="no-tasks-message">
              <p>No tasks for this project.</p>
              <button 
                className="refresh-tasks-btn"
                onClick={loadProjectTasks}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <RefreshCw size={16} /> Refresh Tasks
              </button>
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
    
    {/* Confirmation Overlay */}
    {showConfirmation && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.3s ease-out'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(30px)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '24px',
          padding: '48px 64px',
          textAlign: 'center',
          fontSize: '2em',
          fontWeight: '700',
          color: 'white',
          boxShadow: '0 16px 64px rgba(0, 0, 0, 0.3)',
          animation: 'scaleIn 0.3s ease-out'
        }}>
          ✓ Project Reviewed
        </div>
      </div>
    )}
    
    {/* Footer with action buttons - 2-row layout */}
    <div className="focus-footer-two-row">
      {/* Row 1: Primary Actions */}
      <div className="button-row primary-row">
        <button 
          className="action-button mark-reviewed"
          onClick={handleMarkReviewed}
        >
          Mark Reviewed
        </button>
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
          onClick={() => archiveAndNext(project, projectIndex)}
        >
          Drop
        </button>
        <button 
          className="action-button someday-maybe"
          onClick={() => somedayMaybeAndNext(project, projectIndex)}
        >
          Someday/Maybe
        </button>
      </div>
    </div>
    </>
  )
}

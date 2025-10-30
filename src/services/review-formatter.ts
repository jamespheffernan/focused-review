// services/review-formatter.ts
import type { AnswerDraft, QuestionDTO } from '../types'
import { getQuestionsForProject } from './question-loader'
import { hasBeenReviewedBefore } from '../repos/answersRepo'

/**
 * Convert engagement score (1-3) to emoji and text
 */
function formatEngagementScore(score: number): string {
  const emojiMap: Record<number, string> = {
    1: '😔 Low',
    2: '😐 Neutral',
    3: '😊 High'
  }
  
  const emoji = emojiMap[score] || '😐 Neutral'
  return `${emoji} (${score}/3)`
}

/**
 * Format a single answer with its question
 */
function formatAnswer(answer: AnswerDraft, question: QuestionDTO): string {
  // For engagement/slider questions
  if (question.type === 'slider' && answer.engagementScore !== undefined) {
    const formattedScore = formatEngagementScore(answer.engagementScore)
    return `**${question.prompt}**: ${formattedScore}`
  }
  
  // For text questions
  const answerText = answer.text || '(No answer)'
  return `**${question.prompt}**: ${answerText}`
}

/**
 * Format the week date in a readable format
 * Input: "2025-10-01" (ISO date string)
 * Output: "October 1, 2025"
 */
function formatWeekDate(weekOf: string): string {
  try {
    const date = new Date(weekOf)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  } catch (error) {
    return weekOf
  }
}

/**
 * Format review date/time
 * Input: ISO timestamp string
 * Output: "Oct 8, 2025"
 */
function formatReviewDate(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  } catch (error) {
    return timestamp
  }
}

/**
 * Format weekly review answers as markdown for Notion
 * Creates compact format: question + answer on each line
 */
export function formatReviewAsMarkdown(
  answers: AnswerDraft[],
  questions: QuestionDTO[],
  weekOf: string
): string {
  // Create a map of question IDs to questions for quick lookup
  const questionMap = new Map(questions.map(q => [q.id, q]))

  // Synthesized prompts for dynamically injected followups
  const synthPrompt = (id: string): { prompt: string; type: QuestionDTO['type']; baseId?: string } | null => {
    if (id === 'pkg-alignment-subsequent-followup') {
      return { prompt: 'Should you deprioritize it then? Why are you still doing this project?', type: 'text', baseId: 'pkg-alignment-subsequent' }
    }
    if (id === 'pkg-next-action-subsequent-followup') {
      return { prompt: 'Please edit your task details and define a clear next action.', type: 'text', baseId: 'pkg-next-action-subsequent' }
    }
    if (id === 'pkg-timeline-subsequent-followup') {
      return { prompt: "What's the new realistic timeline for this project?", type: 'text-parsed', baseId: 'pkg-timeline-subsequent' }
    }
    if (id === 'pkg-engagement-initial-followup') {
      return { prompt: 'What would increase your engagement with this project?', type: 'text', baseId: 'pkg-engagement-initial' }
    }
    return null
  }
  
  // Get current timestamp for "reviewed on" date
  const reviewedOn = formatReviewDate(new Date().toISOString())
  
  // Format week header
  const weekHeader = `**Week of ${formatWeekDate(weekOf)}** *(Reviewed: ${reviewedOn})*`
  
  // Sort answers by question order, then format each answer
  const formattedAnswers = answers
    .map(answer => {
      let question = questionMap.get(answer.questionID)
      if (!question) {
        // Attempt to synthesize a question for known dynamic followups
        const synth = synthPrompt(answer.questionID)
        if (synth) {
          const base = synth.baseId ? questionMap.get(synth.baseId) : undefined
          question = {
            id: answer.questionID,
            prompt: synth.prompt,
            type: synth.type,
            order: base ? base.order + 0.1 : (questions.length + 0.1)
          }
        } else {
          console.warn(`Question not found for answer: ${answer.questionID}`)
          return null
        }
      }
      return { answer, question }
    })
    .filter((item): item is { answer: AnswerDraft; question: QuestionDTO } => item !== null)
    .sort((a, b) => a.question.order - b.question.order) // Sort by question order
    .map(({ answer, question }) => formatAnswer(answer, question))
  
  // Combine into final markdown
  const markdown = [
    '---',
    '',
    weekHeader,
    '',
    ...formattedAnswers,
    '',
    '---'
  ].join('\n')
  
  return markdown
}

/**
 * Get the ISO date string for the start of the current week (Monday)
 */
export function getStartOfISOWeek(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay() || 7 // Sunday = 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day + 1) // Move to Monday
  return d.toISOString().slice(0, 10) // Return YYYY-MM-DD
}

/**
 * Get questions for a project based on review history
 * Helper function that determines if it's first or subsequent review
 */
export async function getQuestionsForFormatting(projectId: string): Promise<QuestionDTO[]> {
  // Check if this project has been reviewed before
  const hasHistory = await hasBeenReviewedBefore(projectId)
  return await getQuestionsForProject(projectId, hasHistory)
}

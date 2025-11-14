// utils/timeline-validation.ts
import { getStartOfISOWeek } from '../services/review-formatter'
import { getProjectAnswersForWeek } from '../repos/answersRepo'

const TIMELINE_QUESTION_IDS = [
  'pkg-timeline-initial',
  'pkg-timeline-subsequent',
  'pkg-timeline-subsequent-followup'
]

/**
 * Check if a project has a valid parsed timeline for the current week
 * @param projectId Project ID to check
 * @param weekOf Optional week to check (defaults to current week)
 * @returns true if project has a valid parsed timeline date
 */
export async function hasValidTimeline(
  projectId: string,
  weekOf?: string
): Promise<boolean> {
  const targetWeek = weekOf || getStartOfISOWeek()
  const answers = await getProjectAnswersForWeek(projectId, targetWeek)
  
  // Check if any timeline question has a parsedDate
  return answers.some(answer => 
    TIMELINE_QUESTION_IDS.includes(answer.questionID) && 
    answer.parsedDate != null &&
    answer.parsedDate.trim() !== ''
  )
}


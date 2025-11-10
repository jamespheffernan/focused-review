import type { QuestionType } from '../types'

/**
 * Determine the contextual hint to show alongside the "Last Week" answer block.
 * Ensures we only surface guidance that matches the current interaction model.
 */
export function getLastWeekAnswerHint(questionId: string, questionType: QuestionType): string | null {
  if (questionId === 'pkg-timeline-subsequent') {
    return 'Answer above to confirm or adjust the timeline.'
  }

  if (questionType === 'text' || questionType === 'text-parsed') {
    return 'Update the field below to revise this answer.'
  }

  return null
}



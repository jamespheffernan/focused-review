import type { QuestionDTO, QuestionPackageDTO, FollowupLogic, AnswerDraft } from '../types'
import { getAllPackages } from '../repos/questionPackagesRepo'
import { latest } from '../repos/answersRepo'
import { getCommitmentsForProject } from '../repos/timelineCommitmentsRepo'
import { formatDisplayDate } from '../utils/calendar-utils'

/**
 * Check if a followup logic type depends on the current week's answer
 * These followups should NOT be pre-loaded, but instead injected dynamically
 * when the user answers the parent question in the current week
 */
function dependsOnCurrentWeekAnswer(logic: FollowupLogic): boolean {
  switch (logic) {
    case 'if_no':
    case 'if_yes':
    case 'if_score_lte':
    case 'if_score_gte':
    case 'if_text_equals':
    case 'if_text_contains':
      return true
    case 'always':
    case 'never':
    case 'if_answered':
    case 'if_empty':
      return false
    default:
      return false
  }
}

/**
 * Determine if a followup question should be shown based on the answer and logic
 */
function shouldShowFollowup(answer: AnswerDraft | undefined, logic: FollowupLogic, conditionValue?: string | number): boolean {
  if (!answer) return false
  
  switch (logic) {
    case 'always':
      return true
    case 'never':
      return false
    case 'if_answered':
      return answer.text !== undefined && answer.text.trim() !== '' || answer.engagementScore !== undefined
    case 'if_empty':
      return answer.text === undefined || answer.text.trim() === ''
    case 'if_yes':
      return answer.text === 'yes' || answer.text === 'Yes'
    case 'if_no':
      return answer.text === 'no' || answer.text === 'No'
    case 'if_score_lte':
      return answer.engagementScore !== undefined && answer.engagementScore <= (conditionValue as number)
    case 'if_score_gte':
      return answer.engagementScore !== undefined && answer.engagementScore >= (conditionValue as number)
    case 'if_text_equals':
      return answer.text === conditionValue
    case 'if_text_contains':
      return answer.text?.includes(conditionValue as string) || false
    default:
      return false
  }
}

/**
 * Expand a QuestionPackage into individual questions based on review status and previous answers
 */
async function expandPackage(pkg: QuestionPackageDTO, projectId: string, hasBeenReviewedBefore: boolean): Promise<QuestionDTO[]> {
  const questions: QuestionDTO[] = []
  
  if (hasBeenReviewedBefore) {
    // Subsequent review - use subsequent question if it exists
    if (pkg.subsequentQuestion) {
      const questionId = `${pkg.id}-subsequent`
      let prompt = pkg.subsequentQuestion
      
      // Enhance timeline subsequent question with most recent commitment
      if (pkg.id === 'pkg-timeline' && questionId === 'pkg-timeline-subsequent') {
        const commitments = await getCommitmentsForProject(projectId)
        if (commitments.length > 0) {
          // Sort by weekOf descending to get most recent
          commitments.sort((a, b) => b.weekOf.localeCompare(a.weekOf))
          const mostRecent = commitments[0]
          const formattedDate = formatDisplayDate(mostRecent.committedDate)
          prompt = `Last committed: ${formattedDate}. ${pkg.subsequentQuestion}`
        }
      }
      
      questions.push({
        id: questionId,
        prompt,
        type: pkg.subsequentQuestionType || 'text',
        order: pkg.order
      })
      
      // Check if followup should be shown
      // Skip pre-loading followups that depend on current week's answer (if_no, if_yes, etc.)
      // These will be injected dynamically by FocusScreen.tsx when the user answers
      if (pkg.subsequentFollowup && pkg.subsequentFollowupLogic) {
        // Only pre-load followups that don't depend on current week's answer
        if (!dependsOnCurrentWeekAnswer(pkg.subsequentFollowupLogic)) {
          const parentAnswer = await latest(projectId, questionId)
          if (shouldShowFollowup(parentAnswer, pkg.subsequentFollowupLogic, pkg.subsequentFollowupConditionValue)) {
            questions.push({
              id: `${pkg.id}-subsequent-followup`,
              prompt: pkg.subsequentFollowup,
              type: pkg.subsequentFollowupType || 'text',
              order: pkg.order + 0.5 // Place after main question
            })
          }
        }
        // For logic types that depend on current week's answer, rely on dynamic injection
        // in FocusScreen.tsx which correctly checks the current answer
      }
    }
  } else {
    // Initial review - use initial question
    const questionId = `${pkg.id}-initial`
    questions.push({
      id: questionId,
      prompt: pkg.initialQuestion,
      type: pkg.initialQuestionType,
      order: pkg.order
    })
    
    // Check if followup should be shown
    // For initial questions, we can pre-load followups since there's no previous week
    // However, for consistency and to avoid similar bugs, we'll also skip pre-loading
    // followups that depend on current answer (if_no, if_yes, etc.)
    if (pkg.initialFollowup && pkg.initialFollowupLogic) {
      // Only pre-load followups that don't depend on current answer
      if (!dependsOnCurrentWeekAnswer(pkg.initialFollowupLogic)) {
        const parentAnswer = await latest(projectId, questionId)
        if (shouldShowFollowup(parentAnswer, pkg.initialFollowupLogic, pkg.initialFollowupConditionValue)) {
          questions.push({
            id: `${pkg.id}-initial-followup`,
            prompt: pkg.initialFollowup,
            type: pkg.initialFollowupType || 'text',
            order: pkg.order + 0.5 // Place after main question
          })
        }
      }
      // For logic types that depend on current answer, rely on dynamic injection
      // in FocusScreen.tsx which correctly checks the current answer
    }
  }
  
  return questions
}

/**
 * Load QuestionPackages and expand them into questions for a specific project
 */
export async function loadQuestionPackagesForProject(projectId: string, hasBeenReviewedBefore: boolean): Promise<QuestionDTO[]> {
  try {
    const packages = await getAllPackages()
    const allQuestions: QuestionDTO[] = []
    
    for (const pkg of packages) {
      const questions = await expandPackage(pkg, projectId, hasBeenReviewedBefore)
      allQuestions.push(...questions)
    }
    
    // Sort by order
    return allQuestions.sort((a, b) => a.order - b.order)
  } catch (error) {
    console.error('Error loading question packages:', error)
    return []
  }
}

/**
 * Get questions for a specific project based on review history
 * This is the main entry point for the new QuestionPackage system
 */
export async function getQuestionsForProject(projectId: string, hasBeenReviewedBefore: boolean): Promise<QuestionDTO[]> {
  return await loadQuestionPackagesForProject(projectId, hasBeenReviewedBefore)
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getQuestionsForProject instead
 */
export async function loadReviewQuestions(): Promise<{first: QuestionDTO[], subsequent: QuestionDTO[]}> {
  console.warn('loadReviewQuestions is deprecated, use getQuestionsForProject instead')
  
  // Return empty arrays for legacy compatibility
  return {
    first: [],
    subsequent: []
  }
}


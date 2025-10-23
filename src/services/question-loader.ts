import type { QuestionDTO, QuestionPackageDTO, FollowupLogic, AnswerDraft } from '../types'
import { getAllPackages } from '../repos/questionPackagesRepo'
import { latest } from '../repos/answersRepo'

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
      questions.push({
        id: questionId,
        prompt: pkg.subsequentQuestion,
        type: pkg.subsequentQuestionType || 'text',
        order: pkg.order
      })
      
      // Check if followup should be shown
      if (pkg.subsequentFollowup && pkg.subsequentFollowupLogic) {
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
    if (pkg.initialFollowup && pkg.initialFollowupLogic) {
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


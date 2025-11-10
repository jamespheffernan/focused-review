// services/timeline-cache.ts
import type { AnswerDraft, ProjectDTO } from '../types'
import { upsertCommitment, deleteCommitmentForProjectAndWeek, getCommitmentForProjectAndWeek, getCommitmentsForProject } from '../repos/timelineCommitmentsRepo'
import { getWeekOffset } from '../utils/calendar-utils'

/**
 * Check if a question ID is a timeline-related question
 */
function isTimelineQuestion(questionId: string): boolean {
  return (
    questionId === 'pkg-timeline-initial' ||
    questionId === 'pkg-timeline-subsequent' ||
    questionId === 'pkg-timeline-subsequent-followup'
  )
}

/**
 * Sync an answer to the timeline commitments cache
 * Creates/updates/deletes commitment based on answer content
 * 
 * @param answer The answer draft to sync
 * @param project The project associated with the answer
 */
export async function syncAnswerToTimelineCache(
  answer: AnswerDraft,
  project: ProjectDTO
): Promise<void> {
  // Only process timeline-related questions
  if (!isTimelineQuestion(answer.questionID)) {
    return
  }

  console.log(`📅 Syncing timeline answer to cache:`, {
    questionId: answer.questionID,
    projectId: answer.projectID,
    weekOf: answer.weekOf,
    parsedDate: answer.parsedDate,
    text: answer.text,
    isTimelineQuestion: isTimelineQuestion(answer.questionID)
  })

  // Handle different timeline question types
  if (answer.questionID === 'pkg-timeline-subsequent') {
    console.log(`📅 Processing pkg-timeline-subsequent question`)
    // This is the yes/no question "Is this timeline still realistic?"
    if (answer.text === 'yes') {
      console.log(`📅 User answered 'yes' - looking for previous commitment`)
      // User confirmed timeline is still realistic - carry forward most recent commitment
      const previousWeek = getWeekOffset(answer.weekOf, -1)
      console.log(`📅 Previous week: ${previousWeek}`)
      let previousCommitment = await getCommitmentForProjectAndWeek(answer.projectID, previousWeek)
      console.log(`📅 Previous commitment found:`, previousCommitment)
      
      // If no commitment exists for the immediate previous week, fall back to the most recent one
      if (!previousCommitment) {
        console.log(`📅 No commitment found for previous week. Looking for most recent commitment before ${answer.weekOf}`)
        const allCommitments = await getCommitmentsForProject(answer.projectID)
        if (allCommitments.length > 0) {
          previousCommitment = allCommitments
            .filter(commitment => commitment.weekOf < answer.weekOf)
            .sort((a, b) => b.weekOf.localeCompare(a.weekOf))[0]
          console.log(`📅 Most recent historical commitment:`, previousCommitment)
        }
      }
      
      if (previousCommitment) {
        console.log(`📅 User confirmed timeline - carrying forward from previous week:`, previousCommitment)
        
        // Create new commitment for current week with same date
        const commitment = {
          id: `commitment-${answer.projectID}-${answer.weekOf}`,
          projectId: answer.projectID,
          projectName: project.name,
          weekOf: answer.weekOf,
          committedDate: previousCommitment.committedDate,
          answerId: answer.id,
          createdAt: new Date().toISOString()
        }
        
        console.log(`📅 Creating new commitment:`, commitment)
        await upsertCommitment(commitment)
        console.log(`📅 Commitment created successfully`)
        return
      } else {
        console.log(`📅 User confirmed timeline but no previous commitment found - skipping`)
        return
      }
    } else if (answer.text === 'no') {
      console.log(`📅 User answered 'no' - removing commitment`)
      // User said timeline is not realistic - remove any existing commitment
      // The followup question will create a new one if answered
      console.log(`📅 User said timeline not realistic - removing commitment`)
      await deleteCommitmentForProjectAndWeek(answer.projectID, answer.weekOf)
      return
    } else {
      console.log(`📅 Unexpected text for pkg-timeline-subsequent: "${answer.text}"`)
    }
  }

  // For initial questions and followup questions, or if subsequent question has parsedDate
  console.log(`📅 Processing non-subsequent timeline question: ${answer.questionID}`)
  // If no parsed date, remove any existing commitment
  if (!answer.parsedDate) {
    console.log(`📅 No parsed date - removing commitment if exists`)
    await deleteCommitmentForProjectAndWeek(answer.projectID, answer.weekOf)
    return
  }

  // Create or update commitment
  const commitment = {
    id: `commitment-${answer.projectID}-${answer.weekOf}`, // Deterministic ID
    projectId: answer.projectID,
    projectName: project.name,
    weekOf: answer.weekOf,
    committedDate: answer.parsedDate,
    answerId: answer.id,
    createdAt: new Date().toISOString()
  }

  console.log(`📅 Upserting timeline commitment:`, commitment)
  await upsertCommitment(commitment)
  console.log(`📅 Commitment upserted successfully`)
}

/**
 * Check if we should sync this answer to timeline cache
 * Used to filter answers before calling syncAnswerToTimelineCache
 */
export function shouldSyncToTimelineCache(questionId: string): boolean {
  return isTimelineQuestion(questionId)
}


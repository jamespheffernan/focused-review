// repos/answersRepo.ts
import { db } from '../db'; import type { AnswerDraft } from '../types'

export const latest = async (projectID: string, questionID: string) =>
  (await db.answers.where({projectID, questionID}).reverse().sortBy('weekOf'))[0]

export const upsert = async (draft: AnswerDraft) => db.answers.put(draft)

/**
 * Check if a project has been reviewed before (has any answers)
 */
export const hasBeenReviewedBefore = async (projectID: string): Promise<boolean> => {
  const count = await db.answers.where('projectID').equals(projectID).count()
  return count > 0
}

/**
 * Get all answers for a specific project and week
 * Uses composite index [projectID+weekOf] for efficient querying
 */
export const getProjectAnswersForWeek = async (
  projectID: string, 
  weekOf: string
): Promise<AnswerDraft[]> => {
  return await db.answers
    .where('[projectID+weekOf]')
    .equals([projectID, weekOf])
    .toArray()
}

/**
 * Get all answers for a specific project across all weeks
 * Sorted by week in descending order (newest first)
 */
export const getAllAnswersForProject = async (projectID: string): Promise<AnswerDraft[]> => {
  return await db.answers
    .where('projectID')
    .equals(projectID)
    .reverse()
    .sortBy('weekOf')
}

/**
 * Remove duplicate answers, keeping only the most recent one per project+question+week
 * This cleans up duplicates created before the fix that reuses IDs
 */
export const removeDuplicateAnswers = async (): Promise<number> => {
  const allAnswers = await db.answers.toArray()
  
  // Group by project+question+week
  const groups = new Map<string, AnswerDraft[]>()
  
  for (const answer of allAnswers) {
    const key = `${answer.projectID}:${answer.questionID}:${answer.weekOf}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(answer)
  }
  
  // For each group with duplicates, keep the most recent (by id), delete rest
  let removedCount = 0
  
  for (const [key, answers] of groups) {
    if (answers.length > 1) {
      // Sort by ID (UUIDs are sortable by creation time in most cases)
      // Keep the last one (most recent)
      answers.sort((a, b) => a.id.localeCompare(b.id))
      const toKeep = answers[answers.length - 1]
      const toRemove = answers.slice(0, -1)
      
      for (const answer of toRemove) {
        await db.answers.delete(answer.id)
        removedCount++
      }
      
      if (toRemove.length > 0) {
        console.log(`🧹 Removed ${toRemove.length} duplicate answers for ${key}, kept ${toKeep.id}`)
      }
    }
  }
  
  if (removedCount > 0) {
    console.log(`🧹 Total duplicate answers removed: ${removedCount}`)
  }
  return removedCount
}

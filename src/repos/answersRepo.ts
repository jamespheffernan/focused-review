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

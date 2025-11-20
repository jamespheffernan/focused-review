// repos/timelineCommitmentsRepo.ts
import { db, type ReviewDB } from '../db'
import type { TimelineCommitmentDTO } from '../types'

/**
 * Add or update a timeline commitment
 */
export async function upsertCommitment(commitment: TimelineCommitmentDTO): Promise<void> {
  await db.timelineCommitments.put(commitment)
}

/**
 * Get all commitments for a specific week
 */
export async function getCommitmentsForWeek(weekOf: string): Promise<TimelineCommitmentDTO[]> {
  return await db.timelineCommitments
    .where('weekOf')
    .equals(weekOf)
    .toArray()
}

/**
 * Get commitment for a specific project and week
 */
export async function getCommitmentForProjectAndWeek(
  projectId: string,
  weekOf: string
): Promise<TimelineCommitmentDTO | undefined> {
  return await db.timelineCommitments
    .where('[projectId+weekOf]')
    .equals([projectId, weekOf])
    .first()
}

/**
 * Delete a specific commitment
 */
export async function deleteCommitment(id: string): Promise<void> {
  await db.timelineCommitments.delete(id)
}

/**
 * Delete commitment by project and week
 */
export async function deleteCommitmentForProjectAndWeek(
  projectId: string,
  weekOf: string
): Promise<void> {
  const commitment = await getCommitmentForProjectAndWeek(projectId, weekOf)
  if (commitment) {
    await deleteCommitment(commitment.id)
  }
}

/**
 * Get all commitments for a project across all weeks
 */
export async function getCommitmentsForProject(projectId: string): Promise<TimelineCommitmentDTO[]> {
  return await db.timelineCommitments
    .where('projectId')
    .equals(projectId)
    .toArray()
}

/**
 * Get commitments within a date range
 */
export async function getCommitmentsInDateRange(
  startDate: string,
  endDate: string
): Promise<TimelineCommitmentDTO[]> {
  return await db.timelineCommitments
    .where('committedDate')
    .between(startDate, endDate, true, true)
    .toArray()
}

/**
 * Delete all commitments for a specific week
 */
export async function deleteCommitmentsForWeek(weekOf: string): Promise<number> {
  const commitments = await getCommitmentsForWeek(weekOf)
  const count = commitments.length
  
  for (const commitment of commitments) {
    await deleteCommitment(commitment.id)
  }
  
  return count
}

/**
 * Remove orphaned commitments that reference projects that no longer exist
 * @param validProjectIds - Array of project IDs that currently exist
 * @param dbInstance - Optional database instance (for testing)
 * @returns Number of orphaned commitments removed
 */
export async function cleanupOrphanedCommitments(
  validProjectIds: string[],
  dbInstance: ReviewDB = db
): Promise<number> {
  if (validProjectIds.length === 0) {
    // If no valid projects, skip cleanup to avoid deleting everything
    return 0
  }
  
  const validProjectIdSet = new Set(validProjectIds)
  const allCommitments = await dbInstance.timelineCommitments.toArray()
  
  let removedCount = 0
  for (const commitment of allCommitments) {
    if (!validProjectIdSet.has(commitment.projectId)) {
      await dbInstance.timelineCommitments.delete(commitment.id)
      removedCount++
    }
  }
  
  if (removedCount > 0) {
    console.log(`🧹 Cleaned up ${removedCount} orphaned timeline commitments`)
  }
  
  return removedCount
}


// repos/weeklyReviewsRepo.ts
import { db } from '../db'
import type { WeeklyReviewDTO, WeeklyReviewState } from '../types'

/**
 * Create a new weekly review
 */
export async function createWeeklyReview(weekOf: string): Promise<WeeklyReviewDTO> {
  const review: WeeklyReviewDTO = {
    id: crypto.randomUUID(),
    weekOf,
    state: 'not_started',
    createdAt: new Date().toISOString()
  }
  await db.weeklyReviews.add(review)
  return review
}

/**
 * Get a weekly review by ID
 */
export async function getWeeklyReview(id: string): Promise<WeeklyReviewDTO | undefined> {
  return await db.weeklyReviews.get(id)
}

/**
 * Get weekly review for a specific week
 */
export async function getWeeklyReviewForWeek(weekOf: string): Promise<WeeklyReviewDTO | undefined> {
  return await db.weeklyReviews
    .where('weekOf')
    .equals(weekOf)
    .first()
}

/**
 * Get or create weekly review for a week
 * Returns existing review if found, otherwise creates a new one
 */
export async function getOrCreateWeeklyReviewForWeek(weekOf: string): Promise<WeeklyReviewDTO> {
  const existing = await getWeeklyReviewForWeek(weekOf)
  if (existing) {
    return existing
  }
  return await createWeeklyReview(weekOf)
}

/**
 * Update weekly review state
 */
export async function updateWeeklyReviewState(
  id: string,
  state: WeeklyReviewState,
  timestamp?: string
): Promise<void> {
  const review = await db.weeklyReviews.get(id)
  if (!review) return

  const updates: Partial<WeeklyReviewDTO> = { state }
  
  if (state === 'in_progress' && !review.startedAt) {
    updates.startedAt = timestamp || new Date().toISOString()
  } else if (state === 'completed') {
    updates.completedAt = timestamp || new Date().toISOString()
  } else if (state === 'cleared') {
    updates.clearedAt = timestamp || new Date().toISOString()
  }

  await db.weeklyReviews.update(id, updates)
}

/**
 * Update weekly review
 */
export async function updateWeeklyReview(
  id: string,
  updates: Partial<WeeklyReviewDTO>
): Promise<void> {
  await db.weeklyReviews.update(id, updates)
}

/**
 * Delete weekly review
 */
export async function deleteWeeklyReview(id: string): Promise<void> {
  await db.weeklyReviews.delete(id)
}

/**
 * Delete weekly review for a specific week
 */
export async function deleteWeeklyReviewForWeek(weekOf: string): Promise<void> {
  const review = await getWeeklyReviewForWeek(weekOf)
  if (review) {
    await deleteWeeklyReview(review.id)
  }
}

/**
 * Get all weekly reviews, optionally filtered by state
 */
export async function getAllWeeklyReviews(state?: WeeklyReviewState): Promise<WeeklyReviewDTO[]> {
  if (state) {
    return await db.weeklyReviews
      .where('state')
      .equals(state)
      .toArray()
  }
  return await db.weeklyReviews.toArray()
}


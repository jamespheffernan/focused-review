// services/week-clearer.ts
import { deleteAnswersForWeek } from '../repos/answersRepo'
import { deleteCommitmentsForWeek } from '../repos/timelineCommitmentsRepo'
import { deleteSessionsForWeeklyReview } from '../repos/sessionsRepo'
import * as WeeklyReviews from '../repos/weeklyReviewsRepo'

/**
 * Clear all data for a specific week's review
 * Deletes answers, commitments, sessions, and marks weekly review as cleared
 */
export async function clearWeekReview(weekOf: string): Promise<{
  answersDeleted: number
  commitmentsDeleted: number
  sessionsDeleted: number
}> {
  console.log(`🧹 Clearing week review for ${weekOf}`)
  
  // Get weekly review to delete sessions
  const weeklyReview = await WeeklyReviews.getWeeklyReviewForWeek(weekOf)
  
  // Delete answers
  const answersDeleted = await deleteAnswersForWeek(weekOf)
  console.log(`  ✓ Deleted ${answersDeleted} answers`)
  
  // Delete commitments
  const commitmentsDeleted = await deleteCommitmentsForWeek(weekOf)
  console.log(`  ✓ Deleted ${commitmentsDeleted} commitments`)
  
  // Delete sessions for this weekly review
  let sessionsDeleted = 0
  if (weeklyReview) {
    sessionsDeleted = await deleteSessionsForWeeklyReview(weeklyReview.id)
    console.log(`  ✓ Deleted ${sessionsDeleted} sessions`)
    
    // Mark weekly review as cleared
    await WeeklyReviews.updateWeeklyReviewState(weeklyReview.id, 'cleared')
    console.log(`  ✓ Marked weekly review as cleared`)
  }
  
  console.log(`✅ Week review cleared successfully`)
  
  return {
    answersDeleted,
    commitmentsDeleted,
    sessionsDeleted
  }
}


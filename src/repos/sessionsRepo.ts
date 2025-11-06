// repos/sessionsRepo.ts
import { db } from '../db'; import type { SessionDTO, SummaryStats } from '../types'

export async function startSession(weeklyReviewId?: string): Promise<SessionDTO> {
  const s: SessionDTO = { 
    id: crypto.randomUUID(), 
    startedAt: new Date().toISOString(), 
    projectsReviewed: 0, 
    projectsSkipped: 0, 
    avgTimePerProjectSec: 0,
    weeklyReviewId
  }
  await db.sessions.add(s); return s
}

export async function incrementProjectsReviewed(sessionID: string | undefined, timeSpentSec: number = 0) {
  if (!sessionID) return
  const s = await db.sessions.get(sessionID)
  if (!s) return
  
  s.projectsReviewed += 1
  
  // Update average time per project
  const totalProjects = s.projectsReviewed + s.projectsSkipped
  if (totalProjects > 0) {
    const totalTime = s.avgTimePerProjectSec * (totalProjects - 1) + timeSpentSec
    s.avgTimePerProjectSec = Math.round(totalTime / totalProjects)
  }
  
  await db.sessions.put(s)
}

export async function incrementProjectsSkipped(sessionID: string | undefined, timeSpentSec: number = 0) {
  if (!sessionID) return
  const s = await db.sessions.get(sessionID)
  if (!s) return
  
  s.projectsSkipped += 1
  
  // Update average time per project
  const totalProjects = s.projectsReviewed + s.projectsSkipped
  if (totalProjects > 0) {
    const totalTime = s.avgTimePerProjectSec * (totalProjects - 1) + timeSpentSec
    s.avgTimePerProjectSec = Math.round(totalTime / totalProjects)
  }
  
  await db.sessions.put(s)
}

export async function finishSession(sessionID: string, stats: SummaryStats) {
  const s = await db.sessions.get(sessionID); if (!s) return
  s.endedAt = new Date().toISOString(); s.projectsReviewed = stats.reviewed; s.projectsSkipped = stats.skipped; s.avgTimePerProjectSec = stats.avgTimePerProjectSec
  await db.sessions.put(s)
}

/**
 * Delete all sessions for a specific weekly review
 */
export async function deleteSessionsForWeeklyReview(weeklyReviewId: string): Promise<number> {
  const sessions = await db.sessions
    .where('weeklyReviewId')
    .equals(weeklyReviewId)
    .toArray()
  
  const count = sessions.length
  for (const session of sessions) {
    await db.sessions.delete(session.id)
  }
  
  return count
}

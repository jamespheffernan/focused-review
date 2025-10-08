// repos/sessionsRepo.ts
import { db } from '../db'; import type { ProjectDTO, SessionDTO, SummaryStats } from '../types'

export async function startSession(_queue: ProjectDTO[]): Promise<SessionDTO> {
  const s: SessionDTO = { id: crypto.randomUUID(), startedAt: new Date().toISOString(), projectsReviewed: 0, projectsSkipped: 0, avgTimePerProjectSec: 0 }
  await db.sessions.add(s); return s
}
export async function finishSession(sessionID: string, stats: SummaryStats) {
  const s = await db.sessions.get(sessionID); if (!s) return
  s.endedAt = new Date().toISOString(); s.projectsReviewed = stats.reviewed; s.projectsSkipped = stats.skipped; s.avgTimePerProjectSec = stats.avgTimePerProjectSec
  await db.sessions.put(s)
}

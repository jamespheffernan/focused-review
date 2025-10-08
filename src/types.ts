export type ProjectStatus = 'active'|'on_hold'|'dropped'
export type QuestionType = 'text'|'slider'
export type AnswerStatus = 'CarriedForward'|'Updated'|'New'
export type SyncState = 'synced'|'queued'|'retrying'|'error'
export type TaskStatus = 'available'|'next'|'blocked'|'completed'

export interface ProjectDTO {
  id: string; name: string; status: ProjectStatus
  deferDate?: string; dueDate?: string; reviewIntervalDays: number
  tags: string[]; lastReviewed?: string; nextReviewDate?: string
  notes?: string  // Project notes - first line may contain Notion deep link
}

export interface TaskDTO {
  id: string
  projectId: string
  name: string
  status: TaskStatus
  dueDate?: string
  deferDate?: string
  context?: string
  flagged: boolean
  note?: string
  completed: boolean
  completedDate?: string
  lastModified: string
  syncState: SyncState
}

export interface QuestionDTO { id: string; prompt: string; type: QuestionType; order: number }

export interface AnswerDraft {
  id: string; projectID: string; questionID: string
  text?: string; engagementScore?: number
  weekOf: string; status: AnswerStatus
}

export interface SessionDTO {
  id: string; startedAt: string; endedAt?: string
  projectsReviewed: number; projectsSkipped: number; avgTimePerProjectSec: number
}

export interface SummaryStats { reviewed: number; skipped: number; totalTimeSec: number; avgTimePerProjectSec: number }

export interface NotionSyncQueueItem {
  id: string                    // UUID for queue item
  projectId: string            // OmniFocus project ID
  weekOf: string               // ISO date for week (e.g., "2025-10-01")
  createdAt: string            // When item was added to queue
  attempts: number             // Number of sync attempts
  lastAttempt?: string         // Timestamp of last attempt
  nextRetry?: string           // Timestamp when to retry next
  status: 'pending' | 'retrying' | 'failed' | 'completed'
  errorMessage?: string        // Last error if failed
}

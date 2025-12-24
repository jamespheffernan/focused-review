export type ProjectStatus = 'active'|'on_hold'|'dropped'
export type QuestionType = 'text'|'slider'|'yes-no'|'text-parsed'|'instruction'
export type FollowupLogic = 'always'|'never'|'if_yes'|'if_no'|'if_answered'|'if_empty'|'if_score_lte'|'if_score_gte'|'if_text_equals'|'if_text_contains'
export type AnswerStatus = 'CarriedForward'|'Updated'|'New'
export type SyncState = 'synced'|'queued'|'retrying'|'error'
export type TaskStatus = 'available'|'next'|'blocked'|'completed'
export type WeeklyReviewState = 'not_started'|'in_progress'|'completed'|'cleared'

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
  tags: string[]
  flagged: boolean
  note?: string
  completed: boolean
  completedDate?: string
  lastModified: string
  syncState: SyncState
}

export interface QuestionDTO { id: string; prompt: string; type: QuestionType; order: number }

export interface QuestionPackageDTO {
  id: string
  order: number
  initialQuestion: string
  initialQuestionType: QuestionType
  initialFollowupLogic?: FollowupLogic
  initialFollowupConditionValue?: string | number
  initialFollowup?: string
  initialFollowupType?: QuestionType
  subsequentQuestion?: string
  subsequentQuestionType?: QuestionType
  subsequentFollowupLogic?: FollowupLogic
  subsequentFollowupConditionValue?: string | number
  subsequentFollowup?: string
  subsequentFollowupType?: QuestionType
}

export interface AnswerDraft {
  id: string; projectID: string; questionID: string
  text?: string; engagementScore?: number
  weekOf: string; status: AnswerStatus
  parentAnswerId?: string
  parsedDate?: string
}

export interface SessionDTO {
  id: string; startedAt: string; endedAt?: string
  projectsReviewed: number; projectsSkipped: number; avgTimePerProjectSec: number
  weeklyReviewId?: string
}

export interface WeeklyReviewDTO {
  id: string
  weekOf: string                    // ISO date for week (e.g., "2025-10-21")
  state: WeeklyReviewState
  startedAt?: string                // When review was started
  completedAt?: string               // When review was completed
  clearedAt?: string                 // When review was cleared
  createdAt: string                 // When record was created
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

export interface TimelineCommitmentDTO {
  id: string                    // UUID for commitment
  projectId: string            // OmniFocus project ID
  projectName: string          // Project name for display
  weekOf: string               // ISO date for week (e.g., "2025-10-21")
  committedDate: string        // ISO date when project committed to finish (e.g., "2025-11-15")
  answerId: string             // ID of the answer that created this commitment
  createdAt: string            // Timestamp when commitment was created
}

// Natural Planning Model types
export interface PlanningSessionDTO {
  id: string                           // UUID
  projectId: string                    // Reference to OmniFocus project
  projectName: string                  // Denormalized for display
  createdAt: string                    // ISO timestamp
  updatedAt: string                    // ISO timestamp
  currentStage: 1 | 2 | 3 | 4 | 5
  completedStages: number[]            // e.g., [1, 2] means stages 1-2 complete
  
  // Stage 1: Purpose
  purposeStatement: string
  principles: string[]
  
  // Stage 2: Vision
  visionDescription: string
  successCriteria: PlanningSuccessCriterion[]
  
  // Stage 3: Brainstorm
  brainstormItems: PlanningBrainstormItem[]
  
  // Stage 4: Organize
  workstreams: PlanningWorkstream[]
  unorganizedItemIds: string[]
  
  // Stage 5: Next Actions
  nextActions: PlanningNextAction[]
  
  // Notion Sync (Stream I)
  syncedToNotion: boolean              // Track if planning has been synced
  notionSyncedAt?: string              // ISO timestamp of last sync
}

export interface PlanningSuccessCriterion {
  id: string
  text: string
  completed: boolean
  order: number
}

export interface PlanningBrainstormItem {
  id: string
  text: string
  createdAt: string
  organized: boolean
  position: { x: number; y: number }   // 0-1 percentages
}

export interface PlanningWorkstream {
  id: string
  name: string
  itemIds: string[]                    // References to brainstorm item IDs
  order: number
}

export interface PlanningNextAction {
  id: string
  text: string
  workstreamId: string | null          // null = "Other" section
  context: string | null               // @context tag
  completed: boolean
  exportedToOmniFocus: boolean
  omniFocusTaskId?: string             // ID of the task in OmniFocus (if created)
}

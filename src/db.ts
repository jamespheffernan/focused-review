import Dexie, { type Table } from 'dexie'
import type { ProjectDTO, AnswerDraft, SessionDTO, TaskDTO, NotionSyncQueueItem, QuestionDTO, QuestionPackageDTO, TimelineCommitmentDTO, WeeklyReviewDTO } from './types'

export class ReviewDB extends Dexie {
  projects!: Table<ProjectDTO, string>
  answers!: Table<AnswerDraft, string>
  sessions!: Table<SessionDTO, string>
  tasks!: Table<TaskDTO, string>
  notionSyncQueue!: Table<NotionSyncQueueItem, string>
  questions!: Table<QuestionDTO, string>
  questionPackages!: Table<QuestionPackageDTO, string>
  timelineCommitments!: Table<TimelineCommitmentDTO, string>
  weeklyReviews!: Table<WeeklyReviewDTO, string>
  constructor() {
    super('reviewhud')
    this.version(1).stores({
      projects: 'id, lastReviewed',
      answers: 'id, projectID, questionID, weekOf',
      sessions: 'id, startedAt'
    })
    this.version(2).stores({
      projects: 'id, lastReviewed',
      answers: 'id, projectID, questionID, weekOf',
      sessions: 'id, startedAt',
      tasks: 'id, projectId, status, dueDate, context, flagged, completed, lastModified, syncState'
    })
    // Version 3: Add composite indexes for better query performance
    this.version(3).stores({
      projects: 'id, lastReviewed, status',
      answers: 'id, projectID, questionID, weekOf, [projectID+questionID], [projectID+weekOf]',
      sessions: 'id, startedAt',
      // Composite indexes: [projectId+status] and [projectId+completed] for efficient filtering
      tasks: 'id, projectId, status, completed, [projectId+status], [projectId+completed], dueDate, flagged, lastModified, syncState'
    })
    // Version 4: Add notes field to projects for Notion deep links
    this.version(4).stores({
      projects: 'id, lastReviewed, status',
      answers: 'id, projectID, questionID, weekOf, [projectID+questionID], [projectID+weekOf]',
      sessions: 'id, startedAt',
      tasks: 'id, projectId, status, completed, [projectId+status], [projectId+completed], dueDate, flagged, lastModified, syncState'
    })
    // Version 5: Add nextReviewDate index for review filtering
    this.version(5).stores({
      projects: 'id, lastReviewed, status, nextReviewDate',
      answers: 'id, projectID, questionID, weekOf, [projectID+questionID], [projectID+weekOf]',
      sessions: 'id, startedAt',
      tasks: 'id, projectId, status, completed, [projectId+status], [projectId+completed], dueDate, flagged, lastModified, syncState'
    })
    // Version 6: Add Notion sync queue for retry mechanism
    this.version(6).stores({
      projects: 'id, lastReviewed, status, nextReviewDate',
      answers: 'id, projectID, questionID, weekOf, [projectID+questionID], [projectID+weekOf]',
      sessions: 'id, startedAt',
      tasks: 'id, projectId, status, completed, [projectId+status], [projectId+completed], dueDate, flagged, lastModified, syncState',
      notionSyncQueue: 'id, projectId, weekOf, status, nextRetry, [projectId+weekOf]'
    })
    // Version 7: Add questions table for legacy support
    this.version(7).stores({
      projects: 'id, lastReviewed, status, nextReviewDate',
      answers: 'id, projectID, questionID, weekOf, [projectID+questionID], [projectID+weekOf]',
      sessions: 'id, startedAt',
      tasks: 'id, projectId, status, completed, [projectId+status], [projectId+completed], dueDate, flagged, lastModified, syncState',
      notionSyncQueue: 'id, projectId, weekOf, status, nextRetry, [projectId+weekOf]',
      questions: 'id, category, [category+order]'
    })
    // Version 8: Add questionPackages table and parentAnswerId to answers
    this.version(8).stores({
      projects: 'id, lastReviewed, status, nextReviewDate',
      answers: 'id, projectID, questionID, weekOf, parentAnswerId, [projectID+questionID], [projectID+weekOf]',
      sessions: 'id, startedAt',
      tasks: 'id, projectId, status, completed, [projectId+status], [projectId+completed], dueDate, flagged, lastModified, syncState',
      notionSyncQueue: 'id, projectId, weekOf, status, nextRetry, [projectId+weekOf]',
      questions: 'id, category, [category+order]',
      questionPackages: 'id, order'
    })
    // Version 9: Add parsedDate to answers for text-parsed questions
    this.version(9).stores({
      projects: 'id, lastReviewed, status, nextReviewDate',
      answers: 'id, projectID, questionID, weekOf, parentAnswerId, parsedDate, [projectID+questionID], [projectID+weekOf]',
      sessions: 'id, startedAt',
      tasks: 'id, projectId, status, completed, [projectId+status], [projectId+completed], dueDate, flagged, lastModified, syncState',
      notionSyncQueue: 'id, projectId, weekOf, status, nextRetry, [projectId+weekOf]',
      questions: 'id, category, [category+order]',
      questionPackages: 'id, order'
    })
    // Version 10: Add timelineCommitments table for calendar feature
    this.version(10).stores({
      projects: 'id, lastReviewed, status, nextReviewDate',
      answers: 'id, projectID, questionID, weekOf, parentAnswerId, parsedDate, [projectID+questionID], [projectID+weekOf]',
      sessions: 'id, startedAt',
      tasks: 'id, projectId, status, completed, [projectId+status], [projectId+completed], dueDate, flagged, lastModified, syncState',
      notionSyncQueue: 'id, projectId, weekOf, status, nextRetry, [projectId+weekOf]',
      questions: 'id, category, [category+order]',
      questionPackages: 'id, order',
      timelineCommitments: 'id, projectId, weekOf, committedDate, [projectId+weekOf]'
    })
    // Version 11: Add weeklyReviews table and link sessions to weeklyReviews
    this.version(11).stores({
      projects: 'id, lastReviewed, status, nextReviewDate',
      answers: 'id, projectID, questionID, weekOf, parentAnswerId, parsedDate, [projectID+questionID], [projectID+weekOf]',
      sessions: 'id, startedAt, weeklyReviewId',
      tasks: 'id, projectId, status, completed, [projectId+status], [projectId+completed], dueDate, flagged, lastModified, syncState',
      notionSyncQueue: 'id, projectId, weekOf, status, nextRetry, [projectId+weekOf]',
      questions: 'id, category, [category+order]',
      questionPackages: 'id, order',
      timelineCommitments: 'id, projectId, weekOf, committedDate, [projectId+weekOf]',
      weeklyReviews: 'id, weekOf, state, [weekOf+state]'
    })
  }
}
export const db = new ReviewDB()

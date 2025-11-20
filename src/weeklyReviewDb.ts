import Dexie, { type Table } from 'dexie'
import type { WeeklyReviewDTO } from './types'

export class WeeklyReviewDB extends Dexie {
  weeklyReviews!: Table<WeeklyReviewDTO, string>
  constructor() {
    super('weeklyReviewDB')
    this.version(1).stores({
      weeklyReviews: 'id, weekOf, state, [weekOf+state]'
    })
  }
}

// Create database instance - Dexie will open it automatically when first accessed
export const weeklyReviewDb = new WeeklyReviewDB()


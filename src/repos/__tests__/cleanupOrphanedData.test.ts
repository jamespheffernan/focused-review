import { describe, expect, it, vi } from 'vitest'

// Prevent Dexie from initializing in test environment
vi.mock('../../db', () => ({
  db: {}
}))

import { cleanupOrphanedAnswers } from '../answersRepo'
import { cleanupOrphanedCommitments } from '../timelineCommitmentsRepo'

type FakeDb = {
  answers: {
    toArray: () => Promise<Array<{ id: string; projectID: string }>>
    delete: (id: string) => Promise<void>
  }
  timelineCommitments: {
    toArray: () => Promise<Array<{ id: string; projectId: string }>>
    delete: (id: string) => Promise<void>
  }
}

const createFakeDb = () => {
  const answersStore: Array<{ id: string; projectID: string }> = []
  const commitmentsStore: Array<{ id: string; projectId: string }> = []
  
  const fakeDb: FakeDb = {
    answers: {
      toArray: async () => answersStore,
      delete: async (id: string) => {
        const idx = answersStore.findIndex(answer => answer.id === id)
        if (idx >= 0) {
          answersStore.splice(idx, 1)
        }
      }
    },
    timelineCommitments: {
      toArray: async () => commitmentsStore,
      delete: async (id: string) => {
        const idx = commitmentsStore.findIndex(commitment => commitment.id === id)
        if (idx >= 0) {
          commitmentsStore.splice(idx, 1)
        }
      }
    }
  }
  
  return { fakeDb, answersStore, commitmentsStore }
}

describe('cleanupOrphanedAnswers', () => {
  it('skips cleanup when no project IDs are provided', async () => {
    const { fakeDb, answersStore } = createFakeDb()
    answersStore.push(
      { id: 'answer-keep', projectID: 'project-keep' },
      { id: 'answer-drop', projectID: 'project-drop' }
    )
    
    const removed = await cleanupOrphanedAnswers([], fakeDb as any)
    expect(removed).toBe(0)
    expect(answersStore).toHaveLength(2)
  })
  
  it('removes answers for projects that are no longer present', async () => {
    const { fakeDb, answersStore } = createFakeDb()
    answersStore.push(
      { id: 'answer-keep', projectID: 'project-keep' },
      { id: 'answer-drop', projectID: 'project-drop' }
    )
    
    const removed = await cleanupOrphanedAnswers(['project-keep'], fakeDb as any)
    expect(removed).toBe(1)
    expect(answersStore).toHaveLength(1)
    expect(answersStore[0].id).toBe('answer-keep')
  })
})

describe('cleanupOrphanedCommitments', () => {
  it('skips cleanup when no project IDs are provided', async () => {
    const { fakeDb, commitmentsStore } = createFakeDb()
    commitmentsStore.push(
      { id: 'commitment-keep', projectId: 'project-keep' },
      { id: 'commitment-drop', projectId: 'project-drop' }
    )
    
    const removed = await cleanupOrphanedCommitments([], fakeDb as any)
    expect(removed).toBe(0)
    expect(commitmentsStore).toHaveLength(2)
  })
  
  it('removes commitments for projects that are no longer present', async () => {
    const { fakeDb, commitmentsStore } = createFakeDb()
    commitmentsStore.push(
      { id: 'commitment-keep', projectId: 'project-keep' },
      { id: 'commitment-drop', projectId: 'project-drop' }
    )
    
    const removed = await cleanupOrphanedCommitments(['project-keep'], fakeDb as any)
    expect(removed).toBe(1)
    expect(commitmentsStore).toHaveLength(1)
    expect(commitmentsStore[0].id).toBe('commitment-keep')
  })
})


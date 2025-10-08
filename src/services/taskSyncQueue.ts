// services/taskSyncQueue.ts
import { omnifocusBridge } from './omnifocus-bridge'
import type { TaskDTO } from '../types'

interface SyncQueueItem {
  taskId: string
  updates: Partial<TaskDTO>
  timestamp: number
  retryCount: number
}

class TaskSyncQueue {
  private queue: SyncQueueItem[] = []
  private processing = false
  private maxRetries = 3
  private failedItems: SyncQueueItem[] = []
  private listeners: Array<() => void> = []

  // Add a task update to the queue
  add(taskId: string, updates: Partial<TaskDTO>) {
    console.log('[TaskSyncQueue] Adding task to sync queue:', taskId)
    
    // Check if task is already in queue, update it if so
    const existingIndex = this.queue.findIndex(item => item.taskId === taskId)
    if (existingIndex >= 0) {
      this.queue[existingIndex].updates = { ...this.queue[existingIndex].updates, ...updates }
      this.queue[existingIndex].timestamp = Date.now()
    } else {
      this.queue.push({
        taskId,
        updates,
        timestamp: Date.now(),
        retryCount: 0
      })
    }

    // Start processing if not already
    if (!this.processing) {
      this.process()
    }
  }

  // Process the queue
  private async process() {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true
    console.log('[TaskSyncQueue] Processing queue, items:', this.queue.length)

    while (this.queue.length > 0) {
      const item = this.queue[0]

      try {
        console.log('[TaskSyncQueue] Syncing task:', item.taskId)
        const result = await omnifocusBridge.updateTask(item.taskId, item.updates)

        if (result.success) {
          console.log('[TaskSyncQueue] ✅ Task synced successfully:', item.taskId)
          this.queue.shift() // Remove on success
          
          // Remove from failed items if it was there
          this.failedItems = this.failedItems.filter(f => f.taskId !== item.taskId)
          this.notifyListeners()
        } else {
          throw new Error(result.error || 'Unknown error')
        }
      } catch (error) {
        console.error('[TaskSyncQueue] ❌ Failed to sync task:', item.taskId, error)
        
        item.retryCount++
        
        if (item.retryCount >= this.maxRetries) {
          // Max retries reached, move to failed items
          console.error('[TaskSyncQueue] Max retries reached for task:', item.taskId)
          this.failedItems.push(this.queue.shift()!)
          this.notifyListeners()
        } else {
          // Wait a bit before retrying
          console.log('[TaskSyncQueue] Will retry task:', item.taskId, `(attempt ${item.retryCount}/${this.maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, 1000 * item.retryCount))
        }
      }
    }

    this.processing = false
    console.log('[TaskSyncQueue] Queue processing complete')
  }

  // Retry failed items
  async retryFailed() {
    console.log('[TaskSyncQueue] Retrying failed items:', this.failedItems.length)
    
    // Move failed items back to queue with reset retry count
    this.failedItems.forEach(item => {
      item.retryCount = 0
      this.queue.push(item)
    })
    this.failedItems = []
    this.notifyListeners()

    // Start processing
    if (!this.processing) {
      this.process()
    }
  }

  // Get failed items count
  getFailedCount(): number {
    return this.failedItems.length
  }

  // Get pending items count
  getPendingCount(): number {
    return this.queue.length
  }

  // Subscribe to changes
  onChange(callback: () => void) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener())
  }
}

// Export singleton instance
export const taskSyncQueue = new TaskSyncQueue()


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
    console.log('[TaskSyncQueue] Adding task to sync queue:', taskId, updates)
    
    // Check if task is already in queue
    const existingIndex = this.queue.findIndex(item => item.taskId === taskId)
    if (existingIndex >= 0) {
      const existing = this.queue[existingIndex]
      const merged = { ...existing.updates, ...updates }
      
      // OmniFocus 4 constraint: Cannot update completion AND other properties in same operation
      // If merge would combine both, split into separate operations
      const hasCompletion = merged.completed !== undefined
      const hasOtherProps = Object.keys(merged).some(key => 
        key !== 'completed' && key !== 'completedDate'
      )
      
      if (hasCompletion && hasOtherProps) {
        console.log('[TaskSyncQueue] ⚠️ Split required: completion + property updates detected')
        
        // Split the merged updates into two separate operations
        // First operation: only completion state
        const completionOnly: Partial<TaskDTO> = { completed: merged.completed }
        if (merged.completedDate !== undefined) {
          completionOnly.completedDate = merged.completedDate
        }
        
        // Second operation: all other properties (excluding completion)
        const { completed, completedDate, ...otherProps } = merged
        
        // Update existing item to only have completion
        this.queue[existingIndex].updates = completionOnly
        this.queue[existingIndex].timestamp = Date.now()
        
        // Add new item for other properties (will be processed after completion)
        this.queue.push({
          taskId,
          updates: otherProps,
          timestamp: Date.now(),
          retryCount: 0
        })
      } else {
        // Safe to merge - either only completion or only properties
        this.queue[existingIndex].updates = merged
        this.queue[existingIndex].timestamp = Date.now()
      }
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
        console.log('[TaskSyncQueue] Task updates:', JSON.stringify(item.updates))
        
        // Filter out read-only properties for OmniFocus 4
        // completedDate is set automatically by markComplete()
        const { completedDate, ...syncUpdates } = item.updates
        if (completedDate !== undefined) {
          console.log('[TaskSyncQueue] Filtered out completedDate (read-only in OmniFocus 4)')
        }
        
        console.log('[TaskSyncQueue] After filtering completedDate:', JSON.stringify(syncUpdates))

        // Tags are handled by the plugin bridge with fuzzy matching, no validation needed here
        // Just ensure tags is an array if present
        if (syncUpdates.tags !== undefined) {
          if (!Array.isArray(syncUpdates.tags)) {
            console.warn('[TaskSyncQueue] Tags must be an array, converting...')
            syncUpdates.tags = []
          }
        }
        
        // Additional safety check: detect if we're trying to sync both completion and properties
        // This shouldn't happen with the fixed add() method, but protects against items
        // that were already in the queue before the fix
        const hasCompletion = syncUpdates.completed !== undefined
        const hasOtherProps = Object.keys(syncUpdates).some(key => key !== 'completed')
        
        console.log('[TaskSyncQueue] hasCompletion:', hasCompletion, 'hasOtherProps:', hasOtherProps)
        
        if (hasCompletion && hasOtherProps) {
          console.log('[TaskSyncQueue] ⚠️ Detected invalid merged update during processing, splitting...')
          
          // Split this item: keep only completion in current item
          const completionOnly = { completed: syncUpdates.completed }
          const { completed, ...otherProps } = syncUpdates
          
          // Update current item to only have completion
          item.updates = completionOnly
          
          // Add other properties as next queue item (insert at position 1, not at end)
          this.queue.splice(1, 0, {
            taskId: item.taskId,
            updates: otherProps,
            timestamp: Date.now(),
            retryCount: 0
          })
          
          console.log('[TaskSyncQueue] Split complete. Processing completion first, then properties.')
          
          // Now process the completion-only update
          const result = await omnifocusBridge.updateTask(item.taskId, completionOnly)
          
          if (result.success) {
            console.log('[TaskSyncQueue] ✅ Completion synced, will process properties next')
            this.queue.shift() // Remove completion item, properties item is now first
            this.notifyListeners()
            continue // Move to next item (the properties)
          } else {
            throw new Error(result.error || 'Unknown error')
          }
        }
        
        const result = await omnifocusBridge.updateTask(item.taskId, syncUpdates)

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

  // Clear all failed items
  clearFailed() {
    console.log('[TaskSyncQueue] Clearing all failed items:', this.failedItems.length)
    this.failedItems = []
    this.notifyListeners()
  }

  // Clear all pending items (use with caution)
  clearAll() {
    console.log('[TaskSyncQueue] Clearing all queue items')
    this.queue = []
    this.failedItems = []
    this.notifyListeners()
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


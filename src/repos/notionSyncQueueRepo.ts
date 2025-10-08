// repos/notionSyncQueueRepo.ts
import { db } from '../db'
import type { NotionSyncQueueItem } from '../types'

/**
 * Add a sync item to the queue
 */
export async function addToQueue(
  projectId: string,
  weekOf: string
): Promise<NotionSyncQueueItem> {
  const item: NotionSyncQueueItem = {
    id: crypto.randomUUID(),
    projectId,
    weekOf,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending'
  }
  
  await db.notionSyncQueue.add(item)
  console.log(`📝 Added to Notion sync queue: ${projectId}, week ${weekOf}`)
  return item
}

/**
 * Get all pending/retrying items that are ready to be processed
 */
export async function getQueuedItems(): Promise<NotionSyncQueueItem[]> {
  const now = new Date().toISOString()
  
  return await db.notionSyncQueue
    .where('status')
    .anyOf('pending', 'retrying')
    .filter(item => {
      // Include pending items (no nextRetry set)
      if (!item.nextRetry) return true
      // Include retrying items if nextRetry time has passed
      return item.nextRetry <= now
    })
    .toArray()
}

/**
 * Mark a sync as completed and remove from queue
 */
export async function markCompleted(id: string): Promise<void> {
  await db.notionSyncQueue.update(id, {
    status: 'completed'
  })
  // Optionally delete completed items to keep queue clean
  await db.notionSyncQueue.delete(id)
  console.log(`✅ Marked sync as completed and removed from queue: ${id}`)
}

/**
 * Mark a sync as failed and schedule retry with exponential backoff
 * @param maxAttempts - Maximum number of retry attempts (default: 5)
 */
export async function markFailed(
  id: string,
  errorMessage: string,
  maxAttempts: number = 5
): Promise<void> {
  const item = await db.notionSyncQueue.get(id)
  
  if (!item) {
    console.error(`Queue item not found: ${id}`)
    return
  }
  
  const newAttempts = item.attempts + 1
  
  // Calculate exponential backoff: 2^attempts minutes
  // 1st retry: 2 min, 2nd: 4 min, 3rd: 8 min, 4th: 16 min, 5th: 32 min
  const backoffMinutes = Math.pow(2, newAttempts)
  const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString()
  
  // If max attempts reached, mark as permanently failed
  const status = newAttempts >= maxAttempts ? 'failed' : 'retrying'
  
  await db.notionSyncQueue.update(id, {
    attempts: newAttempts,
    lastAttempt: new Date().toISOString(),
    nextRetry,
    status,
    errorMessage
  })
  
  if (status === 'failed') {
    console.error(`❌ Sync permanently failed after ${newAttempts} attempts: ${id}`)
  } else {
    console.log(`⏰ Scheduled retry ${newAttempts}/${maxAttempts} in ${backoffMinutes} min: ${id}`)
  }
}

/**
 * Get count of items by status
 */
export async function getQueueStats(): Promise<{
  pending: number
  retrying: number
  failed: number
}> {
  const [pending, retrying, failed] = await Promise.all([
    db.notionSyncQueue.where('status').equals('pending').count(),
    db.notionSyncQueue.where('status').equals('retrying').count(),
    db.notionSyncQueue.where('status').equals('failed').count()
  ])
  
  return { pending, retrying, failed }
}

/**
 * Clear all failed items (for manual cleanup)
 */
export async function clearFailed(): Promise<number> {
  const failedItems = await db.notionSyncQueue
    .where('status')
    .equals('failed')
    .toArray()
  
  for (const item of failedItems) {
    await db.notionSyncQueue.delete(item.id)
  }
  
  console.log(`🧹 Cleared ${failedItems.length} failed sync items`)
  return failedItems.length
}

/**
 * Process the sync queue (called periodically)
 * Returns number of items successfully processed
 */
export async function processQueue(
  syncFunction: (projectId: string, weekOf: string) => Promise<boolean>
): Promise<{ processed: number; failed: number }> {
  const items = await getQueuedItems()
  
  if (items.length === 0) {
    return { processed: 0, failed: 0 }
  }
  
  console.log(`🔄 Processing ${items.length} queued Notion sync items...`)
  
  let processed = 0
  let failed = 0
  
  for (const item of items) {
    try {
      const success = await syncFunction(item.projectId, item.weekOf)
      
      if (success) {
        await markCompleted(item.id)
        processed++
      } else {
        await markFailed(item.id, 'Sync returned false')
        failed++
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      await markFailed(item.id, errorMsg)
      failed++
    }
  }
  
  console.log(`✅ Queue processing complete: ${processed} processed, ${failed} failed`)
  return { processed, failed }
}


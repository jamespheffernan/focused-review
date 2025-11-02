// Tasks Repository
// Handles CRUD operations for tasks in the local database

import { db } from '../db'
import type { TaskDTO, SyncState } from '../types'
import { omnifocusBridge } from '../services/omnifocus-bridge'

/**
 * Fetch all tasks for a specific project
 */
export async function fetchTasksForProject(projectId: string): Promise<TaskDTO[]> {
  try {
    console.log(`Fetching tasks for project ID: ${projectId}`)
    const tasks = await db.tasks
      .where('projectId')
      .equals(projectId)
      .toArray()
    
    console.log(`Found ${tasks.length} tasks for project ${projectId}:`, tasks)
    return tasks
  } catch (error) {
    console.error('Error fetching tasks for project:', error)
    throw new Error('Failed to fetch tasks for project')
  }
}

/**
 * Fetch all tasks across all projects
 */
export async function fetchAllTasks(): Promise<TaskDTO[]> {
  try {
    const tasks = await db.tasks.toArray()
    console.log(`Total tasks in database: ${tasks.length}`)
    if (tasks.length > 0) {
      console.log('Sample tasks:', tasks.slice(0, 3))
    }
    return tasks
  } catch (error) {
    console.error('Error fetching all tasks:', error)
    throw new Error('Failed to fetch all tasks')
  }
}

/**
 * Fetch tasks by status
 */
export async function fetchTasksByStatus(status: string): Promise<TaskDTO[]> {
  try {
    const tasks = await db.tasks
      .where('status')
      .equals(status)
      .toArray()
    
    return tasks
  } catch (error) {
    console.error('Error fetching tasks by status:', error)
    throw new Error('Failed to fetch tasks by status')
  }
}

/**
 * Fetch next actions (tasks with status 'next')
 */
export async function fetchNextActions(): Promise<TaskDTO[]> {
  return fetchTasksByStatus('next')
}

/**
 * Fetch available tasks (tasks with status 'available')
 */
export async function fetchAvailableTasks(): Promise<TaskDTO[]> {
  return fetchTasksByStatus('available')
}

/**
 * Fetch completed tasks
 */
export async function fetchCompletedTasks(): Promise<TaskDTO[]> {
  return fetchTasksByStatus('completed')
}

/**
 * Create a new task
 */
export async function createTask(projectId: string, task: Omit<TaskDTO, 'id' | 'lastModified' | 'syncState'>): Promise<TaskDTO> {
  try {
    const newTask: TaskDTO = {
      ...task,
      projectId, // Ensure projectId is set
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lastModified: new Date().toISOString(),
      syncState: 'queued' as SyncState
    }
    
    await db.tasks.add(newTask)
    console.log('Task created locally:', newTask)
    
    // Trigger background sync to OmniFocus
    syncTaskToOmniFocus(newTask).catch(error => {
      console.error('Background sync failed:', error)
      // Update sync state to error but don't throw - task is created locally
      updateTaskSyncState(newTask.id, 'error').catch(console.error)
    })
    
    return newTask
  } catch (error) {
    console.error('Error creating task:', error)
    throw new Error('Failed to create task')
  }
}

/**
 * Update an existing task
 */
export async function updateTask(taskId: string, updates: Partial<TaskDTO>): Promise<void> {
  try {
    const updateData = {
      ...updates,
      lastModified: new Date().toISOString(),
      syncState: 'queued' as SyncState
    }
    
    await db.tasks.update(taskId, updateData)
  } catch (error) {
    console.error('Error updating task:', error)
    throw new Error('Failed to update task')
  }
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  try {
    await db.tasks.delete(taskId)
  } catch (error) {
    console.error('Error deleting task:', error)
    throw new Error('Failed to delete task')
  }
}

/**
 * Mark a task as completed
 */
export async function completeTask(taskId: string): Promise<void> {
  try {
    const now = new Date().toISOString()
    await db.tasks.update(taskId, {
      status: 'completed',
      completed: true,
      completedDate: now,
      lastModified: now,
      syncState: 'queued' as SyncState
    })
  } catch (error) {
    console.error('Error completing task:', error)
    throw new Error('Failed to complete task')
  }
}

/**
 * Mark a task as available
 */
export async function makeTaskAvailable(taskId: string): Promise<void> {
  try {
    const now = new Date().toISOString()
    await db.tasks.update(taskId, {
      status: 'available',
      completed: false,
      completedDate: undefined,
      lastModified: now,
      syncState: 'queued' as SyncState
    })
  } catch (error) {
    console.error('Error making task available:', error)
    throw new Error('Failed to make task available')
  }
}

/**
 * Set task as next action
 */
export async function setAsNextAction(taskId: string): Promise<void> {
  try {
    const now = new Date().toISOString()
    await db.tasks.update(taskId, {
      status: 'next',
      lastModified: now,
      syncState: 'queued' as SyncState
    })
  } catch (error) {
    console.error('Error setting task as next action:', error)
    throw new Error('Failed to set task as next action')
  }
}

/**
 * Update task sync state
 */
export async function updateTaskSyncState(taskId: string, syncState: SyncState): Promise<void> {
  try {
    await db.tasks.update(taskId, {
      syncState,
      lastModified: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error updating task sync state:', error)
    throw new Error('Failed to update task sync state')
  }
}

/**
 * Import tasks from OmniFocus
 */
export async function importTasksFromOmniFocus(projectId: string, tasks: Omit<TaskDTO, 'id' | 'lastModified' | 'syncState'>[]): Promise<TaskDTO[]> {
  try {
    // Clear existing tasks for this project (only if projectId is provided)
    if (projectId) {
      await db.tasks.where('projectId').equals(projectId).delete()
    }
    
    // Add new tasks
    const newTasks: TaskDTO[] = tasks.map(task => ({
      ...task,
      id: `of_${task.projectId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lastModified: new Date().toISOString(),
      syncState: 'synced' as SyncState
    }))
    
    await db.tasks.bulkAdd(newTasks)
    return newTasks
  } catch (error) {
    console.error('Error importing tasks from OmniFocus:', error)
    throw new Error('Failed to import tasks from OmniFocus')
  }
}

/**
 * Get tasks that need syncing
 */
export async function getTasksNeedingSync(): Promise<TaskDTO[]> {
  try {
    const tasks = await db.tasks
      .where('syncState')
      .anyOf(['queued', 'retrying', 'error'])
      .toArray()
    
    return tasks
  } catch (error) {
    console.error('Error fetching tasks needing sync:', error)
    throw new Error('Failed to fetch tasks needing sync')
  }
}

/**
 * Clear all tasks for a project
 */
export async function clearTasksForProject(projectId: string): Promise<void> {
  try {
    await db.tasks.where('projectId').equals(projectId).delete()
  } catch (error) {
    console.error('Error clearing tasks for project:', error)
    throw new Error('Failed to clear tasks for project')
  }
}

/**
 * Get task statistics for a single project
 */
export async function getTaskStatistics(projectId?: string): Promise<{
  total: number
  next: number
  available: number
  blocked: number
  completed: number
}> {
  try {
    let tasks: TaskDTO[]
    if (projectId) {
      tasks = await db.tasks.where('projectId').equals(projectId).toArray()
    } else {
      tasks = await db.tasks.toArray()
    }
    
    return {
      total: tasks.length,
      next: tasks.filter(t => t.status === 'next').length,
      available: tasks.filter(t => t.status === 'available').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      completed: tasks.filter(t => t.status === 'completed').length
    }
  } catch (error) {
    console.error('Error getting task statistics:', error)
    throw new Error('Failed to get task statistics')
  }
}

/**
 * Get task statistics for multiple projects in a single batch query
 * This is much more efficient than calling getTaskStatistics() in a loop
 * 
 * @param projectIds - Array of project IDs to get statistics for
 * @returns Record mapping project IDs to their task statistics
 */
export async function getTaskStatisticsBatch(projectIds: string[]): Promise<Record<string, {
  total: number
  next: number
  available: number
  blocked: number
  completed: number
}>> {
  try {
    console.time('getTaskStatisticsBatch')
    
    // Single batch query to load all tasks for all projects at once
    const allTasks = await db.tasks
      .where('projectId')
      .anyOf(projectIds)
      .toArray()
    
    console.log(`Batch query loaded ${allTasks.length} tasks for ${projectIds.length} projects`)
    
    // Group tasks by projectId and calculate statistics in memory
    const stats: Record<string, {
      total: number
      next: number
      available: number
      blocked: number
      completed: number
    }> = {}
    
    // Initialize stats for all projects (including those with no tasks)
    projectIds.forEach(id => {
      stats[id] = {
        total: 0,
        next: 0,
        available: 0,
        blocked: 0,
        completed: 0
      }
    })
    
    // Group tasks by projectId and count by status
    allTasks.forEach(task => {
      const projectStats = stats[task.projectId]
      if (projectStats) {
        projectStats.total++
        
        switch (task.status) {
          case 'next':
            projectStats.next++
            break
          case 'available':
            projectStats.available++
            break
          case 'blocked':
            projectStats.blocked++
            break
          case 'completed':
            projectStats.completed++
            break
        }
      }
    })
    
    console.timeEnd('getTaskStatisticsBatch')
    return stats
  } catch (error) {
    console.error('Error getting batch task statistics:', error)
    throw new Error('Failed to get batch task statistics')
  }
}

/**
 * Sync a task to OmniFocus
 * This function handles the full sync workflow including retries
 */
async function syncTaskToOmniFocus(task: TaskDTO): Promise<void> {
  try {
    console.log(`Syncing task to OmniFocus: ${task.name}`)
    
    // Update sync state to 'retrying'
    await updateTaskSyncState(task.id, 'retrying')
    
    // Step 1: Create the task in OmniFocus
    const createResult = await omnifocusBridge.createTask(task.projectId, task.name)
    
    if (!createResult.success || !createResult.taskId) {
      throw new Error(createResult.error || 'Failed to create task in OmniFocus')
    }
    
    const omniFocusTaskId = createResult.taskId
    console.log(`Task created in OmniFocus with ID: ${omniFocusTaskId}`)
    
    // Step 2: Set additional properties if they exist
    if (task.context) {
      const contextResult = await omnifocusBridge.setTaskContext(omniFocusTaskId, task.context)
      if (!contextResult.success) {
        console.warn(`Failed to set context: ${contextResult.error}`)
      }
    }
    
    if (task.dueDate) {
      const dueDateResult = await omnifocusBridge.setTaskDueDate(omniFocusTaskId, task.dueDate)
      if (!dueDateResult.success) {
        console.warn(`Failed to set due date: ${dueDateResult.error}`)
      }
    }
    
    if (task.note) {
      const updateResult = await omnifocusBridge.updateTask(omniFocusTaskId, { note: task.note })
      if (!updateResult.success) {
        console.warn(`Failed to set note: ${updateResult.error}`)
      }
    }
    
    // Step 3: Update local task with OmniFocus ID and mark as synced
    await db.tasks.update(task.id, {
      id: omniFocusTaskId, // Replace local ID with OmniFocus ID
      syncState: 'synced' as SyncState,
      lastModified: new Date().toISOString()
    })
    
    console.log('Task synced successfully to OmniFocus')
  } catch (error) {
    console.error('Error syncing task to OmniFocus:', error)
    // Sync state already updated to 'error' by caller
    throw error
  }
}

/**
 * Retry syncing all tasks that are in error or queued state
 */
export async function retrySyncTasks(): Promise<{success: number; failed: number}> {
  try {
    const tasksToSync = await getTasksNeedingSync()
    console.log(`Found ${tasksToSync.length} tasks to sync`)
    
    let success = 0
    let failed = 0
    
    for (const task of tasksToSync) {
      try {
        await syncTaskToOmniFocus(task)
        success++
      } catch {
        failed++
        await updateTaskSyncState(task.id, 'error')
      }
    }
    
    return { success, failed }
  } catch (error) {
    console.error('Error retrying sync:', error)
    throw new Error('Failed to retry sync')
  }
}

// repos/projectsRepo.ts
import { db } from '../db'
import type { ProjectDTO, ProjectStatus, TaskDTO, SyncState } from '../types'
import { omnifocusService } from '../services/omnifocus'
import { syncManager } from '../services/syncManager'

// Guard to prevent concurrent syncs
let isSyncing = false

/**
 * Load projects from local cache (IndexedDB) - FAST
 * Does NOT sync from OmniFocus
 */
export async function loadQueueFromCache(): Promise<ProjectDTO[]> {
  try {
    console.time('loadQueueFromCache')
    
    // Load active projects from IndexedDB
    const allProjects = await db.projects
      .where('status')
      .notEqual('dropped')
      .toArray()
    
    console.log(`Loaded ${allProjects.length} active projects from cache`)
    
    // Filter to only projects due or overdue for review
    const now = new Date()
    const dueProjects = allProjects.filter(project => {
      // If project has no nextReviewDate, exclude it from review queue
      // (projects without review schedules aren't tracked for review)
      if (!project.nextReviewDate) {
        return false
      }
      
      const nextReview = new Date(project.nextReviewDate)
      return nextReview <= now
    })
    
    // Sort by most overdue first (earliest nextReviewDate first)
    dueProjects.sort((a, b) => {
      const dateA = new Date(a.nextReviewDate!).getTime()
      const dateB = new Date(b.nextReviewDate!).getTime()
      return dateA - dateB
    })
    
    console.log(`Filtered to ${dueProjects.length} projects due for review`)
    console.log(`Most overdue: ${dueProjects[0]?.name} (due ${dueProjects[0]?.nextReviewDate})`)
    console.timeEnd('loadQueueFromCache')
    
    return dueProjects
  } catch (error) {
    console.error('Error loading queue from cache:', error)
    return []
  }
}

/**
 * Sync projects and tasks from OmniFocus - SLOW but FRESH
 * Clears local database and imports fresh data from OmniFocus
 */
export async function syncFromOmniFocus(): Promise<ProjectDTO[]> {
  // Prevent concurrent syncs
  if (isSyncing) {
    console.warn('⚠️ Sync already in progress - skipping duplicate sync request')
    return loadQueueFromCache() // Return cached data while sync is happening
  }
  
  isSyncing = true
  console.log('🔒 Sync lock acquired')
  
  try {
    console.time('syncFromOmniFocus')
    console.log('🔄 Syncing from OmniFocus...')
    
    // Get projects from OmniFocus
    const omnifocusProjects = await omnifocusService.getProjectsDueForReview()
    console.log(`📦 Received ${omnifocusProjects.length} projects from OmniFocus`)
    console.log('📦 Sample project:', omnifocusProjects[0])
    
    if (omnifocusProjects.length > 0) {
      console.log('✅ Projects count > 0, starting import...')
      try {
        // NOTE: Skip clear() - it can hang/deadlock in Electron
        // bulkPut will overwrite existing data by ID anyway
        console.log('📝 Preparing to import (will overwrite existing data)...')
        
        // Check if projects have task data
        const hasTaskData = omnifocusProjects.some(p => p.tasks && Array.isArray(p.tasks))
        console.log(`Has task data: ${hasTaskData}`)
        
        if (hasTaskData) {
          // Use the function that handles both projects and tasks
          console.log('Importing projects with tasks...')
          await importOmniFocusProjectsWithTasks(omnifocusProjects)
          console.log('✅ Import completed')
        } else {
          // Import projects only
          console.log('Importing projects only (no tasks)...')
          const activeProjects = omnifocusProjects.filter(p => p.status !== 'dropped')
          const projects: ProjectDTO[] = activeProjects.map(p => ({
            id: p.id,
            name: p.name,
            status: p.status,
            deferDate: p.deferDate,
            dueDate: p.dueDate,
            reviewIntervalDays: p.reviewIntervalDays,
            tags: p.tags,
            lastReviewed: p.lastReviewed,
            notes: p.notes || undefined  // Project notes (first line may contain Notion deep link)
          }))
          
          await db.projects.bulkPut(projects)
          console.log(`✅ Imported ${projects.length} projects`)
        }
        
        console.log('✅ Import completed successfully')
        
        // Update last sync timestamp ONLY after successful import
        syncManager.setLastSyncTimestamp()
        console.log('✅ Sync complete - timestamp updated')
        console.timeEnd('syncFromOmniFocus')
        
        // Return projects from cache
        const cachedProjects = await loadQueueFromCache()
        console.log(`📊 Returning ${cachedProjects.length} projects from cache`)
        return cachedProjects
      } catch (importError) {
        console.error('❌ Import failed:', importError)
        console.error('Import error details:', importError)
        throw importError
      }
    } else {
      console.warn('⚠️ No active projects found in OmniFocus')
      console.timeEnd('syncFromOmniFocus')
      
      // Don't set timestamp if no projects found
      return []
    }
  } catch (error) {
    console.error('❌ Error syncing from OmniFocus:', error)
    console.error('Error type:', error?.constructor?.name)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.timeEnd('syncFromOmniFocus')
    
    // Don't set timestamp on error - force retry next time
    return []
  } finally {
    // Always release the lock
    isSyncing = false
    console.log('🔓 Sync lock released')
  }
}

/**
 * Smart fetch: Load from cache if available, otherwise sync from OmniFocus
 * This is the main entry point for loading projects
 */
export async function fetchDueForReview(): Promise<ProjectDTO[]> {
  try {
    // Check if we have cached data
    const hasCachedData = syncManager.hasCachedData()
    
    if (!hasCachedData) {
      // No cache - must sync from OmniFocus
      console.log('No cached data - syncing from OmniFocus')
      return await syncFromOmniFocus()
    }
    
    // We have cached data - load it
    console.log(`Loading from cache (last sync: ${syncManager.getTimeSinceLastSync()})`)
    return await loadQueueFromCache()
  } catch (error) {
    console.error('Error fetching projects:', error)
    return []
  }
}

export async function markReviewed(projectID: string, dateISO: string) {
  const p = await db.projects.get(projectID)
  if (!p) return
  
  // Update local database
  p.lastReviewed = dateISO
  await db.projects.put(p)
  
  // Update OmniFocus if available
  try {
    const success = await omnifocusService.markProjectReviewed(projectID)
    if (success) {
      console.log(`✅ Project ${projectID} marked as reviewed in OmniFocus`)
    } else {
      console.warn(`⚠️ Failed to mark project ${projectID} as reviewed in OmniFocus`)
    }
  } catch (error) {
    console.error('Error updating OmniFocus:', error)
    // Continue anyway - local update succeeded
  }
}

export async function updateMetadata(projectID: string, patch: Partial<{status:ProjectStatus; deferDate:string; dueDate:string; tags:string[]; reviewIntervalDays:number;}>) {
  const p = await db.projects.get(projectID)
  if (!p) return
  
  // Update local database
  await db.projects.put({ ...p, ...patch })
  
  // Update OmniFocus if available
  try {
    await omnifocusService.updateProjectMetadata(projectID, patch)
  } catch (error) {
    console.error('Error updating OmniFocus:', error)
    // Continue anyway - local update succeeded
  }
}

export async function importOmniFocusProjects(projects: ProjectDTO[]) {
  try {
    // Use a transaction to ensure atomicity
    await db.transaction('rw', db.projects, async () => {
      // Clear existing projects
      await db.projects.clear()
      
      // Add new projects using bulkPut instead of bulkAdd to handle duplicates
      await db.projects.bulkPut(projects)
    })
    
    console.log(`Successfully imported ${projects.length} projects from OmniFocus`)
  } catch (error) {
    console.error('Error importing OmniFocus projects:', error)
    
    // Fallback: try adding them one by one with put (which handles duplicates)
    console.log('Falling back to individual project import...')
    let successCount = 0
    for (const project of projects) {
      try {
        await db.projects.put(project)
        successCount++
      } catch (putError) {
        console.error('Error adding project:', project.name, putError)
      }
    }
    console.log(`Fallback import completed: ${successCount}/${projects.length} projects imported`)
  }
}

/**
 * Import projects with their tasks from OmniFocus
 * NOTE: Does NOT clear database - caller should handle that
 */
export async function importOmniFocusProjectsWithTasks(projects: any[]) {
  try {
    console.log(`=== IMPORT STARTED: ${projects.length} projects ===`)
    
    // Log the first project to see its structure
    if (projects.length > 0) {
      console.log('Sample project structure:', {
        id: projects[0].id,
        name: projects[0].name,
        hasTasks: !!projects[0].tasks,
        taskCount: projects[0].tasks?.length || 0
      })
    }
    
    // Process each project and its tasks
    const projectDTOs: ProjectDTO[] = []
    const allTasks: any[] = []
    
    for (const project of projects) {
      // Convert to ProjectDTO
      const projectDTO: ProjectDTO = {
        id: project.id,
        name: project.name,
        status: project.status || 'active', // Ensure status is always set
        deferDate: project.deferDate || null,
        dueDate: project.dueDate || null,
        reviewIntervalDays: project.reviewIntervalDays || 7,
        tags: project.tags || [],
        lastReviewed: project.lastReviewed || null,
        nextReviewDate: project.nextReviewDate || null,
        notes: project.notes || undefined  // Project notes (first line may contain Notion deep link)
      }
      projectDTOs.push(projectDTO)
      
      // Process tasks for this project
      if (project.tasks && Array.isArray(project.tasks)) {
        console.log(`Processing ${project.tasks.length} tasks for project: ${project.name}`)
        for (const task of project.tasks) {
          // Validate task has required fields
          if (!task.id || !task.name) {
            console.warn(`Skipping invalid task: ${JSON.stringify(task)}`)
            continue
          }
          
          allTasks.push({
            id: task.id,
            projectId: project.id,
            name: task.name,
            status: task.status || 'available',
            dueDate: task.dueDate || null,
            context: task.context || null,
            flagged: task.flagged || false,
            note: task.note || '',
            completed: task.completed || false,
            completedDate: task.completedDate || null
          })
        }
      } else {
        console.log(`No tasks found for project: ${project.name} (tasks: ${typeof project.tasks})`)
      }
    }
    
    console.log(`📝 Prepared ${projectDTOs.length} projects and ${allTasks.length} tasks`)
    console.log('📝 Sample project DTO:', projectDTOs[0])
    
    // Add projects
    console.log('💾 Starting bulkPut for projects...')
    try {
      await db.projects.bulkPut(projectDTOs)
      console.log(`✅ Added ${projectDTOs.length} projects to database`)
    } catch (projectError) {
      console.error('❌ Error in projects bulkPut:', projectError)
      throw projectError
    }
    
    // Add tasks
    console.log(`📊 Total tasks to import: ${allTasks.length}`)
    if (allTasks.length > 0) {
      // Add new tasks
      const newTasks: TaskDTO[] = allTasks.map(task => ({
        ...task,
        lastModified: new Date().toISOString(),
        syncState: 'synced' as SyncState
      }))
      
      console.log(`💾 Attempting to add ${newTasks.length} tasks to database...`)
      console.log('💾 Sample task:', newTasks[0])
      
      // Use bulkPut instead of bulkAdd to handle potential duplicates
      try {
        await db.tasks.bulkPut(newTasks)
        console.log(`✅ Successfully imported ${newTasks.length} tasks from OmniFocus`)
      } catch (taskError) {
        console.error('❌ Error in tasks bulkPut:', taskError)
        throw taskError
      }
      
      // Verify the tasks were actually added
      const verifyTasks = await db.tasks.toArray()
      console.log(`✅ Database now contains ${verifyTasks.length} total tasks`)
      
      if (verifyTasks.length === 0) {
        console.error('❌ WARNING: Tasks were not saved to database!')
      }
    } else {
      console.warn('⚠️ No tasks to import! Check if projects have tasks attached.')
    }
    
    console.log(`=== IMPORT COMPLETED: ${projects.length} projects ===`)
  } catch (error) {
    console.error('Error importing OmniFocus projects with tasks:', error)
    throw error
  }
}

export function getOmniFocusIntegrationStatus() {
  return omnifocusService.getIntegrationStatus()
}

export async function clearAllProjects() {
  await db.projects.clear()
}


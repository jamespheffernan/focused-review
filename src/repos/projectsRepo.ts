// repos/projectsRepo.ts
import { db } from '../db'
import type { ProjectDTO, ProjectStatus, TaskDTO, SyncState } from '../types'
import { omnifocusService } from '../services/omnifocus'
import { syncManager } from '../services/syncManager'
import type { OmniFocusBridgeProject } from '../services/omnifocus-bridge'

// Guard to prevent concurrent syncs
let isSyncing = false
let syncPromise: Promise<ProjectDTO[]> | null = null
let isImporting = false  // Flag to prevent reads during import

/**
 * Load projects from local cache (IndexedDB) - FAST
 * Does NOT sync from OmniFocus
 */
export async function loadQueueFromCache(): Promise<ProjectDTO[]> {
  // Don't try to read during import - it will cause a deadlock
  if (isImporting) {
    console.log('⏸️  Load queue skipped - import in progress')
    return []
  }
  
  try {
    console.time('loadQueueFromCache')
    
    // Load active projects from IndexedDB
    const allProjects = await db.projects
      .where('status')
      .notEqual('dropped')
      .toArray()
    
    console.log(`📦 Loaded ${allProjects.length} active projects from cache`)
    
    // Debug: Log ALL projects to see what data we have
    console.log('📊 All projects from cache:')
    allProjects.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.name}:`, {
        nextReviewDate: p.nextReviewDate,
        lastReviewed: p.lastReviewed,
        reviewIntervalDays: p.reviewIntervalDays,
        status: p.status
      })
    })
    
    // Filter to only projects due or overdue for review
    const now = new Date()
    console.log(`🔍 Current time: ${now.toISOString()}`)
    console.log(`🔍 Filtering projects due for review...`)
    
    const dueProjects = allProjects.filter(project => {
      // If project has no nextReviewDate, exclude it from review queue
      // (projects without review schedules aren't tracked for review)
      if (!project.nextReviewDate) {
        console.log(`  ❌ "${project.name}" - NO nextReviewDate (excluding)`)
        return false
      }
      
      const nextReview = new Date(project.nextReviewDate)
      const isDue = nextReview <= now
      const daysUntilDue = Math.round((nextReview.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (isDue) {
        console.log(`  ✅ "${project.name}" - DUE (${Math.abs(daysUntilDue)} days overdue)`)
      } else {
        console.log(`  ⏭️  "${project.name}" - not due yet (${daysUntilDue} days remaining)`)
      }
      
      return isDue
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
  console.log('🚀 ==================== SYNC FROM OMNIFOCUS CALLED ====================')
  console.log('🚀 Call stack:', new Error().stack)
  
  // Prevent concurrent syncs - if sync is in progress, wait for it to complete
  if (isSyncing && syncPromise) {
    console.warn('⚠️ ⚠️ ⚠️ Sync already in progress - WAITING for it to complete ⚠️ ⚠️ ⚠️')
    console.warn('⚠️ This indicates a duplicate sync call - will return results from in-progress sync')
    return syncPromise // Wait for the in-progress sync to complete
  }
  
  isSyncing = true
  console.log('🔒 Sync lock acquired')
  
  // Create the sync promise so other callers can wait for it
  syncPromise = (async () => {
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
        // NOTE: We don't clear the database first - bulkPut will update existing projects
        // and add new ones. This prevents data loss if the sync is interrupted.
        console.log('📝 Preparing to import/update projects...')
        
        // Set import flag to prevent concurrent reads
        isImporting = true
        console.log('🔒 Import lock acquired - preventing concurrent reads')
        
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
        
        // Release import lock
        isImporting = false
        console.log('🔓 Import lock released')
        
        // Update last sync timestamp ONLY after successful import
        syncManager.setLastSyncTimestamp()
        console.log('✅ Sync complete - timestamp updated')
        console.timeEnd('syncFromOmniFocus')
        
        // Return projects from cache
        console.log('📊 Loading projects from cache...')
        const cachedProjects = await loadQueueFromCache()
        console.log(`📊 Returning ${cachedProjects.length} projects from cache`)
        console.log('📊 Sample cached project:', cachedProjects[0])
        return cachedProjects
      } catch (importError) {
        // Release import lock on error
        isImporting = false
        console.log('🔓 Import lock released (error path)')
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
      // Always release the lock and clear the promise
      isSyncing = false
      syncPromise = null
      console.log('🔓 Sync lock released')
    }
  })()
  
  return syncPromise
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
export async function importOmniFocusProjectsWithTasks(projects: OmniFocusBridgeProject[]) {
  try {
    console.log(`=== IMPORT STARTED: ${projects.length} projects ===`)
    
    // Log the first project to see its structure
    if (projects.length > 0) {
      console.log('Sample project structure:', {
        id: projects[0].id,
        name: projects[0].name,
        nextReviewDate: projects[0].nextReviewDate,
        lastReviewed: projects[0].lastReviewed,
        reviewIntervalDays: projects[0].reviewIntervalDays,
        hasTasks: !!projects[0].tasks,
        taskCount: projects[0].tasks?.length || 0
      })
    }
    
    // Process each project and its tasks
    const projectDTOs: ProjectDTO[] = []
    const allTasks: TaskDTO[] = []
    
    for (const project of projects) {
      // Convert to ProjectDTO
      const projectDTO: ProjectDTO = {
        id: project.id,
        name: project.name,
        status: project.status || 'active', // Ensure status is always set
        deferDate: project.deferDate || undefined,
        dueDate: project.dueDate || undefined,
        reviewIntervalDays: project.reviewIntervalDays || 7,
        tags: project.tags || [],
        lastReviewed: project.lastReviewed || undefined,
        nextReviewDate: project.nextReviewDate || undefined,
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
          
          const tags = Array.isArray(task.tags) ? task.tags : (task.context ? [task.context] : [])
          allTasks.push({
            id: task.id,
            projectId: project.id,
            name: task.name,
            status: task.status || 'available',
            dueDate: task.dueDate || undefined,
            deferDate: task.deferDate || undefined,
            context: task.context || tags[0] || undefined,
            tags,
            flagged: task.flagged || false,
            note: task.note || '',
            completed: task.completed || false,
            completedDate: task.completedDate || undefined,
            lastModified: new Date().toISOString(),
            syncState: 'synced'
          })
        }
      } else {
        console.log(`No tasks found for project: ${project.name} (tasks: ${typeof project.tasks})`)
      }
    }
    
    console.log(`📝 Prepared ${projectDTOs.length} projects and ${allTasks.length} tasks`)
    console.log('📝 Sample project DTO:', projectDTOs[0])
    
    // Clear existing data before importing fresh data
    console.log('🧹 Clearing existing projects and tasks...')
    await db.projects.clear()
    await db.tasks.clear()
    console.log('✅ Cleared existing data')
    
    // Add projects one at a time to avoid database lock issues
    console.log(`💾 Starting to add ${projectDTOs.length} projects...`)
    let projectsAdded = 0
    for (const project of projectDTOs) {
      try {
        await db.projects.put(project)
        projectsAdded++
        if (projectsAdded % 10 === 0) {
          console.log(`  Added ${projectsAdded}/${projectDTOs.length} projects...`)
        }
      } catch (projectError) {
        console.error(`❌ Error adding project ${project.name}:`, projectError)
      }
    }
    console.log(`✅ Added ${projectsAdded}/${projectDTOs.length} projects to database`)
    
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
      
      // Add tasks one at a time to avoid database lock issues
      let tasksAdded = 0
      for (const task of newTasks) {
        try {
          await db.tasks.put(task)
          tasksAdded++
          if (tasksAdded % 50 === 0) {
            console.log(`  Added ${tasksAdded}/${newTasks.length} tasks...`)
          }
        } catch (taskError) {
          console.error(`❌ Error adding task ${task.name}:`, taskError)
        }
      }
      console.log(`✅ Successfully imported ${tasksAdded}/${newTasks.length} tasks from OmniFocus`)
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


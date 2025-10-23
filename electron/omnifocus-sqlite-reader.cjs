// OmniFocus SQLite Database Reader
// Reads project and task data directly from OmniFocus 4 SQLite database

const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')
const fs = require('fs')

const DB_PATH = path.join(
  os.homedir(),
  'Library/Group Containers/34YW5XSRB7.com.omnigroup.OmniFocus/com.omnigroup.OmniFocus4/com.omnigroup.OmniFocusModel/OmniFocusDatabase.db'
)

/**
 * Get the path to the OmniFocus database
 */
function getOmniFocusDatabasePath() {
  return DB_PATH
}

/**
 * Check if the database file exists
 */
function databaseExists() {
  return fs.existsSync(DB_PATH)
}

/**
 * Open the OmniFocus database in read-only mode
 */
function openDatabase() {
  if (!databaseExists()) {
    throw new Error(`OmniFocus database not found at: ${DB_PATH}`)
  }

  try {
    const db = new Database(DB_PATH, { readonly: true, fileMustExist: true })
    return db
  } catch (error) {
    if (error.code === 'SQLITE_BUSY' || error.message?.includes('database is locked')) {
      throw new Error('OmniFocus database is locked. It may be in use by OmniFocus.')
    }
    throw error
  }
}

/**
 * Convert OmniFocus timestamp (Core Data timestamp) to ISO string
 * OmniFocus uses Core Data reference date: 2001-01-01 00:00:00 UTC
 */
function convertTimestamp(timestamp) {
  if (timestamp === null || timestamp === undefined) return null
  
  // Core Data reference date is Jan 1, 2001
  const referenceDate = new Date('2001-01-01T00:00:00Z').getTime()
  const milliseconds = referenceDate + (timestamp * 1000)
  
  return new Date(milliseconds).toISOString()
}

/**
 * Parse review repetition string to extract days
 */
function parseReviewInterval(repetitionString) {
  if (!repetitionString) return 7 // Default to weekly
  
  // Common formats: "FREQ=WEEKLY;INTERVAL=1" or "FREQ=DAILY;INTERVAL=7"
  if (repetitionString.includes('WEEKLY')) {
    const match = repetitionString.match(/INTERVAL=(\d+)/)
    const weeks = match ? parseInt(match[1]) : 1
    return weeks * 7
  }
  
  if (repetitionString.includes('DAILY')) {
    const match = repetitionString.match(/INTERVAL=(\d+)/)
    return match ? parseInt(match[1]) : 7
  }
  
  if (repetitionString.includes('MONTHLY')) {
    const match = repetitionString.match(/INTERVAL=(\d+)/)
    const months = match ? parseInt(match[1]) : 1
    return months * 30 // Approximate
  }
  
  return 7 // Default fallback
}

/**
 * Query all active projects from the database
 * Uses ProjectInfo.status to match JXA behavior exactly
 */
function queryProjects(db) {
  const query = `
    SELECT 
      Task.persistentIdentifier,
      Task.name,
      Task.childrenState as status,
      Task.effectiveDateToStart,
      Task.effectiveDateDue,
      Task.flagged,
      Task.estimatedMinutes,
      Task.plainTextNote,
      Task.projectInfo
    FROM Task
    INNER JOIN ProjectInfo ON Task.projectInfo = ProjectInfo.pk
    WHERE Task.projectInfo IS NOT NULL
      AND ProjectInfo.status = 'active'
    ORDER BY Task.name
  `
  
  try {
    const stmt = db.prepare(query)
    return stmt.all()
  } catch (error) {
    console.error('Error querying projects:', error.message)
    throw new Error(`Failed to query projects: ${error.message}`)
  }
}

/**
 * Query project info (review dates, etc.)
 */
function queryProjectInfo(db) {
  const query = `
    SELECT 
      pk,
      lastReviewDate,
      nextReviewDate,
      reviewRepetitionString
    FROM ProjectInfo
  `
  
  try {
    const stmt = db.prepare(query)
    const results = stmt.all()
    
    const map = new Map()
    results.forEach(info => {
      map.set(info.pk, info)
    })
    
    return map
  } catch (error) {
    console.error('Error querying project info:', error.message)
    return new Map()
  }
}

/**
 * Query tasks for a specific project
 */
function queryTasksForProject(db, projectId) {
  const query = `
    SELECT 
      persistentIdentifier,
      name,
      blocked,
      dateCompleted,
      effectiveDateDue,
      effectiveDateToStart,
      flagged,
      plainTextNote,
      dateCompleted as completedDate,
      parent
    FROM Task
    WHERE parent = ?
      AND projectInfo IS NULL
    ORDER BY rank
  `
  
  try {
    const stmt = db.prepare(query)
    return stmt.all(projectId)
  } catch (error) {
    console.error(`Error querying tasks for project ${projectId}:`, error.message)
    return []
  }
}

/**
 * Query contexts (tags) for tasks
 */
function queryTaskContexts(db, taskIds) {
  if (taskIds.length === 0) return new Map()
  
  const placeholders = taskIds.map(() => '?').join(',')
  const query = `
    SELECT 
      TaskToTag.task as taskId,
      Context.name as contextName
    FROM TaskToTag
    INNER JOIN Context ON TaskToTag.tag = Context.persistentIdentifier
    WHERE TaskToTag.task IN (${placeholders})
  `
  
  try {
    const stmt = db.prepare(query)
    const results = stmt.all(...taskIds)
    
    const map = new Map()
    results.forEach(ctx => {
      // Only store the first context for each task
      if (!map.has(ctx.taskId)) {
        map.set(ctx.taskId, ctx.contextName)
      }
    })
    
    return map
  } catch (error) {
    console.error('Error querying task contexts:', error.message)
    return new Map()
  }
}

/**
 * Map raw database data to app format
 */
function mapToAppFormat(rawProjects, projectInfoMap, allTasks, taskContexts) {
  return rawProjects.map(rawProject => {
    // Get project info for review dates
    const projectInfo = projectInfoMap.get(rawProject.projectInfo || '')
    
    // Convert status (childrenState: 0=active, 1=active, 2=active, 3=dropped)
    let status = 'active'
    if (rawProject.status === 3) status = 'dropped'
    
    // Get tasks for this project
    const rawTasks = allTasks.get(rawProject.persistentIdentifier) || []
    const mappedTasks = rawTasks.map(rawTask => {
      // Determine task status
      let taskStatus = 'available'
      if (rawTask.dateCompleted) {
        taskStatus = 'completed'
      } else if (rawTask.flagged) {
        taskStatus = 'next'
      } else if (rawTask.blocked) {
        taskStatus = 'blocked'
      }
      
      return {
        id: rawTask.persistentIdentifier,
        name: rawTask.name,
        status: taskStatus,
        dueDate: convertTimestamp(rawTask.effectiveDateDue),
        deferDate: convertTimestamp(rawTask.effectiveDateToStart),
        context: taskContexts.get(rawTask.persistentIdentifier) || null,
        flagged: Boolean(rawTask.flagged),
        note: rawTask.plainTextNote || '',
        completed: Boolean(rawTask.dateCompleted),
        completedDate: convertTimestamp(rawTask.completedDate)
      }
    })
    
    return {
      id: rawProject.persistentIdentifier,
      name: rawProject.name,
      status: status,
      deferDate: convertTimestamp(rawProject.effectiveDateToStart),
      dueDate: convertTimestamp(rawProject.effectiveDateDue),
      reviewIntervalDays: parseReviewInterval(projectInfo?.reviewRepetitionString || null), // FIXED: was reviewInterval
      lastReviewDate: convertTimestamp(projectInfo?.lastReviewDate || null),
      nextReviewDate: convertTimestamp(projectInfo?.nextReviewDate || null),
      flagged: Boolean(rawProject.flagged),
      estimatedMinutes: rawProject.estimatedMinutes,
      note: rawProject.plainTextNote || '',
      tags: [],
      tasks: mappedTasks
    }
  })
}

/**
 * Main entry point: Get all projects with tasks from SQLite database
 */
function getProjects() {
  const db = openDatabase()
  
  try {
    console.log('📊 [SQLite] Reading projects from database...')
    
    // Query projects
    const rawProjects = queryProjects(db)
    console.log(`📊 [SQLite] Found ${rawProjects.length} projects`)
    
    // Query project info
    const projectInfoMap = queryProjectInfo(db)
    console.log(`📊 [SQLite] Found ${projectInfoMap.size} project info records`)
    
    // Query all tasks for all projects
    const allTasks = new Map()
    let totalTasks = 0
    
    rawProjects.forEach(project => {
      const tasks = queryTasksForProject(db, project.persistentIdentifier)
      if (tasks.length > 0) {
        allTasks.set(project.persistentIdentifier, tasks)
        totalTasks += tasks.length
      }
    })
    
    console.log(`📊 [SQLite] Found ${totalTasks} tasks across all projects`)
    
    // Query contexts for all tasks
    const allTaskIds = Array.from(allTasks.values()).flat().map(t => t.persistentIdentifier)
    const taskContexts = queryTaskContexts(db, allTaskIds)
    console.log(`📊 [SQLite] Found ${taskContexts.size} task contexts`)
    
    // Map to app format
    const projects = mapToAppFormat(rawProjects, projectInfoMap, allTasks, taskContexts)
    
    console.log(`📊 [SQLite] Successfully mapped ${projects.length} projects`)
    
    return projects
  } finally {
    db.close()
  }
}

module.exports = {
  getOmniFocusDatabasePath,
  databaseExists,
  openDatabase,
  getProjects
}


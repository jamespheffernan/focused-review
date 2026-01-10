#!/usr/bin/env node

/**
 * GTD Context List Generator (A5 Version)
 * Generates a printable GTD context list optimized for A5 paper
 * Print 2 pages per sheet on A4, then cut in half
 * Usage: node scripts/generate-context-list-a5.cjs [--output /path/to/file.html]
 */

const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')
const fs = require('fs')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

const DB_PATH = path.join(
  os.homedir(),
  'Library/Group Containers/34YW5XSRB7.com.omnigroup.OmniFocus/com.omnigroup.OmniFocus4/com.omnigroup.OmniFocusModel/OmniFocusDatabase.db'
)

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

function databaseExists() {
  return fs.existsSync(DB_PATH)
}

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

function convertTimestamp(timestamp) {
  if (timestamp === null || timestamp === undefined) return null
  
  // Core Data reference date is Jan 1, 2001
  const referenceDate = new Date('2001-01-01T00:00:00Z').getTime()
  const milliseconds = referenceDate + (timestamp * 1000)
  
  return new Date(milliseconds)
}

/**
 * Query all active, available (non-blocked, non-deferred) tasks
 * Excludes: completed tasks, blocked tasks, deferred tasks, projects, and tasks in non-active projects
 */
function queryActiveTasks(db) {
  // Get current timestamp in Core Data format (seconds since 2001-01-01)
  const now = new Date()
  const referenceDate = new Date('2001-01-01T00:00:00Z').getTime()
  const currentTimestamp = (now.getTime() - referenceDate) / 1000
  
  const query = `
    SELECT 
      Task.persistentIdentifier,
      Task.name,
      Task.flagged,
      Task.effectiveDateDue,
      Task.plainTextNote,
      Task.dateCompleted,
      Task.blocked,
      Task.effectiveDateToStart
    FROM Task
    INNER JOIN ProjectInfo ON Task.containingProjectInfo = ProjectInfo.pk
    WHERE Task.dateCompleted IS NULL
      AND Task.projectInfo IS NULL
      AND Task.blocked = 0
      AND (Task.effectiveDateToStart IS NULL OR Task.effectiveDateToStart <= ?)
      AND Task.containingProjectInfo IS NOT NULL
      AND Task.name IS NOT NULL
      AND LENGTH(Task.name) > 0
      AND ProjectInfo.status = 'active'
    ORDER BY Task.name
  `
  
  try {
    const stmt = db.prepare(query)
    return stmt.all(currentTimestamp)
  } catch (error) {
    console.error('Error querying tasks:', error.message)
    throw new Error(`Failed to query tasks: ${error.message}`)
  }
}

/**
 * Query all contexts for given task IDs
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
    ORDER BY Context.name
  `
  
  try {
    const stmt = db.prepare(query)
    const results = stmt.all(...taskIds)
    
    const map = new Map()
    results.forEach(row => {
      if (!map.has(row.taskId)) {
        map.set(row.taskId, [])
      }
      map.get(row.taskId).push(row.contextName)
    })
    
    return map
  } catch (error) {
    console.error('Error querying task contexts:', error.message)
    return new Map()
  }
}

/**
 * Fetch all active tasks with their contexts
 */
function fetchTasksWithContexts(db) {
  console.log('📊 Querying active tasks from OmniFocus database...')
  
  const rawTasks = queryActiveTasks(db)
  console.log(`📊 Found ${rawTasks.length} active tasks`)
  
  if (rawTasks.length === 0) {
    return []
  }
  
  // Get all task IDs
  const taskIds = rawTasks.map(t => t.persistentIdentifier)
  
  // Query contexts for all tasks
  const taskContexts = queryTaskContexts(db, taskIds)
  console.log(`📊 Mapped contexts for ${taskContexts.size} tasks`)
  
  // Map to enriched format
  const tasks = rawTasks.map(raw => {
    const contexts = taskContexts.get(raw.persistentIdentifier) || []
    const dueDate = raw.effectiveDateDue ? convertTimestamp(raw.effectiveDateDue) : null
    
    return {
      id: raw.persistentIdentifier,
      name: raw.name,
      flagged: Boolean(raw.flagged),
      dueDate: dueDate,
      note: raw.plainTextNote || '',
      contexts: contexts.sort() // Sort alphabetically for consistency
    }
  })
  
  return tasks
}

// ============================================================================
// GROUPING & SORTING LOGIC
// ============================================================================

/**
 * Group tasks by context combinations
 * Returns: { 'Computer & AI': [tasks...], 'Calls': [tasks...], ... }
 */
function groupTasksByContext(tasks) {
  const groups = {}
  
  tasks.forEach(task => {
    if (task.contexts.length === 0) {
      // No context - add to Inbox
      const key = 'Inbox (No Context)'
      if (!groups[key]) groups[key] = []
      groups[key].push(task)
    } else {
      // Create a key for this combination (sorted, joined with " & ")
      const key = task.contexts.join(' & ')
      if (!groups[key]) groups[key] = []
      groups[key].push(task)
    }
  })
  
  return groups
}

/**
 * Sort context section keys intelligently
 * Groups related contexts together
 * Examples: AI, AI & Research, Calls, Calls & Waiting, Computer, Computer & AI
 */
function sortContextKeys(keys) {
  return keys.sort((a, b) => {
    // Extract primary tag (first word) from each key
    const aPrimary = a.split(' & ')[0]
    const bPrimary = b.split(' & ')[0]
    
    // If primary tags differ, sort by primary tag
    if (aPrimary !== bPrimary) {
      return aPrimary.localeCompare(bPrimary)
    }
    
    // If primary tags are same, shorter (simpler) keys come first
    // "Computer" before "Computer & AI"
    if (a.length !== b.length) {
      return a.length - b.length
    }
    
    // Otherwise sort alphabetically
    return a.localeCompare(b)
  })
}

/**
 * Sort tasks within a context group
 * 1. Flagged first
 * 2. By due date (overdue, then soonest)
 * 3. Alphabetically by name
 */
function sortTasksInGroup(tasks) {
  const now = new Date()
  
  return tasks.sort((a, b) => {
    // Flagged first
    if (a.flagged !== b.flagged) {
      return b.flagged ? 1 : -1
    }
    
    // By due date
    const aHasDue = a.dueDate !== null
    const bHasDue = b.dueDate !== null
    
    if (aHasDue && bHasDue) {
      return a.dueDate.getTime() - b.dueDate.getTime()
    } else if (aHasDue) {
      return -1 // Tasks with due dates come first
    } else if (bHasDue) {
      return 1
    }
    
    // Alphabetically by name
    return a.name.localeCompare(b.name)
  })
}

/**
 * Format a date for display
 */
function formatDate(date) {
  if (!date) return ''
  
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  if (dateOnly.getTime() === today.getTime()) {
    return 'TODAY'
  } else if (dateOnly.getTime() === tomorrow.getTime()) {
    return 'TOMORROW'
  } else if (dateOnly.getTime() < today.getTime()) {
    return `OVERDUE: ${dateOnly.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  } else {
    return dateOnly.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

/**
 * Truncate note to preview length
 */
function truncateNote(note, maxLength = 80) {
  if (!note) return ''
  if (note.length <= maxLength) return note
  return note.substring(0, maxLength) + '...'
}

/**
 * Reorder context sections for A5 booklet printing
 * When printing 2-up on A4 with left-edge binding, the browser prints:
 *   A4 Front: [Page 1 (left) | Page 2 (right)]
 *   A4 Back:  [Page 3 (left) | Page 4 (right)]
 * 
 * After cutting vertically in half and stapling left edge:
 *   Left half: P1 (front) → P3 (back)
 *   Right half: P2 (front) → P4 (back)
 * 
 * This reorders to [1, 3, 2, 4, 5, 7, 6, 8, ...] so that after cutting:
 *   Left half: P1 → P2 ✓
 *   Right half: P3 → P4 ✓
 */
function reorderForA5Booklet(sortedKeys, tasksByContext) {
  const reordered = []
  
  // Process in batches of 4
  for (let i = 0; i < sortedKeys.length; i += 4) {
    const batch = sortedKeys.slice(i, i + 4)
    
    if (batch.length >= 4) {
      // [0, 1, 2, 3] → [0, 2, 1, 3]
      reordered.push(batch[0], batch[2], batch[1], batch[3])
    } else if (batch.length === 3) {
      // [0, 1, 2] → [0, 2, 1]
      reordered.push(batch[0], batch[2], batch[1])
    } else if (batch.length === 2) {
      // [0, 1] → [0, 1]
      reordered.push(batch[0], batch[1])
    } else if (batch.length === 1) {
      // [0] → [0]
      reordered.push(batch[0])
    }
  }
  
  return reordered
}

// ============================================================================
// HTML GENERATION
// ============================================================================

function generateHTML(tasksByContext, orderedKeys) {
  // Use provided ordered keys, or fall back to sorting if not provided
  const contextKeys = orderedKeys || Object.keys(tasksByContext)
  const keysToUse = orderedKeys ? contextKeys : sortContextKeys(contextKeys)
  
  // Build HTML sections
  let sectionsHTML = ''
  
  keysToUse.forEach((contextKey, index) => {
    const tasks = sortTasksInGroup(tasksByContext[contextKey])
    const taskCount = tasks.length
    
    // Section header
    sectionsHTML += `
    <div class="context-section">
      <h2 class="context-header">${escapeHtml(contextKey)}</h2>
      <p class="task-count">${taskCount} task${taskCount !== 1 ? 's' : ''}</p>
      
      <div class="task-list">
`
    
    // Tasks in this section
    tasks.forEach(task => {
      const flagIndicator = task.flagged ? '🚩 ' : ''
      const dueDate = task.dueDate ? formatDate(task.dueDate) : ''
      const dueDateHTML = dueDate ? `<span class="due-date">${dueDate}</span>` : ''
      const notePreview = task.note ? `<div class="note-preview">${escapeHtml(truncateNote(task.note))}</div>` : ''
      
      sectionsHTML += `
        <div class="task-row">
          <div class="checkbox">☐</div>
          <div class="task-content">
            <div class="task-name">${flagIndicator}${escapeHtml(task.name)}</div>
            ${dueDateHTML}
            ${notePreview}
          </div>
        </div>
`
    })
    
    sectionsHTML += `
      </div>
    </div>
`
    
    // No automatic page breaks - let browser handle naturally for printing
  })
  
  const now = new Date()
  const generatedDate = now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  const generatedTime = now.toLocaleTimeString('en-US')
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GTD Context List</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Courier New', monospace;
      background-color: white;
      color: #2c2c2c;
      line-height: 1.35;
      padding: 0.1in;
      margin: 0;
      font-size: 24px;
    }
    
    .container {
      max-width: 100%;
      margin: 0;
      padding: 0;
    }
    
    .header {
      text-align: center;
      border-bottom: 1.5px solid #2c2c2c;
      padding-bottom: 0.08in;
      margin-bottom: 0.08in;
    }
    
    .header h1 {
      font-size: 36px;
      font-weight: bold;
      letter-spacing: 2px;
      margin-bottom: 6px;
    }
    
    .header-date {
      font-size: 18px;
      color: #666;
    }
    
    .context-section {
      margin-bottom: 0.12in;
      page-break-after: auto;
      page-break-inside: avoid;
    }
    
    .context-header {
      font-size: 24px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-left: 4px solid #2c2c2c;
      padding-left: 0.12in;
      margin-bottom: 6px;
      margin-top: 0.12in;
    }
    
    .task-count {
      font-size: 16px;
      color: #999;
      margin-bottom: 6px;
      padding-left: 0.12in;
    }
    
    .task-list {
      margin-left: 0.08in;
    }
    
    .task-row {
      display: flex;
      margin-bottom: 10px;
      font-size: 24px;
      page-break-inside: avoid;
    }
    
    .checkbox {
      min-width: 32px;
      height: 32px;
      border: 2.5px solid #2c2c2c;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
      flex-shrink: 0;
      font-size: 24px;
      background: white;
    }
    
    .task-content {
      flex: 1;
    }
    
    .task-name {
      font-weight: bold;
      margin-bottom: 1px;
      word-break: break-word;
      line-height: 1.3;
    }
    
    .due-date {
      display: inline-block;
      background-color: #fff3cd;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 18px;
      font-weight: bold;
      margin-right: 10px;
      color: #856404;
    }
    
    .due-date.overdue {
      background-color: #f8d7da;
      color: #721c24;
    }
    
    .note-preview {
      font-size: 20px;
      color: #666;
      font-style: italic;
      margin-top: 4px;
      margin-left: 0;
      padding-left: 10px;
      border-left: 2px dashed #ccc;
      line-height: 1.35;
    }
    
    .footer {
      margin-top: 0.15in;
      padding-top: 0.1in;
      border-top: 1px solid #ccc;
      font-size: 16px;
      color: #999;
      text-align: center;
      page-break-inside: avoid;
    }
    
    @media print {
      body {
        background-color: white;
        padding: 0.05in;
        margin: 0;
      }
      
      .container {
        max-width: 100%;
        margin: 0;
        padding: 0;
      }
      
      .header {
        page-break-after: avoid;
      }
      
      .context-section {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      
      .task-row {
        page-break-inside: avoid;
      }
      
      .footer {
        page-break-before: avoid;
      }
    }
    
    @page {
      size: auto;
      margin: 0.1in;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>GTD CONTEXT LIST</h1>
      <p class="header-date">Generated: ${generatedDate} at ${generatedTime}</p>
    </div>
    
    ${sectionsHTML}
    
    <div class="footer">
      <p>Print 2 pages per sheet on A4, then cut in half for A5 size. Use checkboxes to mark completed tasks.</p>
    </div>
  </div>
</body>
</html>`
  
  return html
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    // Parse command-line arguments
    const args = process.argv.slice(2)
    let outputPath = 'context-list-a5.html'
    
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--output' && args[i + 1]) {
        outputPath = args[i + 1]
        i++
      }
    }
    
    // Expand home directory if needed
    if (outputPath.startsWith('~')) {
      outputPath = path.join(os.homedir(), outputPath.slice(1))
    }
    
    console.log('🚀 GTD Context List Generator')
    console.log(`📁 Output: ${outputPath}\n`)
    
    // Open database
    const db = openDatabase()
    console.log('✅ Connected to OmniFocus database')
    
    try {
      // Fetch tasks with contexts
      const tasks = fetchTasksWithContexts(db)
      console.log(`✅ Found ${tasks.length} tasks\n`)
      
      if (tasks.length === 0) {
        console.log('ℹ️  No active tasks found. Creating empty list...\n')
      }
      
      // Group and sort
      const tasksByContext = groupTasksByContext(tasks)
      const contextKeys = Object.keys(tasksByContext)
      const sortedKeys = sortContextKeys(contextKeys)
      console.log(`✅ Grouped into ${contextKeys.length} context sections\n`)
      
      // Reorder for A5 booklet printing (2-up on A4, cut and staple on left)
      const reorderedKeys = reorderForA5Booklet(sortedKeys, tasksByContext)
      
      // Generate HTML with reordered sections
      const html = generateHTML(tasksByContext, reorderedKeys)
      
      // Write to file
      fs.writeFileSync(outputPath, html, 'utf-8')
      console.log(`✅ Generated: ${outputPath}`)
      
      // Open in browser
      try {
        await execAsync(`open "${outputPath}"`)
        console.log('✅ Opened in default browser\n')
      } catch (e) {
        console.log(`ℹ️  To view, open: ${outputPath}\n`)
      }
      
    } finally {
      db.close()
    }
    
    console.log('✨ Done!')
    process.exit(0)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()

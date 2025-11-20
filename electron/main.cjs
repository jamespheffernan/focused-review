const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs').promises
const { exec } = require('child_process')
const { promisify } = require('util')
const { triggerOmniFocusPlugin } = require('./omnifocus-plugin-trigger.cjs')

const execAsync = promisify(exec)

const sanitizeTagArray = (rawTags) => {
  if (rawTags === undefined || rawTags === null) {
    return []
  }
  const input = Array.isArray(rawTags) ? rawTags : [rawTags]
  const seen = new Set()
  const tags = []
  for (const value of input) {
    if (typeof value !== 'string') {
      continue
    }
    const trimmed = value.trim()
    if (!trimmed) {
      continue
    }
    const key = trimmed.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    tags.push(trimmed)
  }
  return tags
}

const normalizeTagLookup = (value) => (value || '').trim().replace(/[\s,]+$/g, '').toLowerCase()

const levenshteinDistance = (a, b) => {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[m][n]
}

const bestTagMatch = (input, tags) => {
  const needle = normalizeTagLookup(input)
  if (!needle) return {}
  const candidates = tags.map(tag => ({
    ...tag,
    lower: (tag.name || '').toLowerCase()
  }))

  const exact = candidates.find(t => t.lower === needle)
  if (exact) return { tag: exact }

  const starts = candidates.filter(t => t.lower.startsWith(needle))
  if (starts.length === 1) return { tag: starts[0] }
  if (starts.length > 1) return { ambiguous: true }

  const includes = candidates.filter(t => t.lower.includes(needle))
  if (includes.length === 1) return { tag: includes[0] }
  if (includes.length > 1) return { ambiguous: true }

  let best = null
  let bestDist = Number.MAX_SAFE_INTEGER
  for (const candidate of candidates) {
    const dist = levenshteinDistance(needle, candidate.lower)
    if (dist < bestDist) {
      bestDist = dist
      best = candidate
    }
  }
  if (best && bestDist <= 2) {
    return { tag: best }
  }
  return {}
}

const fetchAvailableTagList = async () => {
  const tempJxaPath = path.join(require('os').tmpdir(), 'get_tags_jxa.js')
  const jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;
let tags = [];
try { tags = doc.flattenedTags(); } catch (e) { try { tags = doc.flattenedContexts(); } catch (e2) {} }
const result = [];
for (let i = 0; i < tags.length; i++) {
  try {
    result.push({ id: tags[i].id(), name: tags[i].name() });
  } catch (err) {}
}
JSON.stringify(result);`

  await fs.writeFile(tempJxaPath, jxaScript)
  const { stdout } = await execAsync(`osascript -l JavaScript "${tempJxaPath}"`)
  try {
    await fs.unlink(tempJxaPath)
  } catch (cleanupError) {
    console.warn('Failed to remove temporary tag script:', cleanupError.message)
  }
  try {
    const parsed = JSON.parse(stdout || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch (parseError) {
    console.error('Failed to parse tag list JSON:', parseError)
    return []
  }
}

const toTagNameList = (tags) => {
  if (!Array.isArray(tags)) {
    return []
  }
  return tags
    .map(tag => {
      if (!tag) return undefined
      if (typeof tag === 'string') return tag
      if (typeof tag === 'object') return tag.name
      return undefined
    })
    .filter(Boolean)
}

const applyTagsToTask = async (taskId, tagNames) => {
  const result = await invokePluginAction('setTaskTags', {
    id: taskId,
    tags: Array.isArray(tagNames) ? tagNames : []
  })
  return result?.tags?.map(tag => tag.name) ?? toTagNameList(tagNames)
}

const resolveTagNamesWithFuzzyMatching = async (rawTags) => {
  const desiredTags = sanitizeTagArray(rawTags)
  if (desiredTags.length === 0) {
    return []
  }

  const availableTags = await fetchAvailableTagList()
  if (!availableTags || availableTags.length === 0) {
    throw new Error('No tags found in OmniFocus')
  }

  const resolvedTags = []
  for (const tagName of desiredTags) {
    const { tag, ambiguous } = bestTagMatch(tagName, availableTags)
    if (ambiguous) {
      throw new Error(`Tag "${tagName}" matches multiple tags. Please be more specific.`)
    }
    if (!tag) {
      throw new Error(`Tag "${tagName}" was not found in OmniFocus.`)
    }
    resolvedTags.push(tag)
  }
  return resolvedTags
}

const setTaskTagsWithFuzzyMatching = async (taskId, rawTags, options = {}) => {
  const { apply = true } = options
  const resolvedTags = await resolveTagNamesWithFuzzyMatching(rawTags)
  if (apply) {
    return applyTagsToTask(taskId, resolvedTags)
  }
  return resolvedTags
}

const ensureOmniFocusRunning = async () => {
  const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
  try {
    const { stdout } = await execAsync(`osascript -e '${checkScript}'`)
    return stdout.trim().toLowerCase().includes('true')
  } catch (error) {
    console.error('[OmniFocus] Failed to check running state:', error)
    return false
  }
}

const OMNIFOCUS_NOT_RUNNING_ERROR = 'OmniFocus is not running. Please start OmniFocus and try again.'

const invokePluginAction = async (action, args = {}) => {
    const isRunning = await ensureOmniFocusRunning()
    if (!isRunning) {
    throw new Error(OMNIFOCUS_NOT_RUNNING_ERROR)
  }
  const response = await triggerOmniFocusPlugin({ action, ...args })
  if (!response) {
    throw new Error(`No response from OmniFocus plugin (action: ${action})`)
  }
  if (response.success === false) {
    throw new Error(response.error || `OmniFocus plugin action "${action}" failed`)
  }
  return response.result ?? response
}

const handleSetTaskTags = async (taskId, tags) => {
  try {
    console.log(`[OmniFocus] set-task-tags called for task ${taskId} with tags`, tags)
    const resolvedTags = await setTaskTagsWithFuzzyMatching(taskId, tags)
    console.log('[OmniFocus] Tags set successfully:', resolvedTags)
    return { success: true, taskId, tags: toTagNameList(resolvedTags) }
  } catch (error) {
    console.error('Error setting task tags:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

const formatTaskResult = (result) => {
  if (!result || typeof result !== 'object') {
    return result
  }
  const formatted = { ...result }
  if (formatted.tags) {
    formatted.tags = toTagNameList(formatted.tags)
  }
  return formatted
}

const getTagsResponse = async () => {
  try {
    const isRunning = await ensureOmniFocusRunning()
    if (!isRunning) {
      return { success: false, error: 'OmniFocus is not running. Please start OmniFocus and try again.', contexts: [] }
    }
    const tags = await fetchAvailableTagList()
    tags.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return { success: true, contexts: tags }
  } catch (error) {
    console.error('Error fetching tags:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error), contexts: [] }
  }
}

// ---------------------------------------------------------------------------
// IPC HANDLERS
// ---------------------------------------------------------------------------

ipcMain.handle('omnifocus:get-tags', async () => getTagsResponse())
ipcMain.handle('omnifocus:get-contexts', async () => getTagsResponse())

// Load environment variables from shell config if not already set
// This ensures Notion sync works even when app is launched from Finder
async function loadEnvVarsFromShell() {
  // Only load if not already set
  if (process.env.NOTION_TOKEN && process.env.NOTION_PROJECT_DB) {
    console.log('✅ Notion environment variables already set')
    return
  }
  
  try {
    console.log('🔍 Attempting to load Notion environment variables from shell...')
    
    // Read env vars using shell (which sources .zshrc/.bashrc)
    const { stdout } = await execAsync('source ~/.zshrc 2>/dev/null || source ~/.bashrc 2>/dev/null; echo "NOTION_TOKEN=$NOTION_TOKEN"; echo "NOTION_PROJECT_DB=$NOTION_PROJECT_DB"; echo "NOTION_ARCHIVE_DB=$NOTION_ARCHIVE_DB"; echo "NOTION_SOMEDAY_DB=$NOTION_SOMEDAY_DB"')
    
    const lines = stdout.trim().split('\n')
    for (const line of lines) {
      const [key, value] = line.split('=')
      if (key && value && value !== 'undefined' && value !== '') {
        process.env[key] = value
        console.log(`✅ Loaded ${key} from shell config`)
      }
    }
    
    // Verify we got what we need
    if (process.env.NOTION_TOKEN && process.env.NOTION_PROJECT_DB) {
      console.log('✅ Notion sync environment variables loaded successfully')
      console.log(`   NOTION_TOKEN: ${process.env.NOTION_TOKEN ? 'Set' : 'Not set'}`)
      console.log(`   NOTION_PROJECT_DB: ${process.env.NOTION_PROJECT_DB ? 'Set' : 'Not set'}`)
      console.log(`   NOTION_ARCHIVE_DB: ${process.env.NOTION_ARCHIVE_DB ? 'Set' : 'Not set'}`)
      console.log(`   NOTION_SOMEDAY_DB: ${process.env.NOTION_SOMEDAY_DB ? 'Set' : 'Not set'}`)
    } else {
      console.log('⚠️ Notion environment variables not found in shell config')
      console.log('   To enable Notion sync, set in ~/.zshrc or ~/.bashrc:')
      console.log('   export NOTION_TOKEN="your_token"')
      console.log('   export NOTION_PROJECT_DB="your_database_id"')
    }
  } catch (error) {
    console.log('⚠️ Could not load env vars from shell (this is OK if launched from terminal)')
  }
}

// Load env vars before app is ready
loadEnvVarsFromShell()

// Enable remote debugging for MCP server integration
// This allows Chrome DevTools Protocol (CDP) access for automated testing
// Port 9222 is the standard CDP port
// Note: In production, consider gating this behind an environment variable or build flag
if (!app.isPackaged || process.env.ENABLE_REMOTE_DEBUGGING === 'true') {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
  console.log('🔧 Remote debugging enabled on port 9222 (for MCP server integration)')
}

// Persistent JXA script path (app user data directory)
const JXA_SCRIPT_PATH = path.join(app.getPath('userData'), 'omnifocus-sync.js')

// Keep a global reference of the window object
let mainWindow

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.cjs')
    },
    titleBarStyle: 'hiddenInset',
    show: false
  })


  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5174')
    mainWindow.webContents.openDevTools()
  } else {
    // Use loadFile for proper asset loading in packaged app
    // In production, dist is in the app's resources
    const indexPath = path.join(__dirname, '../dist/index.html')
    console.log('Loading app from:', indexPath)
    console.log('__dirname:', __dirname)
    console.log('File exists:', require('fs').existsSync(indexPath))
    mainWindow.loadFile(indexPath)
      .then(() => console.log('✅ App loaded successfully'))
      .catch(err => console.error('❌ Failed to load app:', err))
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// App event handlers
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Function to ensure JXA script exists
async function ensureJXAScript() {
  try {
    // Check if script already exists
    await fs.access(JXA_SCRIPT_PATH)
    console.log('Using existing JXA script')
    return JXA_SCRIPT_PATH
  } catch (error) {
    // Script doesn't exist, create it
    console.log('Creating persistent JXA script')
    const jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;
const flattenedProjects = doc.flattenedProjects();

const activeProjects = [];
for (let i = 0; i < flattenedProjects.length; i++) {
  const project = flattenedProjects[i];
  if (project.status() === 'active status') {
    const tasks = project.tasks();
    const taskData = [];
    
    for (let j = 0; j < tasks.length; j++) {
      const task = tasks[j];
      try {
        const taskObj = {
          id: task.id(),
          name: task.name(),
          status: 'available',
          dueDate: null,
          deferDate: null,
          tags: [],
          flagged: task.flagged(),
          note: task.note() || '',
          completed: task.completed(),
          completedDate: null
        };
        
        // Determine status
        if (taskObj.completed) {
          taskObj.status = 'completed';
        } else if (taskObj.flagged) {
          taskObj.status = 'next';
        }
        
        // Try to get optional fields
        try {
          const dueDate = task.dueDate();
          if (dueDate) taskObj.dueDate = dueDate.toISOString();
        } catch (e) { }
        
        try {
          const deferDate = task.deferDate();
          if (deferDate) taskObj.deferDate = deferDate.toISOString();
        } catch (e) { 
          console.log('DEBUG: Could not get deferDate for task ' + task.name() + ': ' + e.message);
        }
        
        // OmniFocus 3+ uses tags instead of contexts
        try {
          const tags = task.tags();
          if (tags && tags.length > 0) {
            const tagNames = [];
            for (let k = 0; k < tags.length; k++) {
              try {
                const tagName = tags[k].name();
                if (tagName) {
                  tagNames.push(tagName);
                }
              } catch (innerError) {}
            }
            taskObj.tags = tagNames;
            console.log('DEBUG: Task "' + task.name() + '" has tags: ' + tagNames.join(', '));
          } else {
            console.log('DEBUG: Task "' + task.name() + '" has no tags');
            taskObj.tags = [];
          }
        } catch (e) { 
          console.log('DEBUG: Error getting tags for task ' + task.name() + ': ' + e.message);
          taskObj.tags = [];
        }
        
        if (taskObj.name) {
          taskData.push(taskObj);
        }
      } catch (taskError) {
        continue;
      }
    }
    
    // Try to get review dates with error handling
    let lastReviewDate = null;
    let nextReviewDate = null;
    try {
      const lastRev = project.lastReviewDate();
      lastReviewDate = lastRev ? lastRev.toISOString() : null;
    } catch (e) {
      console.log('DEBUG: Error getting lastReviewDate for ' + project.name() + ': ' + e.message);
    }
    try {
      const nextRev = project.nextReviewDate();
      nextReviewDate = nextRev ? nextRev.toISOString() : null;
    } catch (e) {
      console.log('DEBUG: Error getting nextReviewDate for ' + project.name() + ': ' + e.message);
    }
    
    activeProjects.push({
      id: project.id(),
      name: project.name(),
      status: project.status(),
      deferDate: project.deferDate() ? project.deferDate().toISOString() : null,
      dueDate: project.dueDate() ? project.dueDate().toISOString() : null,
      reviewInterval: project.reviewInterval(),
      lastReviewDate: lastReviewDate,
      nextReviewDate: nextReviewDate,
      flagged: project.flagged(),
      estimatedMinutes: project.estimatedMinutes(),
      note: project.note() || '',
      tasks: taskData
    });
  }
}

JSON.stringify(activeProjects);`
    
    await fs.writeFile(JXA_SCRIPT_PATH, jxaScript)
    console.log('JXA script created successfully')
    return JXA_SCRIPT_PATH
  }
}

// Import SQLite reading modules
let loadOmniFocusData
try {
  const loader = require('./omnifocus-data-loader.cjs')
  loadOmniFocusData = loader.loadOmniFocusData
  console.log('✅ SQLite loader module loaded successfully')
} catch (error) {
  console.error('❌ Failed to load SQLite loader module:', error.message)
  console.error('   Will use JXA-only mode')
  // Define a fallback that always uses JXA
  loadOmniFocusData = async (jxaLoader) => {
    const projects = await jxaLoader()
    return {
      projects,
      source: 'jxa',
      error: 'SQLite module failed to load'
    }
  }
}

// IPC handlers for OmniFocus integration
ipcMain.handle('omnifocus:get-projects', async () => {
  try {
    console.time('omnifocus:get-projects')
    
    // JXA loader function for fallback
    const jxaLoader = async () => {
      // First check if OmniFocus is running
      const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
      try {
        const { stdout: isRunningOutput } = await execAsync(`osascript -e '${checkScript}'`)
        
        if (!isRunningOutput.trim().toLowerCase().includes('true')) {
          throw new Error('OmniFocus is not running. Please start OmniFocus and try again.')
        }
      } catch (error) {
        console.error('Error checking OmniFocus status:', error.message)
        throw new Error('OmniFocus is not running. Please start OmniFocus and try again.')
      }
      
      // Use persistent JXA script
      const scriptPath = await ensureJXAScript()
      
      // Execute the persistent script directly
      console.log('Executing JXA script...')
      const { stdout: projectOutput, stderr } = await execAsync(`osascript -l JavaScript "${scriptPath}"`)
    
      if (stderr) {
        console.error('AppleScript stderr:', stderr)
      }
      
      console.log('📊 JXA script output length:', projectOutput.length)
      
      if (!projectOutput || projectOutput.trim() === '') {
        throw new Error('No projects found in OmniFocus')
      }
      
      // Parse the JSON output from JXA
      let projectData = []
      try {
        projectData = JSON.parse(projectOutput.trim())
      } catch (parseError) {
        console.error('Failed to parse JXA output as JSON:', parseError)
        throw new Error('Failed to parse OmniFocus project data')
      }
      
      console.log('📊 Parsed', projectData.length, 'projects from JXA')
      
      // Process and validate projects (existing logic)
      const projects = []
      
      for (let i = 0; i < projectData.length; i++) {
        const project = projectData[i]
        
        if (project && project.name && project.name.trim() !== '') {
          // Skip completed projects
          if (project.status === 'done' || project.status === 'completed' || project.status === 'done status') {
            continue
          }
          
          let status = 'active'
          if (project.status === 'on hold') status = 'on_hold'
          if (project.status === 'dropped') status = 'dropped'
          
          const processedProject = {
            id: project.id || `of_${i}`,
            name: project.name,
            status: status,
            deferDate: project.deferDate,
            dueDate: project.dueDate,
            reviewIntervalDays: project.reviewInterval || 7,
            lastReviewDate: project.lastReviewDate,
            nextReviewDate: project.nextReviewDate,
            flagged: Boolean(project.flagged),
            estimatedMinutes: project.estimatedMinutes,
            note: project.note || '',
            tags: [],
            tasks: project.tasks || []
          }
          
          projects.push(processedProject)
        }
      }
      
      return projects
    }
    
    // Try SQLite first, fallback to JXA
    const result = await loadOmniFocusData(jxaLoader)
    
    console.timeEnd('omnifocus:get-projects')
    console.log(`✅ Data loaded from: ${result.source}`)
    console.log(`📊 Result structure:`, {
      hasProjects: !!result.projects,
      projectsType: typeof result.projects,
      projectsLength: result.projects?.length,
      source: result.source,
      hasError: !!result.error
    })
    
    // Validate projects array
    const validatedProjects = result.projects || []
    
    // Return projects with metadata about source
    return {
      projects: validatedProjects,
      dataSource: result.source,
      fallbackReason: result.error
    }
  } catch (error) {
    console.error('AppleScript error:', error)
    console.error('Error details:', error.message)
    console.error('Error stack:', error.stack)
    throw new Error('Failed to connect to OmniFocus: ' + error.message)
  }
})

ipcMain.handle('omnifocus:get-project-tasks', async (event, projectId) => {
  try {
    // First check if OmniFocus is running
    const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
    const { stdout: isRunningOutput } = await execAsync(`osascript -e '${checkScript}'`)
    
    if (!isRunningOutput.trim().toLowerCase().includes('true')) {
      throw new Error('OmniFocus is not running. Please start OmniFocus and try again.')
    }
    
    
    // Use JXA to get tasks for specific project
    const tempJxaPath = path.join(require('os').tmpdir(), 'temp_omnifocus_tasks_jxa.js')
    const jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;
const projects = doc.flattenedProjects();

let targetProject = null;
for (let i = 0; i < projects.length; i++) {
  if (projects[i].id() === '${projectId}') {
    targetProject = projects[i];
    break;
  }
}

if (!targetProject) {
  throw new Error('Project not found');
}

const tasks = targetProject.tasks();
const taskData = [];

for (let j = 0; j < tasks.length; j++) {
  const task = tasks[j];
  try {
    const tagNames = [];
    try {
      const tags = task.tags();
      if (tags) {
        for (let k = 0; k < tags.length; k++) {
          try {
            const tagName = tags[k].name();
            if (tagName) {
              tagNames.push(tagName);
            }
          } catch (innerError) {}
        }
      }
    } catch (tagError) {}
    taskData.push({
      id: task.id(),
      name: task.name(),
      status: task.status(),
      dueDate: task.dueDate() ? task.dueDate().toISOString() : null,
      deferDate: task.deferDate() ? task.deferDate().toISOString() : null,
      tags: tagNames,
      flagged: task.flagged(),
      note: task.note() || '',
      completed: task.completed(),
      completedDate: task.completed() && task.completionDate() ? task.completionDate().toISOString() : null
    });
  } catch (taskError) {
  }
}

JSON.stringify(taskData);`
    
    // Write the JXA script to a temporary file
    await fs.writeFile(tempJxaPath, jxaScript)
    
    const { stdout: taskOutput, stderr } = await execAsync(`osascript -l JavaScript "${tempJxaPath}"`)
    
    // Clean up the temporary file
    try {
      await fs.unlink(tempJxaPath)
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary JXA file:', cleanupError.message)
    }
    
    if (stderr) {
      console.error('JXA stderr:', stderr)
    }
    
    if (!taskOutput || taskOutput.trim() === '') {
      return []
    }
    
    // Parse the JSON output from JXA
    let taskData = []
    try {
      taskData = JSON.parse(taskOutput.trim())
    } catch (parseError) {
      console.error('Failed to parse JXA task output as JSON:', parseError)
      throw new Error('Failed to parse OmniFocus task data')
    }
    
    return taskData
    
  } catch (error) {
    console.error('Error fetching project tasks:', error)
    throw new Error('Failed to fetch project tasks: ' + error.message)
  }
})

ipcMain.handle('omnifocus:update-project', async (event, projectId, updates) => {
  try {
    const result = await invokePluginAction('updateProject', {
      id: projectId,
      updates: updates || {}
    })
    console.log('Project updated via plugin:', result)
    return true
  } catch (error) {
    console.error('Plugin project update error:', error)
    return false
  }
})

ipcMain.handle('omnifocus:mark-project-complete', async (event, projectId) => {
  try {
    console.log(`Marking project ${projectId} as complete`)
    const result = await invokePluginAction('markProjectComplete', { id: projectId })
    return {
  success: true,
      projectId,
      completed: result?.completed ?? true
    }
  } catch (error) {
    console.error('Error marking project as complete via plugin:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('omnifocus:drop-project', async (event, projectId) => {
  try {
    console.log(`Dropping project ${projectId}`)
    const result = await invokePluginAction('dropProject', { id: projectId })
    return {
  success: true,
      projectId,
      status: 'dropped',
      ...result
    }
  } catch (error) {
    console.error('Error dropping project via plugin:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('omnifocus:mark-project-reviewed', async (event, projectId) => {
  try {
    console.log(`Marking project ${projectId} as reviewed`)
    const pluginResult = await invokePluginAction('markProjectReviewed', {
      id: projectId,
      timestamp: new Date().toISOString(),
    })
    console.log('Project review updated via plugin:', pluginResult)
    return {
  success: true,
      projectId,
      lastReviewDate: pluginResult?.lastReviewDate ?? new Date().toISOString(),
      nextReviewDate: pluginResult?.nextReviewDate ?? null,
    }
  } catch (error) {
    console.error('Error marking project reviewed via plugin:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('omnifocus:is-running', async () => {
  try {
    const script = `
      tell application "System Events"
        return (name of processes) contains "OmniFocus"
      end tell
    `
    
    const { stdout } = await execAsync(`osascript -e '${script}'`)
    return stdout.trim().toLowerCase() === 'true'
  } catch (error) {
    return false
  }
})

ipcMain.handle('omnifocus:launch', async () => {
  try {
    const script = `
      tell application "OmniFocus"
        activate
      end tell
    `
    
    await execAsync(`osascript -e '${script}'`)
    return true
  } catch (error) {
    console.error('AppleScript launch error:', error)
    return false
  }
})

// IPC handler for setting tags on a task
ipcMain.handle('omnifocus:set-task-tags', async (event, taskId, tags) => {
  return handleSetTaskTags(taskId, tags)
})

// Backward compatibility handler for legacy context API
ipcMain.handle('omnifocus:set-task-context', async (event, taskId, contextName) => {
  return handleSetTaskTags(taskId, contextName ? [contextName] : [])
})

// IPC handler for setting due date on a task
ipcMain.handle('omnifocus:set-task-due-date', async (event, taskId, dueDate) => {
  try {
    console.log(`Setting due date "${dueDate}" on task ${taskId}`)
    const pluginResult = await invokePluginAction('setTaskDueDate', {
      id: taskId,
      dueDate: dueDate || null
    })
    const normalizedDueDate = pluginResult?.dueDate ?? (dueDate || null)
    console.log('[OmniFocus] Due date operation successful via plugin:', normalizedDueDate)
    return { success: true, taskId, dueDate: normalizedDueDate }
  } catch (error) {
    console.error('Error setting task due date via plugin:', error)
    return { success: false, error: error.message }
  }
})

// IPC handler for toggling task completion
ipcMain.handle('omnifocus:toggle-task-completion', async (event, taskId, isComplete) => {
  try {
    console.log(`Setting task ${taskId} completion to ${isComplete}`)
    const result = await invokePluginAction('toggleTaskCompletion', {
      id: taskId,
      completed: Boolean(isComplete)
    })
    const formatted = formatTaskResult(result)
    return {
  success: true,
      taskId,
      completed: formatted?.completed ?? Boolean(isComplete),
      completionDate: formatted?.completionDate ?? null,
      tags: formatted?.tags
    }
  } catch (error) {
    console.error('Error toggling task completion via plugin:', error)
    return { success: false, error: error.message }
  }
})

// IPC handler for updating task properties (comprehensive update)
ipcMain.handle('omnifocus:update-task', async (event, taskId, updates) => {
  try {
    const normalizedUpdates = { ...(updates || {}) }

    if (normalizedUpdates.tags !== undefined) {
      try {
        const resolvedTags = await setTaskTagsWithFuzzyMatching(taskId, normalizedUpdates.tags, { apply: false })
        normalizedUpdates.tags = resolvedTags
      } catch (tagError) {
        console.error('[OmniFocus] Tag resolution failed:', tagError)
        const message = tagError instanceof Error ? tagError.message : String(tagError)
        return { success: false, error: `Tag update failed: ${message}` }
      }
    }
    
    if (normalizedUpdates.completedDate !== undefined) {
      delete normalizedUpdates.completedDate
    }

    const pluginResult = await invokePluginAction('updateTask', { id: taskId, updates: normalizedUpdates })
    const formatted = formatTaskResult(pluginResult)
    return { 
      success: true, 
      taskId,
      ...formatted
    }
  } catch (error) {
    console.error('Error updating task via plugin:', error)
    return { success: false, error: error.message }
  }
})

// IPC handler for creating a new task in OmniFocus
ipcMain.handle('omnifocus:create-task', async (event, projectId, taskName) => {
  try {
    console.log(`Creating task "${taskName}" in project ${projectId}`)
    const pluginResult = await invokePluginAction('createTask', {
      projectId,
      name: taskName
    })
    console.log('Task created successfully via plugin:', pluginResult)
    const formatted = formatTaskResult(pluginResult)
    return {
  success: true,
      taskId: pluginResult?.id || pluginResult?.taskId,
      taskName: pluginResult?.name || taskName,
      tags: formatted?.tags || []
    }
  } catch (error) {
    console.error('Error creating task:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('omnifocus:create-inbox-task', async (event, taskName) => {
  try {
    console.log(`Creating inbox task "${taskName}"`)
    const pluginResult = await invokePluginAction('createInboxTask', {
      name: taskName
    })
    console.log('Inbox task created successfully via plugin:', pluginResult)
    const formatted = formatTaskResult(pluginResult)
    return {
  success: true,
      taskId: pluginResult?.id || pluginResult?.taskId,
      taskName: pluginResult?.name || taskName,
      tags: formatted?.tags || []
    }
  } catch (error) {
    console.error('Error creating inbox task:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('omnifocus:get-database-path', async () => {
  try {
    // Try to find OmniFocus database files
    const possiblePaths = [
      path.join(process.env.HOME, 'Library/Group Containers/34YW5XSRB7.com.omnigroup.OmniFocus4'),
      path.join(process.env.HOME, 'Library/Group Containers/34YW5XSRB7.com.omnigroup.OmniFocus3'),
      path.join(process.env.HOME, 'Library/Application Support/OmniFocus')
    ]
    
    for (const basePath of possiblePaths) {
      try {
        const files = await fs.readdir(basePath, { recursive: true })
        const dbFiles = files.filter(file => 
          file.endsWith('.ofocus') || 
          file.endsWith('.xml') || 
          file.includes('OmniFocusDatabase')
        )
        
        if (dbFiles.length > 0) {
          return {
            found: true,
            path: basePath,
            files: dbFiles
          }
        }
      } catch (err) {
        // Path doesn't exist, continue
      }
    }
    
    return { found: false }
  } catch (error) {
    console.error('Database path search error:', error)
    return { found: false }
  }
})

ipcMain.handle('file:select-omnifocus-database', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select OmniFocus Database',
      filters: [
        { name: 'OmniFocus Database', extensions: ['ofocus', 'xml', 'sqlite'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      const fileContent = await fs.readFile(filePath)
      return {
        success: true,
        path: filePath,
        content: fileContent
      }
    }
    
    return { success: false }
  } catch (error) {
    console.error('File selection error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('file:read-database', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath)
    return {
      success: true,
      content: content
    }
  } catch (error) {
    console.error('File read error:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

// IPC handler for opening external URLs (e.g., Notion deep links)
ipcMain.handle('open-external-url', async (event, url) => {
  try {
    // Validate URL before opening
    if (!url || typeof url !== 'string') {
      return {
        success: false,
        error: 'Invalid URL: URL must be a non-empty string'
      }
    }

    // Parse URL to validate format
    let urlObj
    try {
      urlObj = new URL(url)
    } catch (urlError) {
      return {
        success: false,
        error: `Invalid URL format: ${url}`
      }
    }

    // Security: Only allow https://, http://, notion://, and omnifocus:// protocols
    if (!['http:', 'https:', 'notion:', 'omnifocus:'].includes(urlObj.protocol)) {
      return {
        success: false,
        error: `Unsupported protocol: ${urlObj.protocol}. Only http://, https://, notion://, and omnifocus:// are allowed.`
      }
    }

    // Open URL in default browser
    console.log(`Opening external URL: ${url}`)
    await shell.openExternal(url)
    
    return {
      success: true,
      url: url
    }
  } catch (error) {
    console.error('Error opening external URL:', error)
    return {
      success: false,
      error: error.message || 'Failed to open URL'
    }
  }
})

// IPC handler for opening OmniFocus projects via deep links
ipcMain.handle('omnifocus:open-project', async (event, projectId) => {
  try {
    // Validate projectId
    if (!projectId || typeof projectId !== 'string') {
      return {
        success: false,
        error: 'Invalid project ID: Project ID must be a non-empty string'
      }
    }

    // Construct OmniFocus deep link URL
    const omnifocusUrl = `omnifocus:///task/${projectId}`
    
    console.log(`Opening OmniFocus project: ${omnifocusUrl}`)
    
    // Use the existing open-external-url handler which now supports omnifocus://
    const result = await shell.openExternal(omnifocusUrl)
    
    return {
      success: true,
      projectId: projectId,
      url: omnifocusUrl
    }
  } catch (error) {
    console.error('Error opening OmniFocus project:', error)
    return {
      success: false,
      error: error.message || 'Failed to open OmniFocus project'
    }
  }
})

// IPC handlers for Notion sync
// This handler receives formatted markdown from the renderer and appends it to Notion
ipcMain.handle('notion:sync-review', async (event, projectId, weekOf, formattedMarkdown) => {
  try {
    console.log(`🔄 Notion sync requested for project ${projectId}, week ${weekOf}`)
    
    // Check if Notion is configured
    const notionToken = process.env.NOTION_TOKEN
    const notionDb = process.env.NOTION_PROJECT_DB
    
    if (!notionToken || !notionDb) {
      console.log('⏭️ Notion sync disabled: environment variables not set')
      return {
        success: false,
        skipped: true,
        reason: 'Notion not configured'
      }
    }
    
    // Import Notion client dynamically (only when needed)
    const { Client } = require('@notionhq/client')
    const notion = new Client({ auth: notionToken })
    
    try {
      // Step 1: Find Notion page by project ID
      const response = await notion.databases.query({
        database_id: notionDb,
        filter: {
          property: 'OF-ID',
          rich_text: {
            equals: projectId
          }
        },
        page_size: 1
      })
      
      if (response.results.length === 0) {
        console.log(`⏭️ No Notion page found for project ${projectId}`)
        return {
          success: false,
          skipped: true,
          reason: 'No Notion page found for project'
        }
      }
      
      const pageId = response.results[0].id
      console.log(`✅ Found Notion page ${pageId} for project ${projectId}`)
      
      // Step 2: Check for duplicate week
      // Notion API returns 100 blocks per page, so we need to paginate
      const weekString = `Week of ${weekOf}`
      let hasMore = true
      let startCursor = undefined
      let blocksChecked = 0
      const MAX_BLOCKS_TO_CHECK = 200 // Check last 200 blocks (should cover recent reviews)
      
      while (hasMore && blocksChecked < MAX_BLOCKS_TO_CHECK) {
        const response = await notion.blocks.children.list({ 
          block_id: pageId,
          start_cursor: startCursor,
          page_size: 100
        })
        
        // Check this page of blocks for duplicate
        for (const block of response.results) {
          if (block.type === 'paragraph' && block.paragraph?.rich_text) {
            for (const richText of block.paragraph.rich_text) {
              if (richText.plain_text && richText.plain_text.includes(weekString)) {
                console.log(`⏭️ Review for ${weekOf} already exists (found in block ${blocksChecked}), skipping`)
                return {
                  success: true,
                  skipped: true,
                  reason: 'Review already exists for this week'
                }
              }
            }
          }
        }
        
        blocksChecked += response.results.length
        hasMore = response.has_more
        startCursor = response.next_cursor
      }
      
      console.log(`✅ No duplicate found (checked ${blocksChecked} blocks), proceeding with sync`)
      
      // Step 3: Convert markdown to Notion blocks
      const blocks = []
      const lines = formattedMarkdown.split('\n')
      
      for (const line of lines) {
        const trimmed = line.trim()
        
        if (!trimmed) continue
        
        if (trimmed === '---') {
          blocks.push({ object: 'block', type: 'divider', divider: {} })
        } else {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: line } }]
            }
          })
        }
      }
      
      // Step 4: Append blocks to Notion page
      // Notion API limits to 100 blocks per request, so batch if needed
      if (blocks.length > 0) {
        const BATCH_SIZE = 100
        const totalBatches = Math.ceil(blocks.length / BATCH_SIZE)
        
        console.log(`📦 Appending ${blocks.length} blocks in ${totalBatches} batch(es)...`)
        
        for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
          const batch = blocks.slice(i, i + BATCH_SIZE)
          const batchNum = Math.floor(i / BATCH_SIZE) + 1
          
          console.log(`📦 Appending batch ${batchNum}/${totalBatches} (${batch.length} blocks)...`)
          
          await notion.blocks.children.append({
            block_id: pageId,
            children: batch
          })
          
          console.log(`✅ Batch ${batchNum}/${totalBatches} appended successfully`)
        }
        
        console.log(`✅ Successfully synced all ${blocks.length} blocks to Notion page ${pageId}`)
      }
      
      return {
        success: true,
        message: `Synced ${blocks.length} blocks to Notion in ${Math.ceil(blocks.length / 100)} batch(es)`
      }
    } catch (notionError) {
      console.error('❌ Notion API error:', notionError)
      return {
        success: false,
        error: notionError.message || 'Notion API error'
      }
    }
  } catch (error) {
    console.error('❌ Error in Notion sync handler:', error)
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
})

ipcMain.handle('notion:move-to-database', async (event, ofProjectId, targetDatabaseId, projectData) => {
  try {
    console.log(`Moving project ${ofProjectId} to database ${targetDatabaseId}`)
    
    // Check if Notion sync is configured
    const notionToken = process.env.NOTION_TOKEN
    const projectDb = process.env.NOTION_PROJECT_DB
    
    if (!notionToken || !projectDb) {
      console.log('⏭️ Notion not configured, skipping move')
      return {
        success: false,
        error: 'Notion not configured. Set NOTION_TOKEN and NOTION_PROJECT_DB environment variables.'
      }
    }
    
    if (!targetDatabaseId) {
      return {
        success: false,
        error: 'Target database ID not configured'
      }
    }
    
    // Import Notion client
    const { Client } = await import('@notionhq/client')
    const notion = new Client({ auth: notionToken })
    
    // Step 1: Find the Notion page in Active Projects database by OF-ID
    console.log(`🔍 Finding Notion page for OmniFocus project ${ofProjectId}...`)
    const findResponse = await notion.databases.query({
      database_id: projectDb,
      filter: {
        property: 'OF-ID',
        rich_text: {
          equals: ofProjectId
        }
      },
      page_size: 1
    })
    
    if (!findResponse.results || findResponse.results.length === 0) {
      console.log(`⏭️ No Notion page found for project ${ofProjectId}`)
      return {
        success: false,
        error: `No Notion page found for project ${ofProjectId}`
      }
    }
    
    const pageId = findResponse.results[0].id
    console.log(`✅ Found Notion page: ${pageId}`)
    
    // Step 2: Check if page already exists in target database (avoid duplicates)
    console.log(`🔍 Checking for duplicates in target database...`)
    const existingCheck = await notion.databases.query({
      database_id: targetDatabaseId,
      filter: {
        property: 'OF-ID',
        rich_text: {
          equals: ofProjectId
        }
      }
    })
    
    if (existingCheck.results && existingCheck.results.length > 0) {
      console.log(`Project ${ofProjectId} already exists in target database - skipping duplicate`)
      // Archive the original
      await notion.pages.update({ page_id: pageId, archived: true })
      return {
        success: true,
        message: 'Project already in target database, original archived'
      }
    }
    
    // Step 3: Fetch the original page to get its properties
    console.log(`📄 Fetching original page properties...`)
    const originalPage = await notion.pages.retrieve({ page_id: pageId })
    
    // Build properties for the new page
    const properties = {
      Name: originalPage.properties.Name || { title: [{ text: { content: projectData?.name || 'Archived Project' } }] }
    }
    
    // Copy other properties if they exist
    if (originalPage.properties['OF-ID']) {
      properties['OF-ID'] = originalPage.properties['OF-ID']
    }
    if (originalPage.properties.Status || projectData?.status) {
      properties.Status = projectData?.status 
        ? { select: { name: projectData.status } }
        : originalPage.properties.Status
    }
    if (originalPage.properties.Note) {
      properties.Note = originalPage.properties.Note
    }
    if (originalPage.properties['Last edit']) {
      properties['Last edit'] = originalPage.properties['Last edit']
    }
    if (originalPage.properties['OmniFocus Link']) {
      properties['OmniFocus Link'] = originalPage.properties['OmniFocus Link']
    }
    if (originalPage.properties['Sync Hash']) {
      properties['Sync Hash'] = originalPage.properties['Sync Hash']
    }
    
    // Step 4: Fetch all blocks from the original page
    console.log(`📄 Fetching all blocks from original page...`)
    const blocksResponse = await notion.blocks.children.list({
      block_id: pageId
    })
    
    console.log(`📄 Found ${blocksResponse.results.length} blocks to copy`)
    
    // Create new page in target database
    const newPage = await notion.pages.create({
      parent: { database_id: targetDatabaseId },
      properties: properties
    })
    
    console.log(`✅ Created copy in target database: ${newPage.id}`)
    
    // Step 5: Copy all blocks to the new page
    if (blocksResponse.results.length > 0) {
      console.log(`📄 Copying ${blocksResponse.results.length} blocks to new page...`)
      
      // Notion API limits to 100 blocks per request, so we need to batch them
      const batchSize = 100
      const blocks = blocksResponse.results
      
      for (let i = 0; i < blocks.length; i += batchSize) {
        const batch = blocks.slice(i, i + batchSize)
        console.log(`📄 Copying batch ${Math.floor(i / batchSize) + 1} (${batch.length} blocks)`)
        
        await notion.blocks.children.append({
          block_id: newPage.id,
          children: batch
        })
      }
      
      console.log(`✅ Successfully copied all blocks to new page`)
    }
    
    // Archive the original page from Active Projects
    await notion.pages.update({ page_id: pageId, archived: true })
    
    console.log(`✅ Archived original page: ${pageId}`)
    
    return {
      success: true,
      oldPageId: pageId,
      newPageId: newPage.id,
      message: `Moved to target database`
    }
  } catch (error) {
    console.error('❌ Error moving page to database:', error)
    return {
      success: false,
      error: error.message || 'Unknown error moving page'
    }
  }
})

// Append tasks log to a Notion page before moving to Someday/Maybe
ipcMain.handle('notion:append-tasks-log', async (event, pageId, tasks) => {
  try {
    console.log(`Appending tasks log to page ${pageId} with ${tasks.length} tasks`)
    
    // Check if Notion sync is configured
    const notionToken = process.env.NOTION_TOKEN
    
    if (!notionToken) {
      console.log('⏭️ Notion not configured, skipping tasks log')
      return {
        success: false,
        error: 'Notion not configured. Set NOTION_TOKEN environment variable.'
      }
    }
    
    if (!pageId || !tasks || !Array.isArray(tasks)) {
      return {
        success: false,
        error: 'Invalid parameters: pageId and tasks array required'
      }
    }
    
    // Import Notion client
    const { Client } = await import('@notionhq/client')
    const notion = new Client({ auth: notionToken })
    
    // Format tasks as Notion blocks
    const blocks = []
    
    // Add heading
    blocks.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Tasks at time of archiving' } }]
      }
    })
    
    // Add timestamp
    const now = new Date()
    const timestamp = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ 
          type: 'text', 
          text: { content: `Archived on: ${timestamp}` },
          annotations: { italic: true }
        }]
      }
    })
    
    // Add empty line
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [] }
    })
    
    // Add tasks as bulleted list
    for (const task of tasks) {
      const taskText = []
      
      // Task name
      taskText.push(task.name || 'Unnamed task')
      
      // Add due date if present
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate)
        const formattedDate = dueDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })
        taskText.push(`(Due: ${formattedDate})`)
      }
      
      // Add tags if present
      if (task.tags && task.tags.length > 0) {
        taskText.push(`(Tags: ${task.tags.join(', ')})`)
      }
      
      // Add completion status
      if (task.completed) {
        taskText.push('(Completed)')
      }
      
      const taskContent = taskText.join(' ')
      
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: taskContent } }]
        }
      })
    }
    
    // Append blocks to the page
    await notion.blocks.children.append({
      block_id: pageId,
      children: blocks
    })
    
    console.log(`✅ Successfully appended tasks log to page ${pageId}`)
    
    return {
      success: true,
      message: `Appended ${tasks.length} tasks to page`
    }
  } catch (error) {
    console.error('❌ Error appending tasks log:', error)
    return {
      success: false,
      error: error.message || 'Unknown error appending tasks log'
    }
  }
})

// Find Notion page ID by OmniFocus project ID
ipcMain.handle('notion:find-page-by-project-id', async (event, projectId) => {
  try {
    console.log(`Finding Notion page for project ${projectId}`)
    
    // Check if Notion sync is configured
    const notionToken = process.env.NOTION_TOKEN
    const projectDb = process.env.NOTION_PROJECT_DB
    
    if (!notionToken || !projectDb) {
      console.log('⏭️ Notion not configured, cannot find page')
      return {
        success: false,
        error: 'Notion not configured. Set NOTION_TOKEN and NOTION_PROJECT_DB environment variables.'
      }
    }
    
    if (!projectId) {
      return {
        success: false,
        error: 'Project ID is required'
      }
    }
    
    // Import Notion client
    const { Client } = await import('@notionhq/client')
    const notion = new Client({ auth: notionToken })
    
    // Query database filtering by OF-ID property
    const response = await notion.databases.query({
      database_id: projectDb,
      filter: {
        property: 'OF-ID',
        rich_text: {
          equals: projectId
        }
      },
      page_size: 1
    })
    
    if (!response.results || response.results.length === 0) {
      console.log(`📄 No Notion page found for project: ${projectId}`)
      return {
        success: true,
        pageId: null,
        message: 'No Notion page found for project'
      }
    }
    
    if (response.results.length > 1) {
      console.warn(`⚠️ Multiple Notion pages found for project ${projectId}, using first one`)
    }
    
    const pageId = response.results[0].id
    console.log(`✅ Found Notion page ${pageId} for project ${projectId}`)
    
    return {
      success: true,
      pageId: pageId,
      message: 'Notion page found'
    }
  } catch (error) {
    console.error(`❌ Error finding Notion page for project ${projectId}:`, error)
    return {
      success: false,
      error: error.message || 'Unknown error finding Notion page'
    }
  }
})

ipcMain.handle('notion:is-configured', async () => {
  try {
    const notionToken = process.env.NOTION_TOKEN
    const notionDb = process.env.NOTION_PROJECT_DB
    const archiveDb = process.env.NOTION_ARCHIVE_DB
    const somedayDb = process.env.NOTION_SOMEDAY_DB
    
    console.log('[notion:is-configured] Checking environment variables:')
    console.log(`  NOTION_TOKEN: ${notionToken ? 'Set' : 'Not set'}`)
    console.log(`  NOTION_PROJECT_DB: ${notionDb ? 'Set' : 'Not set'}`)
    console.log(`  NOTION_ARCHIVE_DB: ${archiveDb ? archiveDb : 'Not set'}`)
    console.log(`  NOTION_SOMEDAY_DB: ${somedayDb ? somedayDb : 'Not set'}`)
    
    return {
      configured: !!(notionToken && notionDb),
      hasToken: !!notionToken,
      hasDatabase: !!notionDb,
      archiveDb: archiveDb || null,
      somedayDb: somedayDb || null
    }
  } catch (error) {
    console.error('Error checking Notion configuration:', error)
    return {
      configured: false,
      error: error.message
    }
  }
})

// Handle external links
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault()
    shell.openExternal(navigationUrl)
  })
})

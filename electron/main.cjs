const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs').promises
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

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
          context: null,
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
            // Get the first tag as the context
            const firstTag = tags[0];
            const tagName = firstTag.name();
            if (tagName) {
              taskObj.context = tagName;
              console.log('DEBUG: Task "' + task.name() + '" has tag/context: ' + tagName);
            }
          } else {
            console.log('DEBUG: Task "' + task.name() + '" has no tags');
          }
        } catch (e) { 
          console.log('DEBUG: Error getting tags for task ' + task.name() + ': ' + e.message);
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
    taskData.push({
      id: task.id(),
      name: task.name(),
      status: task.status(),
      dueDate: task.dueDate() ? task.dueDate().toISOString() : null,
      deferDate: task.deferDate() ? task.deferDate().toISOString() : null,
      context: task.primaryTag() ? task.primaryTag().name() : null,
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
    // Build JXA script dynamically based on updates
    const tempJxaPath = path.join(require('os').tmpdir(), 'update_project_jxa.js')
    
    let updateLogic = ''
    
    if (updates.name) {
      updateLogic += `targetProject.name = '${updates.name.replace(/'/g, "\\'")}';\n`
    }
    
    if (updates.status) {
      // Use proper API methods for status changes
      if (updates.status === 'dropped') {
        updateLogic += `targetProject.markDropped();\n`
      } else if (updates.status === 'on_hold') {
        // Note: There may not be a markOnHold() method, so we might need to keep property assignment for this
        updateLogic += `// Note: Setting on hold status - verify if method exists\ntargetProject.status = of.Project.Status.OnHold;\n`
      } else if (updates.status === 'active') {
        // Reactivate by clearing dropped/on-hold status
        updateLogic += `// Note: Reactivating project\ntargetProject.status = of.Project.Status.Active;\n`
      }
    }
    
    if (updates.flagged !== undefined) {
      updateLogic += `targetProject.flagged = ${updates.flagged};\n`
    }
    
    if (updates.estimatedMinutes) {
      updateLogic += `targetProject.estimatedMinutes = ${updates.estimatedMinutes};\n`
    }
    
    if (updates.notes) {
      updateLogic += `targetProject.note = '${updates.notes.replace(/'/g, "\\'")}';\n`
    }
    
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

${updateLogic}

JSON.stringify({ success: true });`
    
    await fs.writeFile(tempJxaPath, jxaScript)
    const { stdout, stderr } = await execAsync(`osascript -l JavaScript "${tempJxaPath}"`)
    
    // Clean up
    try {
      await fs.unlink(tempJxaPath)
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary JXA file:', cleanupError.message)
    }
    
    if (stderr) {
      console.error('JXA stderr:', stderr)
      return false
    }
    
    return true
  } catch (error) {
    console.error('JXA update error:', error)
    return false
  }
})

ipcMain.handle('omnifocus:mark-project-complete', async (event, projectId) => {
  try {
    console.log(`Marking project ${projectId} as complete`)
    
    // First check if OmniFocus is running
    const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
    const { stdout: isRunningOutput } = await execAsync(`osascript -e '${checkScript}'`)
    
    if (!isRunningOutput.trim().toLowerCase().includes('true')) {
      return { success: false, error: 'OmniFocus is not running. Please start OmniFocus and try again.' }
    }
    
    // Create temporary JXA script for marking project as complete
    const tempJxaPath = path.join(require('os').tmpdir(), 'mark_project_complete_jxa.js')
    const jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;

// Find the project by ID
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

// Mark project as complete using the proper API method
targetProject.markComplete();

// Return success
JSON.stringify({
  success: true,
  projectId: targetProject.id(),
  completed: targetProject.completed()
});`
    
    // Write the JXA script to temporary file
    await fs.writeFile(tempJxaPath, jxaScript)
    
    // Execute the JXA script
    const { stdout: resultOutput, stderr } = await execAsync(`osascript -l JavaScript "${tempJxaPath}"`)
    
    // Clean up temporary file
    try {
      await fs.unlink(tempJxaPath)
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary JXA file:', cleanupError.message)
    }
    
    if (stderr) {
      console.error('JXA stderr:', stderr)
      return { success: false, error: stderr }
    }
    
    console.log('✅ Project marked as complete:', resultOutput)
    const result = JSON.parse(resultOutput)
    return result
  } catch (error) {
    console.error('Error marking project as complete:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('omnifocus:drop-project', async (event, projectId) => {
  try {
    console.log(`Dropping project ${projectId}`)
    
    // First check if OmniFocus is running
    const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
    const { stdout: isRunningOutput } = await execAsync(`osascript -e '${checkScript}'`)
    
    if (!isRunningOutput.trim().toLowerCase().includes('true')) {
      return { success: false, error: 'OmniFocus is not running. Please start OmniFocus and try again.' }
    }
    
    // Create temporary JXA script for dropping project
    const tempJxaPath = path.join(require('os').tmpdir(), 'drop_project_jxa.js')
    const jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;

// Find the project by ID
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

// Drop the project using the proper API method
// In OmniFocus 4, use markDropped() method instead of setting status property
try {
  targetProject.markDropped();
} catch (e) {
  // If markDropped doesn't exist, try the property (for older versions)
  targetProject.status = of.ProjectStatus.dropped;
}

// Return success
JSON.stringify({
  success: true,
  projectId: targetProject.id(),
  status: 'dropped'
});`
    
    // Write the JXA script to temporary file
    await fs.writeFile(tempJxaPath, jxaScript)
    
    // Execute the JXA script
    const { stdout: resultOutput, stderr } = await execAsync(`osascript -l JavaScript "${tempJxaPath}"`)
    
    // Clean up temporary file
    try {
      await fs.unlink(tempJxaPath)
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary JXA file:', cleanupError.message)
    }
    
    if (stderr) {
      console.error('JXA stderr:', stderr)
      return { success: false, error: stderr }
    }
    
    console.log('✅ Project dropped:', resultOutput)
    const result = JSON.parse(resultOutput)
    return result
  } catch (error) {
    console.error('Error dropping project:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('omnifocus:mark-project-reviewed', async (event, projectId) => {
  try {
    console.log(`Marking project ${projectId} as reviewed`)
    
    // First check if OmniFocus is running
    const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
    const { stdout: isRunningOutput } = await execAsync(`osascript -e '${checkScript}'`)
    
    if (!isRunningOutput.trim().toLowerCase().includes('true')) {
      return { success: false, error: 'OmniFocus is not running. Please start OmniFocus and try again.' }
    }
    
    // Create temporary JXA script for marking project as reviewed
    const tempJxaPath = path.join(require('os').tmpdir(), 'mark_project_reviewed_jxa.js')
    const jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;

// Find the project by ID
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

// Mark as reviewed by setting lastReviewDate directly
// Note: markReviewed() method throws "Can't convert types" error in OF4
targetProject.lastReviewDate = new Date();

// Return success with updated dates
JSON.stringify({
  success: true,
  projectId: targetProject.id(),
  lastReviewDate: targetProject.lastReviewDate() ? targetProject.lastReviewDate().toISOString() : null,
  nextReviewDate: targetProject.nextReviewDate() ? targetProject.nextReviewDate().toISOString() : null
});`
    
    // Write the JXA script to temporary file
    await fs.writeFile(tempJxaPath, jxaScript)
    
    // Execute the JXA script
    const { stdout: resultOutput, stderr } = await execAsync(`osascript -l JavaScript "${tempJxaPath}"`)
    
    // Clean up temporary file
    try {
      await fs.unlink(tempJxaPath)
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary JXA file:', cleanupError.message)
    }
    
    if (stderr) {
      console.error('JXA stderr:', stderr)
      return { success: false, error: stderr }
    }
    
    if (!resultOutput || resultOutput.trim() === '') {
      return { success: false, error: 'No output from JXA script' }
    }
    
    // Parse the JSON result
    try {
      const result = JSON.parse(resultOutput.trim())
      console.log('Project marked as reviewed:', result)
      return result
    } catch (parseError) {
      console.error('Failed to parse JXA output:', parseError)
      return { success: false, error: 'Failed to parse result' }
    }
    
  } catch (error) {
    console.error('Error marking project as reviewed:', error)
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

// IPC handler for setting context on a task
ipcMain.handle('omnifocus:set-task-context', async (event, taskId, contextName) => {
  try {
    console.log(`[OmniFocus] set-task-context called for task ${taskId} with context "${contextName}"`)
    
    // First check if OmniFocus is running
    const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
    const { stdout: isRunningOutput } = await execAsync(`osascript -e '${checkScript}'`)
    
    if (!isRunningOutput.trim().toLowerCase().includes('true')) {
      return { success: false, error: 'OmniFocus is not running. Please start OmniFocus and try again.' }
    }
    
    // OPTIMIZATION: Skip JXA entirely for context/tag setting - OmniFocus 4 JXA can't handle them
    // Go directly to AppleScript for better performance
    console.log('[OmniFocus] Using direct AppleScript for context setting (JXA not supported in OmniFocus 4)')
    
    try {
      const appleScript = `tell application "OmniFocus"
  tell default document
    set theTask to first flattened task whose id is "${taskId}"
    set theTag to first flattened tag whose name is "${contextName.replace(/'/g, "\\'")}"
    set primary tag of theTask to theTag
  end tell
end tell`
      
      console.log('[OmniFocus] Setting context to:', contextName)
      await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`)
      console.log('Context set via AppleScript')
      return { success: true, taskId, contextName }
    } catch (asError) {
      console.error('AppleScript context setting failed:', asError)
      return { success: false, error: `AppleScript failed: ${asError.message}` }
    }
    
  } catch (error) {
    console.error('Error setting task context:', error)
    return { success: false, error: error.message }
  }
})

// IPC handler for setting due date on a task
ipcMain.handle('omnifocus:set-task-due-date', async (event, taskId, dueDate) => {
  try {
    console.log(`Setting due date "${dueDate}" on task ${taskId}`)
    
    // First check if OmniFocus is running
    const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
    const { stdout: isRunningOutput, stderr: checkStderr } = await execAsync(`osascript -e '${checkScript}'`)
    
    if (checkStderr) {
      console.error('[OmniFocus] Error checking if OmniFocus is running:', checkStderr)
    }
    
    if (!isRunningOutput.trim().toLowerCase().includes('true')) {
      return { success: false, error: 'OmniFocus is not running. Please start OmniFocus and try again.' }
    }
    
    // Use JXA with proper OmniFocus 4 API methods (setDueDate/clearDueDate)
    console.log('[OmniFocus] Using JXA with setDueDate/clearDueDate methods for OmniFocus 4')
    
    // Create temporary JXA script
    const tempJxaPath = path.join(require('os').tmpdir(), 'set_task_due_date_jxa.js')
    
    // Format date for JXA Date constructor
    let jxaScript
    if (dueDate) {
      const dateObj = new Date(dueDate)
      // Use milliseconds since epoch - more reliable in JXA
      const milliseconds = dateObj.getTime()
      console.log('[OmniFocus] Setting due date:', dateObj.toISOString(), `(${milliseconds} ms)`)
      
      jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;

// Find the task by ID
const tasks = doc.flattenedTasks();
let targetTask = null;

for (let i = 0; i < tasks.length; i++) {
  if (tasks[i].id() === '${taskId}') {
    targetTask = tasks[i];
    break;
  }
}

if (!targetTask) {
  throw new Error('Task not found with ID: ${taskId}');
}

// Set due date using direct property assignment
// Note: setDueDate() method throws "Can't convert types" error in OF4 JXA
// Use direct property assignment instead (similar to lastReviewDate)
const dueDateObj = new Date(${milliseconds});
targetTask.dueDate = dueDateObj;

// Return success with updated due date
JSON.stringify({
  success: true,
  taskId: targetTask.id(),
  dueDate: targetTask.dueDate() ? targetTask.dueDate().toISOString() : null
});`
    } else {
      console.log('[OmniFocus] Clearing due date')
      
      jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;

// Find the task by ID
const tasks = doc.flattenedTasks();
let targetTask = null;

for (let i = 0; i < tasks.length; i++) {
  if (tasks[i].id() === '${taskId}') {
    targetTask = tasks[i];
    break;
  }
}

if (!targetTask) {
  throw new Error('Task not found with ID: ${taskId}');
}

// Clear due date using direct property assignment
// Note: clearDueDate() method may throw "Can't convert types" error in OF4 JXA
// Use direct property assignment instead
targetTask.dueDate = null;

// Return success
JSON.stringify({
  success: true,
  taskId: targetTask.id(),
  dueDate: null
});`
    }
    
    // Write the JXA script to temporary file
    await fs.writeFile(tempJxaPath, jxaScript)
    
    // Execute the JXA script and capture both stdout and stderr
    const { stdout: resultOutput, stderr } = await execAsync(`osascript -l JavaScript "${tempJxaPath}"`)
    
    // Clean up temporary file
    try {
      await fs.unlink(tempJxaPath)
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary JXA file:', cleanupError.message)
    }
    
    // Check for errors in stderr
    if (stderr) {
      console.error('[OmniFocus] JXA stderr when setting due date:', stderr)
      return { success: false, error: `Failed to set due date: ${stderr}` }
    }
    
    // Parse the JSON result
    if (!resultOutput || resultOutput.trim() === '') {
      return { success: false, error: 'No output from JXA script' }
    }
    
    try {
      const result = JSON.parse(resultOutput.trim())
      console.log('[OmniFocus] Due date operation successful:', result)
      return { success: true, taskId: result.taskId, dueDate: result.dueDate }
    } catch (parseError) {
      console.error('[OmniFocus] Failed to parse JXA output:', parseError)
      console.error('[OmniFocus] Raw output:', resultOutput)
      return { success: false, error: `Failed to parse result: ${parseError.message}` }
    }
    
  } catch (error) {
    console.error('Error setting task due date:', error)
    // Include stderr if available
    const errorMessage = error.stderr ? `${error.message}\nstderr: ${error.stderr}` : error.message
    return { success: false, error: errorMessage }
  }
})

// IPC handler for toggling task completion
ipcMain.handle('omnifocus:toggle-task-completion', async (event, taskId, isComplete) => {
  try {
    console.log(`Setting task ${taskId} completion to ${isComplete}`)
    
    // First check if OmniFocus is running
    const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
    const { stdout: isRunningOutput } = await execAsync(`osascript -e '${checkScript}'`)
    
    if (!isRunningOutput.trim().toLowerCase().includes('true')) {
      return { success: false, error: 'OmniFocus is not running. Please start OmniFocus and try again.' }
    }
    
    // Create temporary JXA script for toggling completion
    const tempJxaPath = path.join(require('os').tmpdir(), 'toggle_task_completion_jxa.js')
    const jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;

// Find the task by ID
const tasks = doc.flattenedTasks();
let targetTask = null;

for (let i = 0; i < tasks.length; i++) {
  if (tasks[i].id() === '${taskId}') {
    targetTask = tasks[i];
    break;
  }
}

if (!targetTask) {
  throw new Error('Task not found');
}

// Toggle completion using OmniFocus 4 API methods
if (${isComplete}) {
  targetTask.markComplete();
} else {
  targetTask.markIncomplete();
}

// Return success
JSON.stringify({
  success: true,
  taskId: targetTask.id(),
  completed: targetTask.completed(),
  completionDate: targetTask.completionDate() ? targetTask.completionDate().toISOString() : null
});`
    
    // Write the JXA script to temporary file
    await fs.writeFile(tempJxaPath, jxaScript)
    
    // Execute the JXA script
    const { stdout: resultOutput, stderr } = await execAsync(`osascript -l JavaScript "${tempJxaPath}"`)
    
    // Clean up temporary file
    try {
      await fs.unlink(tempJxaPath)
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary JXA file:', cleanupError.message)
    }
    
    if (stderr) {
      console.error('JXA stderr:', stderr)
      return { success: false, error: stderr }
    }
    
    if (!resultOutput || resultOutput.trim() === '') {
      return { success: false, error: 'No output from JXA script' }
    }
    
    // Parse the JSON result
    try {
      const result = JSON.parse(resultOutput.trim())
      console.log('Task completion toggled successfully:', result)
      return result
    } catch (parseError) {
      console.error('Failed to parse JXA output:', parseError)
      return { success: false, error: 'Failed to parse result' }
    }
    
  } catch (error) {
    console.error('Error toggling task completion:', error)
    return { success: false, error: error.message }
  }
})

// IPC handler for updating task properties (comprehensive update)
ipcMain.handle('omnifocus:update-task', async (event, taskId, updates) => {
  try {
    // Write debug info to file for compiled app debugging
    const debugLog = `
=== TASK UPDATE DEBUG ${new Date().toISOString()} ===
Task ID: ${taskId}
Full updates: ${JSON.stringify(updates, null, 2)}
updates.context: ${updates.context}
updates.completed: ${updates.completed}
updates.completed type: ${typeof updates.completed}
updates.completed === undefined: ${updates.completed === undefined}
updates.completed === false: ${updates.completed === false}
updates.completed === null: ${updates.completed === null}
"completed" in updates: ${"completed" in updates}
"context" in updates: ${"context" in updates}
Context condition: ${updates.context !== undefined && (updates.completed === undefined || updates.completed === false)}
=== END DEBUG ===
`;
    
    try {
      require('fs').appendFileSync(require('path').join(require('os').homedir(), 'omnifocus-debug.log'), debugLog);
    } catch (e) {
      console.error('Failed to write debug log:', e);
    }
    
    console.log(`[OmniFocus] === TASK UPDATE DEBUG ===`)
    console.log(`[OmniFocus] Task ID: ${taskId}`)
    console.log(`[OmniFocus] Full updates object:`, JSON.stringify(updates, null, 2))
    console.log(`[OmniFocus] updates.context:`, updates.context)
    console.log(`[OmniFocus] updates.completed:`, updates.completed)
    console.log(`[OmniFocus] updates.completed type:`, typeof updates.completed)
    console.log(`[OmniFocus] updates.completed === undefined:`, updates.completed === undefined)
    console.log(`[OmniFocus] updates.completed === false:`, updates.completed === false)
    console.log(`[OmniFocus] updates.completed === null:`, updates.completed === null)
    console.log(`[OmniFocus] "completed" in updates:`, "completed" in updates)
    console.log(`[OmniFocus] "context" in updates:`, "context" in updates)
    console.log(`[OmniFocus] Context condition check:`, updates.context !== undefined && (updates.completed === undefined || updates.completed === false))
    console.log(`[OmniFocus] === END DEBUG ===`)

    // First check if OmniFocus is running
    const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
    const { stdout: isRunningOutput } = await execAsync(`osascript -e '${checkScript}'`)
    
    if (!isRunningOutput.trim().toLowerCase().includes('true')) {
      return { success: false, error: 'OmniFocus is not running. Please start OmniFocus and try again.' }
    }
    
    // Build JXA script dynamically based on what needs to be updated
    const tempJxaPath = path.join(require('os').tmpdir(), 'update_task_jxa.js')
    
    // Build update logic and completion logic
    let updateLogic = ''
    let completionLogic = ''
    
    // Ignore completedDate if it's passed - it's read-only in OmniFocus 4
    // The markComplete() method sets it automatically
    if (updates.completedDate !== undefined) {
      console.log('[OmniFocus] Ignoring completedDate (read-only in OmniFocus 4, set automatically by markComplete())')
    }
    
    // Handle completion state separately - must be done LAST
    if (updates.completed !== undefined) {
      // In OmniFocus 4, completed and completionDate are read-only
      // Use markComplete() and markIncomplete() methods instead
      if (updates.completed) {
        completionLogic = `\n// Mark complete (must be done last)\ntargetTask.markComplete();\n`
      } else {
        completionLogic = `\n// Mark incomplete (must be done last)\ntargetTask.markIncomplete();\n`
      }
    }
    
    // OmniFocus 4 constraints:
    // 1. Cannot update completion AND other properties in same operation
    // 2. Cannot update context/tags AND other properties in same operation
    // Only update if we're not changing completion state or context
    if (updates.completed === undefined && updates.context === undefined) {
      if (updates.name !== undefined) {
        updateLogic += `console.log('[JXA] Setting name to:', '${updates.name.replace(/'/g, "\\'")}');\n`
        updateLogic += `targetTask.name = '${updates.name.replace(/'/g, "\\'")}';\n`
        updateLogic += `console.log('[JXA] Name set successfully');\n`
      }
      
      if (updates.note !== undefined) {
        updateLogic += `console.log('[JXA] Setting note');\n`
        updateLogic += `targetTask.note = '${(updates.note || '').replace(/'/g, "\\'")}';\n`
        updateLogic += `console.log('[JXA] Note set successfully');\n`
      }
      
      if (updates.flagged !== undefined) {
        updateLogic += `console.log('[JXA] Setting flagged to:', ${updates.flagged});\n`
        updateLogic += `targetTask.flagged = ${updates.flagged};\n`
        updateLogic += `console.log('[JXA] Flagged set successfully');\n`
      }
      
      // Note: Due date updates are now handled directly with AppleScript below
      // This section is kept for other properties that can be updated via JXA
    }
    
    // OPTIMIZATION: Handle context/tag updates directly with AppleScript for better performance
    const contextCondition = updates.context !== undefined && (updates.completed === undefined || updates.completed === false);
    
    if (contextCondition) {
      console.log('[OmniFocus] Handling context update directly with AppleScript (JXA not supported in OmniFocus 4)')
      
      try {
        if (updates.context) {
          console.log('[OmniFocus] Setting context to:', updates.context)
          const appleScript = `tell application "OmniFocus"
  tell default document
    set theTask to first flattened task whose id is "${taskId}"
    set theTag to first flattened tag whose name is "${updates.context.replace(/'/g, "\\'")}"
    set primary tag of theTask to theTag
  end tell
end tell`
          
          await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`)
          console.log('[OmniFocus] Context set via AppleScript')
        } else {
          console.log('[OmniFocus] Clearing context')
          const appleScript = `tell application "OmniFocus"
  tell default document
    set theTask to first flattened task whose id is "${taskId}"
    set primary tag of theTask to missing value
  end tell
end tell`
          
          await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`)
          console.log('[OmniFocus] Context cleared via AppleScript')
        }
      } catch (asError) {
        console.error('[OmniFocus] AppleScript context update failed:', asError)
        const msg = (asError && asError.message) ? asError.message : ''
        const isTagNotFound = /flattened tag|Invalid index|\(-1719\)/i.test(msg)
        if (isTagNotFound && updates.context) {
          console.log('[OmniFocus] Attempting fuzzy match retry for context:', updates.context)
          // Helper: fetch contexts via temporary JXA script
          const getContexts = async () => {
            const tempJxaPath = path.join(require('os').tmpdir(), 'get_contexts_retry_jxa.js')
            const jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;
let tags = [];
try { tags = doc.flattenedTags(); } catch (e) { try { tags = doc.flattenedContexts(); } catch (e2) {} }
const out = [];
for (let i = 0; i < tags.length; i++) { try { out.push({ id: tags[i].id(), name: tags[i].name() }); } catch (e) {} }
JSON.stringify(out);`
            await fs.writeFile(tempJxaPath, jxaScript)
            const { stdout } = await execAsync(`osascript -l JavaScript "${tempJxaPath}"`)
            try { await fs.unlink(tempJxaPath) } catch {}
            try { return JSON.parse(stdout || '[]') } catch { return [] }
          }
          const normalize = (s) => (s || '').trim().replace(/[\s,]+$/g, '')
          const levenshtein = (a, b) => {
            const m = a.length, n = b.length
            if (!m) return n; if (!n) return m
            const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
            for (let i = 0; i <= m; i++) dp[i][0] = i
            for (let j = 0; j <= n; j++) dp[0][j] = j
            for (let i = 1; i <= m; i++) {
              for (let j = 1; j <= n; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1
                dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost)
              }
            }
            return dp[m][n]
          }
          const bestMatch = (input, list) => {
            const needle = normalize(input).toLowerCase()
            if (!needle) return {}
            const names = list.map(t => ({ id: t.id, name: t.name, lower: (t.name||'').toLowerCase() }))
            const exact = names.find(t => t.lower === needle); if (exact) return { name: exact.name }
            const starts = names.filter(t => t.lower.startsWith(needle)); if (starts.length === 1) return { name: starts[0].name }; if (starts.length > 1) return { ambiguous: true }
            const incl = names.filter(t => t.lower.includes(needle)); if (incl.length === 1) return { name: incl[0].name }; if (incl.length > 1) return { ambiguous: true }
            let best = null, bestDist = Number.MAX_SAFE_INTEGER
            for (const t of names) { const d = levenshtein(needle, t.lower); if (d < bestDist) { bestDist = d; best = t } }
            if (best && bestDist <= 2) return { name: best.name }
            return {}
          }
          try {
            const contexts = await getContexts()
            const { name, ambiguous } = bestMatch(updates.context, contexts)
            if (ambiguous || !name) {
              console.error('[OmniFocus] Fuzzy retry failed: ambiguous or no match')
              return { success: false, error: `Context update failed: ${asError.message}` }
            }
            console.log('[OmniFocus] Fuzzy retry with matched context:', name)
            const retryScript = `tell application "OmniFocus"
  tell default document
    set theTask to first flattened task whose id is "${taskId}"
    set theTag to first flattened tag whose name is "${name.replace(/'/g, "\\'")}"
    set primary tag of theTask to theTag
  end tell
end tell`
            await execAsync(`osascript -e '${retryScript.replace(/'/g, "'\\''")}'`)
            console.log('[OmniFocus] Context set via AppleScript (fuzzy retry)')
          } catch (retryErr) {
            console.error('[OmniFocus] Fuzzy retry failed:', retryErr)
            return { success: false, error: `Context update failed: ${asError.message}` }
          }
        } else {
          return { success: false, error: `Context update failed: ${asError.message}` }
        }
      }
    }
    
    // Handle due date updates with JXA using proper OmniFocus 4 API methods
    // Process due date separately even when context is present (OmniFocus 4 constraint)
    if (updates.dueDate !== undefined) {
      console.log('[OmniFocus] Handling due date update with JXA using setDueDate/clearDueDate methods')
      
      try {
        // Create temporary JXA script
        const tempJxaPath = path.join(require('os').tmpdir(), 'update_task_due_date_jxa.js')
        
        let jxaScript
        if (updates.dueDate) {
          const dateObj = new Date(updates.dueDate)
          // Use milliseconds since epoch - more reliable in JXA
          const milliseconds = dateObj.getTime()
          console.log('[OmniFocus] Setting due date:', dateObj.toISOString(), `(${milliseconds} ms)`)
          
          jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;

// Find the task by ID
const tasks = doc.flattenedTasks();
let targetTask = null;

for (let i = 0; i < tasks.length; i++) {
  if (tasks[i].id() === '${taskId}') {
    targetTask = tasks[i];
    break;
  }
}

if (!targetTask) {
  throw new Error('Task not found with ID: ${taskId}');
}

// Set due date using direct property assignment
// Note: setDueDate() method throws "Can't convert types" error in OF4 JXA
// Use direct property assignment instead (similar to lastReviewDate)
const dueDateObj = new Date(${milliseconds});
targetTask.dueDate = dueDateObj;

// Return success with updated due date
JSON.stringify({
  success: true,
  taskId: targetTask.id(),
  dueDate: targetTask.dueDate() ? targetTask.dueDate().toISOString() : null
});`
        } else {
          console.log('[OmniFocus] Clearing due date')
          
          jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;

// Find the task by ID
const tasks = doc.flattenedTasks();
let targetTask = null;

for (let i = 0; i < tasks.length; i++) {
  if (tasks[i].id() === '${taskId}') {
    targetTask = tasks[i];
    break;
  }
}

if (!targetTask) {
  throw new Error('Task not found with ID: ${taskId}');
}

// Clear due date using direct property assignment
// Note: clearDueDate() method may throw "Can't convert types" error in OF4 JXA
// Use direct property assignment instead
targetTask.dueDate = null;

// Return success
JSON.stringify({
  success: true,
  taskId: targetTask.id(),
  dueDate: null
});`
        }
        
        // Write the JXA script to temporary file
        await fs.writeFile(tempJxaPath, jxaScript)
        
        // Execute the JXA script and capture both stdout and stderr
        const { stdout: resultOutput, stderr } = await execAsync(`osascript -l JavaScript "${tempJxaPath}"`)
        
        // Clean up temporary file
        try {
          await fs.unlink(tempJxaPath)
        } catch (cleanupError) {
          console.warn('Failed to clean up temporary JXA file:', cleanupError.message)
        }
        
        // Check for errors in stderr
        if (stderr) {
          console.error('[OmniFocus] JXA stderr when updating due date:', stderr)
          return { success: false, error: `Due date update failed: ${stderr}` }
        }
        
        // Parse the JSON result
        if (!resultOutput || resultOutput.trim() === '') {
          return { success: false, error: 'No output from JXA script when updating due date' }
        }
        
        try {
          const result = JSON.parse(resultOutput.trim())
          console.log('[OmniFocus] Due date update successful:', result)
        } catch (parseError) {
          console.error('[OmniFocus] Failed to parse JXA output when updating due date:', parseError)
          console.error('[OmniFocus] Raw output:', resultOutput)
          return { success: false, error: `Failed to parse due date update result: ${parseError.message}` }
        }
      } catch (asError) {
        console.error('[OmniFocus] JXA due date update failed:', asError)
        // Include stderr if available
        const errorMessage = asError.stderr ? `${asError.message}\nstderr: ${asError.stderr}` : asError.message
        return { success: false, error: `Due date update failed: ${errorMessage}` }
      }
    }
    
    // Skip main JXA script if there's nothing to update (due date was handled separately)
    // Only execute if we have updateLogic or completionLogic to apply
    if (!updateLogic.trim() && !completionLogic.trim()) {
      console.log('[OmniFocus] No additional updates needed (due date was handled separately)')
      return { success: true, taskId }
    }
    
    const jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;

// Find the task by ID
const tasks = doc.flattenedTasks();
let targetTask = null;

for (let i = 0; i < tasks.length; i++) {
  if (tasks[i].id() === '${taskId}') {
    targetTask = tasks[i];
    break;
  }
}

if (!targetTask) {
  throw new Error('Task not found');
}

// Apply updates
${updateLogic}${completionLogic}

// Return updated task data
// Wrap property reads in try-catch to handle any read errors gracefully
let resultData = {
  success: true,
  taskId: targetTask.id()
};

try {
  resultData.name = targetTask.name();
} catch (e) {
  resultData.name = null;
}

try {
  resultData.note = targetTask.note() || '';
} catch (e) {
  resultData.note = '';
}

try {
  resultData.flagged = targetTask.flagged();
} catch (e) {
  resultData.flagged = false;
}

try {
  const dueDate = targetTask.dueDate();
  resultData.dueDate = dueDate ? dueDate.toISOString() : null;
} catch (e) {
  resultData.dueDate = null;
}

try {
  const primaryTag = targetTask.primaryTag();
  resultData.context = primaryTag ? primaryTag.name() : null;
} catch (e) {
  resultData.context = null;
}

try {
  resultData.completed = targetTask.completed();
} catch (e) {
  resultData.completed = false;
}

try {
  const completionDate = targetTask.completionDate();
  resultData.completionDate = completionDate ? completionDate.toISOString() : null;
} catch (e) {
  resultData.completionDate = null;
}

// Serialize and return the result
JSON.stringify(resultData);`
    
    // Write the JXA script to temporary file
    await fs.writeFile(tempJxaPath, jxaScript)
    
    // Debug: Log the generated JXA script
    const jxaDebug = `
=== GENERATED JXA SCRIPT ===
Script length: ${jxaScript.length}
updateLogic was populated with ${updateLogic.length} chars
completionLogic was populated with ${completionLogic.length} chars
First 500 chars of JXA script:
${jxaScript.substring(0, 500)}
...
Last 500 chars of JXA script:
${jxaScript.substring(jxaScript.length - 500)}
=== END JXA SCRIPT ===
`;
    
    try {
      require('fs').appendFileSync(require('path').join(require('os').homedir(), 'omnifocus-debug.log'), jxaDebug);
    } catch (e) {}
    
    console.log('[OmniFocus] === Generated JXA Script ===')
    console.log(jxaScript)
    console.log('[OmniFocus] === End JXA Script ===')
    
    // Execute the JXA script
    const execDebug = `
=== EXECUTING JXA SCRIPT ===
Script path: ${tempJxaPath}
About to execute...
`;
    
    try {
      require('fs').appendFileSync(require('path').join(require('os').homedir(), 'omnifocus-debug.log'), execDebug);
    } catch (e) {}
    
    let resultOutput, stderr;
    try {
      const result = await execAsync(`osascript -l JavaScript "${tempJxaPath}"`)
      resultOutput = result.stdout
      stderr = result.stderr
      
      const execSuccessLog = `
JXA execution completed without throwing
stdout length: ${resultOutput ? resultOutput.length : 0}
stderr length: ${stderr ? stderr.length : 0}
`;
      
      try {
        require('fs').appendFileSync(require('path').join(require('os').homedir(), 'omnifocus-debug.log'), execSuccessLog);
      } catch (e) {}
    } catch (execError) {
      const execErrorLog = `
JXA execution threw error:
Error message: ${execError.message}
Error code: ${execError.code}
Error stdout: ${execError.stdout || '(none)'}
Error stderr: ${execError.stderr || '(none)'}
Error stack: ${execError.stack || '(none)'}
`;
      
      try {
        require('fs').appendFileSync(require('path').join(require('os').homedir(), 'omnifocus-debug.log'), execErrorLog);
      } catch (e) {}
      
      // Include both stdout and stderr in error message for better debugging
      const errorDetails = []
      if (execError.stdout) {
        errorDetails.push(`stdout: ${execError.stdout}`)
        // If stdout contains console.log output but no actual error, note that
        if (execError.stdout.includes('[JXA]') && !execError.stdout.includes('Error:')) {
          errorDetails.push('(Note: Script executed but may have failed silently - check stderr or JSON parsing)')
        }
      }
      if (execError.stderr) errorDetails.push(`stderr: ${execError.stderr}`)
      if (!execError.stderr && !execError.stdout) {
        errorDetails.push(`(No stdout/stderr captured - error: ${execError.message})`)
      }
      const fullError = errorDetails.length > 0 
        ? `${execError.message}\n${errorDetails.join('\n')}`
        : execError.message
      
      console.error('[OmniFocus] JXA execution error:', fullError)
      console.error('[OmniFocus] Full error object:', JSON.stringify(execError, Object.getOwnPropertyNames(execError)))
      return { success: false, error: fullError }
    }
    
    const execResult = `
=== JXA EXECUTION RESULT ===
stdout: ${resultOutput}
stderr: ${stderr}
=== END EXECUTION RESULT ===
`;
    
    try {
      require('fs').appendFileSync(require('path').join(require('os').homedir(), 'omnifocus-debug.log'), execResult);
    } catch (e) {}
    
    // Clean up temporary file
    try {
      await fs.unlink(tempJxaPath)
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary JXA file:', cleanupError.message)
    }
    
    if (stderr) {
      console.error('[OmniFocus] JXA stderr:', stderr)
      return { success: false, error: stderr }
    }
    
    // Check if stdout contains error indicators (JXA errors sometimes go to stdout)
    if (resultOutput && (resultOutput.includes('Error:') || resultOutput.includes('error:') || resultOutput.includes('SyntaxError') || resultOutput.includes('ReferenceError') || resultOutput.includes('TypeError'))) {
      console.error('[OmniFocus] JXA error detected in stdout:', resultOutput)
      return { success: false, error: resultOutput }
    }
    
    if (!resultOutput || resultOutput.trim() === '') {
      return { success: false, error: 'No output from JXA script' }
    }
    
    // Parse the JSON result
    try {
      const result = JSON.parse(resultOutput.trim())
      console.log('[OmniFocus] Task updated successfully:', result)
      return result
    } catch (parseError) {
      console.error('[OmniFocus] Failed to parse JXA output:', parseError)
      console.error('[OmniFocus] Raw output was:', resultOutput)
      // If parsing fails, check if the output contains error messages
      if (resultOutput.includes('Error:') || resultOutput.includes('error:')) {
        return { success: false, error: resultOutput }
      }
      return { success: false, error: `Failed to parse result: ${parseError.message}. Output: ${resultOutput.substring(0, 500)}` }
    }
    
  } catch (error) {
    console.error('[OmniFocus] Error updating task:', error)
    return { success: false, error: error.message }
  }
})

// IPC handler for getting all contexts/tags from OmniFocus
ipcMain.handle('omnifocus:get-contexts', async () => {
  try {
    console.log('Fetching contexts from OmniFocus')
    
    // First check if OmniFocus is running
    const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
    const { stdout: isRunningOutput } = await execAsync(`osascript -e '${checkScript}'`)
    
    if (!isRunningOutput.trim().toLowerCase().includes('true')) {
      return { success: false, error: 'OmniFocus is not running. Please start OmniFocus and try again.', contexts: [] }
    }
    
    // Create temporary JXA script for fetching contexts
    const tempJxaPath = path.join(require('os').tmpdir(), 'get_contexts_jxa.js')
    const jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;

// Get all tags (OmniFocus 4 renamed contexts to tags)
// Try both methods for compatibility with OF3 and OF4
let tags = [];
try {
  // OmniFocus 4 uses flattenedTags
  tags = doc.flattenedTags();
} catch (e) {
  try {
    // OmniFocus 3 uses flattenedContexts
    tags = doc.flattenedContexts();
  } catch (e2) {
    console.log('Error: Could not get tags/contexts');
  }
}

const tagList = [];

for (let i = 0; i < tags.length; i++) {
  const tag = tags[i];
  try {
    // Filter out inactive/on-hold/dropped tags
    // Only include active tags (status === "active" or available === true)
    let isActive = true;
    
    try {
      // Check if tag has status property (OF4)
      const status = tag.status();
      if (status && status !== 'active') {
        isActive = false;
      }
    } catch (e) {
      // If status() doesn't exist, try available property (OF3)
      try {
        const available = tag.available();
        if (available === false) {
          isActive = false;
        }
      } catch (e2) {
        // If neither exist, assume active
      }
    }
    
    if (isActive) {
      tagList.push({
        id: tag.id(),
        name: tag.name()
      });
    }
  } catch (error) {
    continue;
  }
}

// Return as JSON
JSON.stringify({
  success: true,
  contexts: tagList
});`
    
    // Write the JXA script to temporary file
    await fs.writeFile(tempJxaPath, jxaScript)
    
    // Execute the JXA script
    const { stdout: resultOutput, stderr } = await execAsync(`osascript -l JavaScript "${tempJxaPath}"`)
    
    // Clean up temporary file
    try {
      await fs.unlink(tempJxaPath)
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary JXA file:', cleanupError.message)
    }
    
    if (stderr) {
      console.error('JXA stderr:', stderr)
    }
    
    if (!resultOutput || resultOutput.trim() === '') {
      return { success: true, contexts: [] }
    }
    
    // Parse the JSON result
    try {
      const result = JSON.parse(resultOutput.trim())
      console.log(`Found ${result.contexts.length} contexts in OmniFocus`)
      return result
    } catch (parseError) {
      console.error('Failed to parse JXA output:', parseError)
      return { success: false, error: 'Failed to parse contexts', contexts: [] }
    }
    
  } catch (error) {
    console.error('Error fetching contexts:', error)
    return { success: false, error: error.message, contexts: [] }
  }
})

// IPC handler for creating a new task in OmniFocus
ipcMain.handle('omnifocus:create-task', async (event, projectId, taskName) => {
  try {
    console.log(`Creating task "${taskName}" in project ${projectId}`)
    
    // First check if OmniFocus is running
    const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
    const { stdout: isRunningOutput } = await execAsync(`osascript -e '${checkScript}'`)
    
    if (!isRunningOutput.trim().toLowerCase().includes('true')) {
      return { success: false, error: 'OmniFocus is not running. Please start OmniFocus and try again.' }
    }
    
    // Create temporary JXA script for task creation
    const tempJxaPath = path.join(require('os').tmpdir(), 'create_task_jxa.js')
    const jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;

// Find the project by ID
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

// Create the new task
const newTask = of.Task({
  name: '${taskName.replace(/'/g, "\\'")}'
});

// Add task to the project
targetProject.tasks.push(newTask);

// Return success with the new task ID
JSON.stringify({
  success: true,
  taskId: newTask.id(),
  taskName: newTask.name()
});`
    
    // Write the JXA script to temporary file
    await fs.writeFile(tempJxaPath, jxaScript)
    
    // Execute the JXA script
    const { stdout: resultOutput, stderr } = await execAsync(`osascript -l JavaScript "${tempJxaPath}"`)
    
    // Clean up temporary file
    try {
      await fs.unlink(tempJxaPath)
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary JXA file:', cleanupError.message)
    }
    
    if (stderr) {
      console.error('JXA stderr:', stderr)
      return { success: false, error: stderr }
    }
    
    if (!resultOutput || resultOutput.trim() === '') {
      return { success: false, error: 'No output from JXA script' }
    }
    
    // Parse the JSON result
    try {
      const result = JSON.parse(resultOutput.trim())
      console.log('Task created successfully:', result)
      return result
    } catch (parseError) {
      console.error('Failed to parse JXA output:', parseError)
      return { success: false, error: 'Failed to parse result' }
    }
    
  } catch (error) {
    console.error('Error creating task:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('omnifocus:create-inbox-task', async (event, taskName) => {
  try {
    console.log(`Creating inbox task "${taskName}"`)
    
    // First check if OmniFocus is running
    const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
    const { stdout: isRunningOutput } = await execAsync(`osascript -e '${checkScript}'`)
    
    if (!isRunningOutput.trim().toLowerCase().includes('true')) {
      return { success: false, error: 'OmniFocus is not running. Please start OmniFocus and try again.' }
    }
    
    // Create temporary JXA script for inbox task creation
    const tempJxaPath = path.join(require('os').tmpdir(), 'create_inbox_task_jxa.js')
    const jxaScript = `const of = Application('OmniFocus');
const doc = of.defaultDocument;

// Create the new inbox task
const newTask = of.Task({
  name: '${taskName.replace(/'/g, "\\'")}'
});

// Add task to inbox (no project assignment)
doc.inboxTasks.push(newTask);

// Return success with the new task ID
JSON.stringify({
  success: true,
  taskId: newTask.id(),
  taskName: newTask.name()
});`
    
    // Write the JXA script to temporary file
    await fs.writeFile(tempJxaPath, jxaScript)
    
    // Execute the JXA script
    const { stdout: resultOutput, stderr } = await execAsync(`osascript -l JavaScript "${tempJxaPath}"`)
    
    // Clean up temporary file
    try {
      await fs.unlink(tempJxaPath)
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary JXA file:', cleanupError.message)
    }
    
    if (stderr) {
      console.error('JXA stderr:', stderr)
      return { success: false, error: stderr }
    }
    
    if (!resultOutput || resultOutput.trim() === '') {
      return { success: false, error: 'No output from JXA script' }
    }
    
    // Parse the JSON result
    try {
      const result = JSON.parse(resultOutput.trim())
      console.log('Inbox task created successfully:', result)
      return result
    } catch (parseError) {
      console.error('Failed to parse JXA output:', parseError)
      return { success: false, error: 'Failed to parse result' }
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
      
      // Add context if present
      if (task.context) {
        taskText.push(`(Context: ${task.context})`)
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

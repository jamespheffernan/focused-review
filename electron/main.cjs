const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs').promises
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

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
    const indexPath = path.join(__dirname, '../dist/index.html')
    mainWindow.loadFile(indexPath)
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
          const context = task.context();
          if (context) taskObj.context = context.name();
        } catch (e) { }
        
        if (taskObj.name) {
          taskData.push(taskObj);
        }
      } catch (taskError) {
        continue;
      }
    }
    
    activeProjects.push({
      id: project.id(),
      name: project.name(),
      status: project.status(),
      deferDate: project.deferDate() ? project.deferDate().toISOString() : null,
      dueDate: project.dueDate() ? project.dueDate().toISOString() : null,
      reviewInterval: project.reviewInterval(),
      lastReviewDate: project.lastReviewDate() ? project.lastReviewDate().toISOString() : null,
      nextReviewDate: project.nextReviewDate() ? project.nextReviewDate().toISOString() : null,
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

// IPC handlers for OmniFocus integration
ipcMain.handle('omnifocus:get-projects', async () => {
  try {
    console.time('omnifocus:get-projects')
    
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
    
    // Use persistent JXA script (no need to write file every time!)
    const scriptPath = await ensureJXAScript()
    
    // Execute the persistent script directly
    console.log('Executing JXA script...')
    const { stdout: projectOutput, stderr } = await execAsync(`osascript -l JavaScript "${scriptPath}"`)
    console.timeEnd('omnifocus:get-projects')
    
    if (stderr) {
      console.error('AppleScript stderr:', stderr)
      // Don't throw on stderr, just log it
    }
    
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
    
    const projects = []
    
    // Process the project data with tasks
    for (let i = 0; i < projectData.length; i++) {
      const project = projectData[i]
      
      // Basic validation
      if (project && project.name && project.name.trim() !== '') {
        
        // Convert OmniFocus status to our format
        let status = 'active'
        if (project.status === 'on hold') status = 'on_hold'
        if (project.status === 'dropped') status = 'dropped'
        
        projects.push({
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
          tags: [], // OmniFocus tags would need separate handling
          tasks: project.tasks || []
        })
      }
    }
    
    
    // Validate data structure consistency
    const validatedProjects = projects.map(project => ({
      id: project.id || `of_${Date.now()}_${Math.random()}`,
      name: project.name || 'Unnamed Project',
      status: project.status || 'active',
      deferDate: project.deferDate,
      dueDate: project.dueDate,
      reviewIntervalDays: project.reviewIntervalDays || 7,
      lastReviewDate: project.lastReviewDate,
      nextReviewDate: project.nextReviewDate,
      flagged: Boolean(project.flagged),
      estimatedMinutes: project.estimatedMinutes,
      note: project.note || '',
      tags: Array.isArray(project.tags) ? project.tags : [],
      tasks: project.tasks || [] // Include tasks in the validated projects
    }))
    
    return validatedProjects
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
      context: task.context() ? task.context().name() : null,
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
    const script = `
      tell application "OmniFocus"
        set targetProject to first project of default document whose id is "${projectId}"
        ${updates.name ? `set name of targetProject to "${updates.name}"` : ''}
        ${updates.status ? `set status of targetProject to ${updates.status === 'active' ? 'active' : updates.status === 'on_hold' ? 'on hold' : 'dropped'}` : ''}
        ${updates.flagged !== undefined ? `set flagged of targetProject to ${updates.flagged}` : ''}
        ${updates.estimatedMinutes ? `set estimated minutes of targetProject to ${updates.estimatedMinutes}` : ''}
        ${updates.notes ? `set note of targetProject to "${updates.notes}"` : ''}
      end tell
    `
    
    await execAsync(`osascript -e '${script}'`)
    return true
  } catch (error) {
    console.error('AppleScript update error:', error)
    return false
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

// Mark as reviewed (set last review date to now)
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
    console.log(`Setting context "${contextName}" on task ${taskId}`)
    
    // First check if OmniFocus is running
    const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
    const { stdout: isRunningOutput } = await execAsync(`osascript -e '${checkScript}'`)
    
    if (!isRunningOutput.trim().toLowerCase().includes('true')) {
      return { success: false, error: 'OmniFocus is not running. Please start OmniFocus and try again.' }
    }
    
    // Create temporary JXA script for setting context
    const tempJxaPath = path.join(require('os').tmpdir(), 'set_task_context_jxa.js')
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

// Find or create context
const contexts = doc.flattenedContexts();
let targetContext = null;

for (let i = 0; i < contexts.length; i++) {
  if (contexts[i].name() === '${contextName.replace(/'/g, "\\'")}') {
    targetContext = contexts[i];
    break;
  }
}

// Create context if it doesn't exist
if (!targetContext) {
  targetContext = of.Context({
    name: '${contextName.replace(/'/g, "\\'")}'
  });
  doc.contexts.push(targetContext);
}

// Set context on task
targetTask.context = targetContext;

// Return success
JSON.stringify({
  success: true,
  taskId: targetTask.id(),
  contextName: targetContext.name()
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
      console.log('Context set successfully:', result)
      return result
    } catch (parseError) {
      console.error('Failed to parse JXA output:', parseError)
      return { success: false, error: 'Failed to parse result' }
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
    const { stdout: isRunningOutput } = await execAsync(`osascript -e '${checkScript}'`)
    
    if (!isRunningOutput.trim().toLowerCase().includes('true')) {
      return { success: false, error: 'OmniFocus is not running. Please start OmniFocus and try again.' }
    }
    
    // Create temporary JXA script for setting due date
    const tempJxaPath = path.join(require('os').tmpdir(), 'set_task_due_date_jxa.js')
    const dueDateValue = dueDate ? `new Date('${dueDate}')` : 'null'
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

// Set due date (or clear it if null)
targetTask.dueDate = ${dueDateValue};

// Return success
JSON.stringify({
  success: true,
  taskId: targetTask.id(),
  dueDate: targetTask.dueDate() ? targetTask.dueDate().toISOString() : null
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
      console.log('Due date set successfully:', result)
      return result
    } catch (parseError) {
      console.error('Failed to parse JXA output:', parseError)
      return { success: false, error: 'Failed to parse result' }
    }
    
  } catch (error) {
    console.error('Error setting task due date:', error)
    return { success: false, error: error.message }
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

// Toggle completion
targetTask.completed = ${isComplete};

// Set/clear completion date
if (${isComplete}) {
  targetTask.completionDate = new Date();
} else {
  targetTask.completionDate = null;
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
    console.log(`Updating task ${taskId} with:`, updates)
    
    // First check if OmniFocus is running
    const checkScript = `tell application "System Events" to return (name of processes) contains "OmniFocus"`
    const { stdout: isRunningOutput } = await execAsync(`osascript -e '${checkScript}'`)
    
    if (!isRunningOutput.trim().toLowerCase().includes('true')) {
      return { success: false, error: 'OmniFocus is not running. Please start OmniFocus and try again.' }
    }
    
    // Build JXA script dynamically based on what needs to be updated
    const tempJxaPath = path.join(require('os').tmpdir(), 'update_task_jxa.js')
    
    // Build update logic
    let updateLogic = ''
    
    if (updates.name !== undefined) {
      updateLogic += `targetTask.name = '${updates.name.replace(/'/g, "\\'")}';\n`
    }
    
    if (updates.note !== undefined) {
      updateLogic += `targetTask.note = '${(updates.note || '').replace(/'/g, "\\'")}';\n`
    }
    
    if (updates.flagged !== undefined) {
      updateLogic += `targetTask.flagged = ${updates.flagged};\n`
    }
    
    if (updates.dueDate !== undefined) {
      if (updates.dueDate) {
        updateLogic += `targetTask.dueDate = new Date('${updates.dueDate}');\n`
      } else {
        updateLogic += `targetTask.dueDate = null;\n`
      }
    }
    
    if (updates.context !== undefined) {
      if (updates.context) {
        updateLogic += `
// Find or create context
const contexts = doc.flattenedContexts();
let targetContext = null;

for (let i = 0; i < contexts.length; i++) {
  if (contexts[i].name() === '${updates.context.replace(/'/g, "\\'")}') {
    targetContext = contexts[i];
    break;
  }
}

if (!targetContext) {
  targetContext = of.Context({
    name: '${updates.context.replace(/'/g, "\\'")}'
  });
  doc.contexts.push(targetContext);
}

targetTask.context = targetContext;
`
      } else {
        updateLogic += `targetTask.context = null;\n`
      }
    }
    
    if (updates.completed !== undefined) {
      updateLogic += `targetTask.completed = ${updates.completed};\n`
      if (updates.completed) {
        updateLogic += `targetTask.completionDate = new Date();\n`
      } else {
        updateLogic += `targetTask.completionDate = null;\n`
      }
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
${updateLogic}

// Return updated task data
JSON.stringify({
  success: true,
  taskId: targetTask.id(),
  name: targetTask.name(),
  note: targetTask.note() || '',
  flagged: targetTask.flagged(),
  dueDate: targetTask.dueDate() ? targetTask.dueDate().toISOString() : null,
  context: targetTask.context() ? targetTask.context().name() : null,
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
      console.log('Task updated successfully:', result)
      return result
    } catch (parseError) {
      console.error('Failed to parse JXA output:', parseError)
      return { success: false, error: 'Failed to parse result' }
    }
    
  } catch (error) {
    console.error('Error updating task:', error)
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

    // Security: Only allow https://, http://, and notion:// protocols
    if (!['http:', 'https:', 'notion:'].includes(urlObj.protocol)) {
      return {
        success: false,
        error: `Unsupported protocol: ${urlObj.protocol}. Only http://, https://, and notion:// are allowed.`
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

// Handle external links
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault()
    shell.openExternal(navigationUrl)
  })
})

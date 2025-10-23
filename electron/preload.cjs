const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // OmniFocus integration
  omnifocus: {
    getProjects: () => ipcRenderer.invoke('omnifocus:get-projects'),
    getProjectTasks: (projectId) => ipcRenderer.invoke('omnifocus:get-project-tasks', projectId),
    getContexts: () => ipcRenderer.invoke('omnifocus:get-contexts'),
    updateProject: (projectId, updates) => ipcRenderer.invoke('omnifocus:update-project', projectId, updates),
    markProjectReviewed: (projectId) => ipcRenderer.invoke('omnifocus:mark-project-reviewed', projectId),
    markProjectComplete: (projectId) => ipcRenderer.invoke('omnifocus:mark-project-complete', projectId),
    dropProject: (projectId) => ipcRenderer.invoke('omnifocus:drop-project', projectId),
    createTask: (projectId, taskName) => ipcRenderer.invoke('omnifocus:create-task', projectId, taskName),
    createInboxTask: (taskName) => ipcRenderer.invoke('omnifocus:create-inbox-task', taskName),
    setTaskContext: (taskId, contextName) => ipcRenderer.invoke('omnifocus:set-task-context', taskId, contextName),
    setTaskDueDate: (taskId, dueDate) => ipcRenderer.invoke('omnifocus:set-task-due-date', taskId, dueDate),
    toggleTaskCompletion: (taskId, isComplete) => ipcRenderer.invoke('omnifocus:toggle-task-completion', taskId, isComplete),
    updateTask: (taskId, updates) => ipcRenderer.invoke('omnifocus:update-task', taskId, updates),
    isRunning: () => ipcRenderer.invoke('omnifocus:is-running'),
    launch: () => ipcRenderer.invoke('omnifocus:launch'),
    getDatabasePath: () => ipcRenderer.invoke('omnifocus:get-database-path'),
    openProject: (projectId) => ipcRenderer.invoke('omnifocus:open-project', projectId)
  },
  
  // File operations
  file: {
    selectOmniFocusDatabase: () => ipcRenderer.invoke('file:select-omnifocus-database'),
    readDatabase: (filePath) => ipcRenderer.invoke('file:read-database', filePath)
  },
  
  // Shell operations
  shell: {
    openExternal: (url) => ipcRenderer.invoke('open-external-url', url)
  },
  
  // Notion sync operations
  notion: {
    syncReview: (projectId, weekOf, formattedMarkdown) => ipcRenderer.invoke('notion:sync-review', projectId, weekOf, formattedMarkdown),
    isConfigured: () => ipcRenderer.invoke('notion:is-configured'),
    moveToDatabase: (pageId, targetDatabaseId, projectData) => ipcRenderer.invoke('notion:move-to-database', pageId, targetDatabaseId, projectData),
    appendTasksLog: (pageId, tasks) => ipcRenderer.invoke('notion:append-tasks-log', pageId, tasks),
    findPageByProjectId: (projectId) => ipcRenderer.invoke('notion:find-page-by-project-id', projectId)
  },
  
  // Platform info
  platform: {
    isElectron: true,
    isMacOS: process.platform === 'darwin'
  }
})

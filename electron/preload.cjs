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
    createTask: (projectId, taskName) => ipcRenderer.invoke('omnifocus:create-task', projectId, taskName),
    setTaskContext: (taskId, contextName) => ipcRenderer.invoke('omnifocus:set-task-context', taskId, contextName),
    setTaskDueDate: (taskId, dueDate) => ipcRenderer.invoke('omnifocus:set-task-due-date', taskId, dueDate),
    toggleTaskCompletion: (taskId, isComplete) => ipcRenderer.invoke('omnifocus:toggle-task-completion', taskId, isComplete),
    updateTask: (taskId, updates) => ipcRenderer.invoke('omnifocus:update-task', taskId, updates),
    isRunning: () => ipcRenderer.invoke('omnifocus:is-running'),
    launch: () => ipcRenderer.invoke('omnifocus:launch'),
    getDatabasePath: () => ipcRenderer.invoke('omnifocus:get-database-path')
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
  
  // Platform info
  platform: {
    isElectron: true,
    isMacOS: process.platform === 'darwin'
  }
})

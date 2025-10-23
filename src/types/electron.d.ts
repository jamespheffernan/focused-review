// TypeScript declarations for Electron API

export interface ElectronAPI {
  omnifocus: {
    getProjects: () => Promise<any[]>
    getProjectTasks: (projectId: string) => Promise<any[]>
    getContexts: () => Promise<{ success: boolean; contexts: Array<{id: string; name: string}>; error?: string }>
    updateProject: (projectId: string, updates: any) => Promise<boolean>
    markProjectReviewed: (projectId: string) => Promise<{ success: boolean; projectId?: string; lastReviewDate?: string | null; nextReviewDate?: string | null; error?: string }>
    markProjectComplete: (projectId: string) => Promise<{ success: boolean; projectId?: string; completed?: boolean; error?: string }>
    dropProject: (projectId: string) => Promise<{ success: boolean; projectId?: string; status?: string; error?: string }>
    createTask: (projectId: string, taskName: string) => Promise<{ success: boolean; taskId?: string; taskName?: string; error?: string }>
    createInboxTask: (taskName: string) => Promise<{ success: boolean; taskId?: string; taskName?: string; error?: string }>
    setTaskContext: (taskId: string, contextName: string) => Promise<{ success: boolean; taskId?: string; contextName?: string; error?: string }>
    setTaskDueDate: (taskId: string, dueDate: string | null) => Promise<{ success: boolean; taskId?: string; dueDate?: string | null; error?: string }>
    toggleTaskCompletion: (taskId: string, isComplete: boolean) => Promise<{ success: boolean; taskId?: string; completed?: boolean; completionDate?: string | null; error?: string }>
    updateTask: (taskId: string, updates: any) => Promise<{ success: boolean; taskId?: string; name?: string; note?: string; flagged?: boolean; dueDate?: string | null; context?: string | null; completed?: boolean; completionDate?: string | null; error?: string }>
    isRunning: () => Promise<boolean>
    launch: () => Promise<boolean>
    getDatabasePath: () => Promise<{ found: boolean; path?: string; files?: string[] }>
    openProject: (projectId: string) => Promise<{ success: boolean; projectId?: string; url?: string; error?: string }>
  }
  
  file: {
    selectOmniFocusDatabase: () => Promise<{ success: boolean; path?: string; content?: Buffer; error?: string }>
    readDatabase: (filePath: string) => Promise<{ success: boolean; content?: Buffer; error?: string }>
  }
  
  shell: {
    openExternal: (url: string) => Promise<{ success: boolean; url?: string; error?: string }>
  }
  
  notion: {
    syncReview: (projectId: string, weekOf: string, formattedMarkdown: string) => Promise<{ 
      success: boolean
      skipped?: boolean
      reason?: string
      message?: string
      error?: string
    }>
    isConfigured: () => Promise<{ 
      configured: boolean
      hasToken?: boolean
      hasDatabase?: boolean
      archiveDb?: string | null
      somedayDb?: string | null
      error?: string
    }>
    moveToDatabase: (ofProjectId: string, targetDatabaseId: string, projectData?: {
      ofId?: string
      name?: string
      status?: string
    }) => Promise<{ 
      success: boolean
      oldPageId?: string
      newPageId?: string
      message?: string
      error?: string
    }>
  }
  
  platform: {
    isElectron: boolean
    isMacOS: boolean
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

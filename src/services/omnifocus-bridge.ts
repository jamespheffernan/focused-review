// OmniFocus Bridge Service
// Provides a bridge between the web app and OmniFocus on macOS
// This service handles the communication layer for different integration methods

export interface OmniFocusTask {
  id: string
  name: string
  status: 'available' | 'next' | 'blocked' | 'completed'
  dueDate?: string
  deferDate?: string
  tags: string[]
  context?: string | null
  flagged: boolean
  note?: string
  completed: boolean
  completedDate?: string
}

export interface OmniFocusBridgeProject {
  id: string
  name: string
  status: 'active' | 'on_hold' | 'dropped'
  deferDate?: string
  dueDate?: string
  reviewIntervalDays: number
  lastReviewed?: string
  nextReviewDate?: string
  tags: string[]
  flagged?: boolean
  estimatedMinutes?: number
  notes?: string
  tasks?: OmniFocusTask[]
}

export interface BridgeStatus {
  available: boolean
  method: 'applescript' | 'electron' | 'file-upload' | 'none'
  message: string
  omniFocusRunning?: boolean
}

const normalizeTagList = (input: unknown, fallback?: unknown): string[] => {
  const tags: string[] = []
  const seen = new Set<string>()

  const pushTag = (value: unknown) => {
    if (typeof value !== 'string') {
      return
    }
    const trimmed = value.trim()
    if (!trimmed) {
      return
    }
    const key = trimmed.toLowerCase()
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    tags.push(trimmed)
  }

  if (Array.isArray(input)) {
    input.forEach(pushTag)
  } else {
    pushTag(input)
  }

  if (tags.length === 0) {
    if (Array.isArray(fallback)) {
      fallback.forEach(pushTag)
    } else {
      pushTag(fallback)
    }
  }

  return tags
}

class OmniFocusBridge {
  private isMacOS = false
  private isElectron = false

  constructor() {
    this.isMacOS = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
    this.isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined
  }

  /**
   * Get the Electron API, checking for test stubs first
   * This allows tests to inject stubs after modules load
   * Since contextBridge creates read-only properties, we check for stubs stored separately
   */
  private getElectronAPI() {
    console.log('[Bridge] getElectronAPI() called')
    if (typeof window === 'undefined') {
      return undefined
    }
    
    // Check if test stubs exist (stored on window.__TEST_STUBS__)
    // The test stores stubs there because contextBridge methods can't be replaced directly
    const testStubs = (window as any).__TEST_STUBS__
    console.log('[Bridge] Checking for test stubs:', { hasStubs: !!testStubs, hasStubsObject: !!(testStubs && testStubs.stubs), hasElectronAPI: !!window.electronAPI })
    if (testStubs && testStubs.stubs && window.electronAPI) {
      console.log('[Bridge] Using test stubs for Electron API')
      // Return a wrapper that uses stubs if they exist, otherwise falls back to real API
      const realAPI = window.electronAPI
      return {
        ...realAPI,
        omnifocus: {
          ...realAPI.omnifocus,
          createTask: testStubs.stubs.createTask || realAPI.omnifocus.createTask,
          setTaskTags: testStubs.stubs.setTaskTags || realAPI.omnifocus.setTaskTags,
          setTaskDueDate: testStubs.stubs.setTaskDueDate || realAPI.omnifocus.setTaskDueDate,
          updateTask: testStubs.stubs.updateTask || realAPI.omnifocus.updateTask,
        }
      }
    } else {
      console.log('[Bridge] No test stubs found, using real Electron API')
    }
    
    return window.electronAPI
  }

  /**
   * Get the best available integration method
   */
  getIntegrationStatus(): BridgeStatus {
    if (this.isElectron) {
      return {
        available: true,
        method: 'electron',
        message: 'OmniFocus integration via Electron - direct database access'
      }
    } else if (this.isMacOS) {
      return {
        available: true,
        method: 'applescript',
        message: 'OmniFocus integration via AppleScript - requires OmniFocus to be running'
      }
    } else {
      return {
        available: false,
        method: 'file-upload',
        message: 'Upload your OmniFocus database file to import projects'
      }
    }
  }

  /**
   * Get projects using the best available method
   */
  async getProjects(): Promise<OmniFocusBridgeProject[]> {
    const status = this.getIntegrationStatus()
    
    switch (status.method) {
      case 'electron':
        return this.getProjectsFromElectron()
      case 'applescript':
        return this.getProjectsFromAppleScript()
      case 'file-upload':
        throw new Error('File upload method requires manual file selection')
      default:
        throw new Error('No integration method available')
    }
  }

  /**
   * Get tasks for a specific project
   */
  async getProjectTasks(projectId: string): Promise<OmniFocusTask[]> {
    const status = this.getIntegrationStatus()
    
    switch (status.method) {
      case 'electron':
        return this.getProjectTasksFromElectron(projectId)
      case 'applescript':
        return this.getProjectTasksFromAppleScript(projectId)
      case 'file-upload':
        return this.getProjectTasksFromFile(projectId)
      default:
        return []
    }
  }

  /**
   * Get all contexts/tags from OmniFocus
   */
  async getTags(): Promise<Array<{id: string; name: string}>> {
    const status = this.getIntegrationStatus()
    
    const electronAPI = this.getElectronAPI()
    if (status.method === 'electron' && electronAPI) {
      try {
        const result = await electronAPI.omnifocus.getTags()
        if (Array.isArray(result)) {
          return result
        }
        if (result && (result as any).success) {
          return (result as any).contexts || []
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error)
      }
    }
    
    return []
  }

  /**
   * @deprecated Use getTags() instead
   */
  async getContexts(): Promise<Array<{id: string; name: string}>> {
    return this.getTags()
  }

  /**
   * Update project using the best available method
   */
  async updateProject(projectId: string, updates: Partial<OmniFocusBridgeProject>): Promise<boolean> {
    const status = this.getIntegrationStatus()
    
    switch (status.method) {
      case 'electron':
        return this.updateProjectInElectron(projectId, updates)
      case 'applescript':
        return this.updateProjectViaAppleScript(projectId, updates)
      case 'file-upload':
        return this.queueProjectUpdate(projectId, updates)
      default:
        return false
    }
  }

  /**
   * Mark project as reviewed in OmniFocus
   */
  async markProjectReviewed(projectId: string): Promise<{success: boolean; projectId?: string; lastReviewDate?: string | null; nextReviewDate?: string | null; error?: string}> {
    const status = this.getIntegrationStatus()
    
    switch (status.method) {
      case 'electron':
        const electronAPI = this.getElectronAPI()
        if (!electronAPI) {
          return { success: false, error: 'Electron API not available' }
        }
        return await electronAPI.omnifocus.markProjectReviewed(projectId)
      case 'applescript':
      case 'file-upload':
      default:
        console.warn('Mark reviewed not implemented for this integration method')
        return { success: false, error: 'Integration method not supported' }
    }
  }

  /**
   * Create a new task in OmniFocus
   */
  async createTask(projectId: string, taskName: string): Promise<{success: boolean; taskId?: string; error?: string}> {
    const status = this.getIntegrationStatus()
    
    switch (status.method) {
      case 'electron':
        return this.createTaskInElectron(projectId, taskName)
      case 'applescript':
        return this.createTaskViaAppleScript(projectId, taskName)
      case 'file-upload':
        return {success: false, error: 'Cannot create tasks in file-upload mode'}
      default:
        return {success: false, error: 'No integration method available'}
    }
  }

  /**
   * Create task in Electron
   */
  private async createTaskInElectron(projectId: string, taskName: string): Promise<{success: boolean; taskId?: string; error?: string}> {
    try {
      const electronAPI = this.getElectronAPI()
      if (!electronAPI) {
        return {success: false, error: 'Electron API not available'}
      }
      
      const result = await electronAPI.omnifocus.createTask(projectId, taskName)
      return result
    } catch (error) {
      console.error('Electron create task failed:', error)
      return {success: false, error: error instanceof Error ? error.message : 'Unknown error'}
    }
  }

  /**
   * Create task via AppleScript (simulated)
   */
  private async createTaskViaAppleScript(projectId: string, taskName: string): Promise<{success: boolean; taskId?: string; error?: string}> {
    // In a real implementation, this would execute AppleScript commands
    console.log(`AppleScript create task: Creating "${taskName}" in project ${projectId}`)
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Simulate success with a mock task ID
    return {
      success: true,
      taskId: `as_task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  /**
   * Set context on a task
   */
  async setTaskTags(taskId: string, tagNames: string[]): Promise<{success: boolean; error?: string}> {
    const status = this.getIntegrationStatus()
    
    const electronAPI = this.getElectronAPI()
    if (status.method === 'electron' && electronAPI) {
      try {
        const result = await electronAPI.omnifocus.setTaskTags(taskId, tagNames)
        return {success: result.success, error: result.error}
      } catch (error) {
        return {success: false, error: error instanceof Error ? error.message : 'Unknown error'}
      }
    }
    
    return {success: false, error: 'Integration method not supported'}
  }

  /**
   * @deprecated Use setTaskTags() instead
   */
  async setTaskContext(taskId: string, contextName: string): Promise<{success: boolean; error?: string}> {
    const tags = contextName ? [contextName] : []
    return this.setTaskTags(taskId, tags)
  }

  /**
   * Set due date on a task
   */
  async setTaskDueDate(taskId: string, dueDate: string | null): Promise<{success: boolean; error?: string}> {
    const status = this.getIntegrationStatus()
    
    const electronAPI = this.getElectronAPI()
    if (status.method === 'electron' && electronAPI) {
      try {
        const result = await electronAPI.omnifocus.setTaskDueDate(taskId, dueDate)
        return {success: result.success, error: result.error}
      } catch (error) {
        return {success: false, error: error instanceof Error ? error.message : 'Unknown error'}
      }
    }
    
    return {success: false, error: 'Integration method not supported'}
  }

  /**
   * Toggle task completion status
   */
  async toggleTaskCompletion(taskId: string, isComplete: boolean): Promise<{success: boolean; error?: string}> {
    const status = this.getIntegrationStatus()
    
    const electronAPI = this.getElectronAPI()
    if (status.method === 'electron' && electronAPI) {
      try {
        const result = await electronAPI.omnifocus.toggleTaskCompletion(taskId, isComplete)
        return {success: result.success, error: result.error}
      } catch (error) {
        return {success: false, error: error instanceof Error ? error.message : 'Unknown error'}
      }
    }
    
    return {success: false, error: 'Integration method not supported'}
  }

  /**
   * Update task with multiple properties
   */
  async updateTask(taskId: string, updates: any): Promise<{success: boolean; error?: string}> {
    const status = this.getIntegrationStatus()
    
    const electronAPI = this.getElectronAPI()
    if (status.method === 'electron' && electronAPI) {
      try {
        const result = await electronAPI.omnifocus.updateTask(taskId, updates)
        return {success: result.success, error: result.error}
      } catch (error) {
        return {success: false, error: error instanceof Error ? error.message : 'Unknown error'}
      }
    }
    
    return {success: false, error: 'Integration method not supported'}
  }

  /**
   * Get projects from Electron
   */
  private async getProjectsFromElectron(): Promise<OmniFocusBridgeProject[]> {
    try {
      const electronAPI = this.getElectronAPI()
      if (!electronAPI) {
        throw new Error('Electron API not available')
      }
      
      const result = await electronAPI.omnifocus.getProjects()
      
      // Handle new response format with metadata
      const projects = Array.isArray(result) ? result : ((result as any).projects || [])
      const dataSource = Array.isArray(result) ? 'unknown' : ((result as any).dataSource || 'unknown')
      const fallbackReason = Array.isArray(result) ? undefined : (result as any).fallbackReason
      
      console.log(`Bridge received ${projects.length} projects from Electron (source: ${dataSource})`)
      if (fallbackReason) {
        console.warn(`Using fallback JXA method. Reason: ${fallbackReason}`)
      }
      console.log('Sample project with tasks:', projects[0])
      
      // Store data source info globally for UI access
      if (typeof window !== 'undefined') {
        (window as any).__omnifocusDataSource = {
          source: dataSource,
          reason: fallbackReason
        }
      }
      
      // Convert Electron results to our format
      const convertedProjects = projects.map((project: any) => ({
        id: project.id,
        name: project.name,
        status: this.convertStatus(project.status),
        deferDate: project.deferDate,
        dueDate: project.dueDate,
        reviewIntervalDays: project.reviewIntervalDays || 7,
        lastReviewed: project.lastReviewDate,
        nextReviewDate: project.nextReviewDate,
        tags: normalizeTagList(project.tags),
        flagged: Boolean(project.flagged),
        estimatedMinutes: project.estimatedMinutes,
        notes: project.note || '',
        tasks: Array.isArray(project.tasks)
          ? project.tasks.map((task: any) => ({
              id: task.id,
              name: task.name,
              status: this.convertTaskStatus?.(task.status) ?? 'available',
              dueDate: task.dueDate,
              deferDate: task.deferDate,
              tags: normalizeTagList(task.tags), // SQLite reader now returns tags array directly
              flagged: Boolean(task.flagged),
              note: task.note || '',
              completed: Boolean(task.completed),
              completedDate: task.completedDate
            }))
          : []
      }))
      
      const totalTasks = convertedProjects.reduce((sum: number, p: any) => sum + (p.tasks?.length || 0), 0)
      console.log(`Bridge converted projects with ${totalTasks} total tasks`)
      
      // DEBUG: Check if review dates survived conversion
      if (convertedProjects.length > 0) {
        console.log('🔍 First converted project:', {
          name: convertedProjects[0].name,
          lastReviewed: convertedProjects[0].lastReviewed,
          nextReviewDate: convertedProjects[0].nextReviewDate
        })
      }
      
      return convertedProjects
    } catch (error) {
      console.error('Electron integration failed:', error)
      throw error
    }
  }

  private convertStatus(status: any): 'active' | 'on_hold' | 'dropped' {
    if (status === 'on hold') return 'on_hold'
    if (status === 'dropped') return 'dropped'
    return 'active'
  }

  /**
   * Get projects from AppleScript (simulated for web)
   */
  private async getProjectsFromAppleScript(): Promise<OmniFocusBridgeProject[]> {
    // In a real implementation, this would use a native bridge or extension
    // For now, we'll simulate the AppleScript integration with realistic data
    
    console.log('AppleScript integration: Simulating connection to OmniFocus...')
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Return realistic mock data that would come from OmniFocus
    return [
      {
        id: 'as_1',
        name: 'Complete Q4 budget review',
        status: 'active',
        reviewIntervalDays: 7,
        tags: ['Work', 'Finance', 'Urgent'],
        flagged: true,
        estimatedMinutes: 180,
        notes: 'Need to review all department budgets and prepare presentation for board meeting',
        deferDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 1 week from now
      },
      {
        id: 'as_2',
        name: 'Plan team building retreat',
        status: 'active',
        reviewIntervalDays: 14,
        tags: ['Work', 'HR', 'Planning'],
        flagged: false,
        estimatedMinutes: 240,
        notes: 'Research venues, activities, and coordinate with team preferences',
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString() // 3 weeks from now
      },
      {
        id: 'as_3',
        name: 'Learn React Native',
        status: 'active',
        reviewIntervalDays: 7,
        tags: ['Personal', 'Learning', 'Development'],
        flagged: true,
        estimatedMinutes: 300,
        notes: 'Complete online course and build a sample mobile app'
      },
      {
        id: 'as_4',
        name: 'Renovate home office',
        status: 'on_hold',
        reviewIntervalDays: 30,
        tags: ['Personal', 'Home'],
        flagged: false,
        estimatedMinutes: 480,
        notes: 'Waiting for contractor availability and budget approval'
      },
      {
        id: 'as_5',
        name: 'Write technical blog post',
        status: 'active',
        reviewIntervalDays: 7,
        tags: ['Work', 'Writing', 'Technical'],
        flagged: false,
        estimatedMinutes: 120,
        notes: 'Document the new API integration patterns we implemented'
      }
    ]
  }

  /**
   * Update project in Electron
   */
  private async updateProjectInElectron(projectId: string, updates: Partial<OmniFocusBridgeProject>): Promise<boolean> {
    try {
      const electronAPI = this.getElectronAPI()
      if (!electronAPI) {
        return false
      }
      
      return await electronAPI.omnifocus.updateProject(projectId, updates)
    } catch (error) {
      console.error('Electron update failed:', error)
      return false
    }
  }

  /**
   * Update project via AppleScript (simulated)
   */
  private async updateProjectViaAppleScript(projectId: string, updates: Partial<OmniFocusBridgeProject>): Promise<boolean> {
    // In a real implementation, this would execute AppleScript commands
    console.log(`AppleScript update: Updating project ${projectId} with:`, updates)
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Simulate success
    return true
  }

  /**
   * Queue project update for later sync
   */
  private async queueProjectUpdate(projectId: string, updates: Partial<OmniFocusBridgeProject>): Promise<boolean> {
    try {
      const updateQueue = JSON.parse(localStorage.getItem('omnifocus-update-queue') || '[]')
      updateQueue.push({ 
        projectId, 
        updates, 
        timestamp: new Date().toISOString(),
        method: 'file-upload'
      })
      localStorage.setItem('omnifocus-update-queue', JSON.stringify(updateQueue))
      return true
    } catch (error) {
      console.error('Failed to queue project update:', error)
      return false
    }
  }

  /**
   * Check if OmniFocus is running
   */
  async isOmniFocusRunning(): Promise<boolean> {
    const electronAPI = this.getElectronAPI()
    if (this.isElectron && electronAPI) {
      try {
        return await electronAPI.omnifocus.isRunning()
      } catch (error) {
        return false
      }
    } else if (this.isMacOS) {
      // In a real implementation, this would use AppleScript to check
      // For now, we'll simulate that OmniFocus is running
      return true
    }
    return false
  }

  /**
   * Get project tasks from Electron
   */
  private async getProjectTasksFromElectron(projectId: string): Promise<OmniFocusTask[]> {
    try {
      const electronAPI = this.getElectronAPI()
      if (!electronAPI) {
        throw new Error('Electron API not available')
      }
      
      const tasks = await electronAPI.omnifocus.getProjectTasks(projectId)
      
      // Convert Electron results to our format
      return tasks.map((task: any) => ({
        id: task.id,
        name: task.name,
        status: this.convertTaskStatus(task.status),
        dueDate: task.dueDate,
        tags: normalizeTagList(task.tags), // Tags should always be an array now
        flagged: Boolean(task.flagged),
        note: task.note || '',
        completed: Boolean(task.completed),
        completedDate: task.completedDate
      }))
    } catch (error) {
      console.error('Electron task integration failed:', error)
      throw error
    }
  }

  /**
   * Get project tasks from AppleScript
   */
  private async getProjectTasksFromAppleScript(projectId: string): Promise<OmniFocusTask[]> {
    // AppleScript implementation would go here
    // For now, return empty array as this is not implemented yet
    console.log('AppleScript: Getting tasks for project', projectId)
    return []
  }

  /**
   * Get project tasks from file
   */
  private async getProjectTasksFromFile(projectId: string): Promise<OmniFocusTask[]> {
    // File-based implementation would go here
    // For now, return empty array as this is not implemented yet
    console.log('File: Getting tasks for project', projectId)
    return []
  }

  /**
   * Convert OmniFocus task status to our format
   */
  private convertTaskStatus(status: string): 'available' | 'next' | 'blocked' | 'completed' {
    switch (status) {
      case 'next action':
        return 'next'
      case 'available':
        return 'available'
      case 'blocked':
        return 'blocked'
      case 'completed':
        return 'completed'
      default:
        return 'available'
    }
  }

  /**
   * Launch OmniFocus
   */
  async launchOmniFocus(): Promise<boolean> {
    const electronAPI = this.getElectronAPI()
    if (this.isElectron && electronAPI) {
      try {
        return await electronAPI.omnifocus.launch()
      } catch (error) {
        return false
      }
    } else if (this.isMacOS) {
      // In a real implementation, this would use AppleScript to launch OmniFocus
      console.log('AppleScript: Launching OmniFocus...')
      return true
    }
    return false
  }

  /**
   * Get queued updates
   */
  getQueuedUpdates(): Array<{projectId: string, updates: Partial<OmniFocusBridgeProject>, timestamp: string}> {
    try {
      return JSON.parse(localStorage.getItem('omnifocus-update-queue') || '[]')
    } catch (error) {
      return []
    }
  }

  /**
   * Clear queued updates
   */
  clearQueuedUpdates(): void {
    localStorage.removeItem('omnifocus-update-queue')
  }
}

export const omnifocusBridge = new OmniFocusBridge()

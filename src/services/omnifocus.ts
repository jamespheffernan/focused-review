// OmniFocus Integration Service
// This service handles communication with OmniFocus databases and APIs

export interface OmniFocusProject {
  id: string
  name: string
  status: 'active' | 'on_hold' | 'dropped'
  deferDate?: string
  dueDate?: string
  reviewIntervalDays: number
  tags: string[]
  lastReviewed?: string
  nextReviewDate?: string
  notes?: string
  nextAction?: string
  context?: string
  flagged?: boolean
  estimatedMinutes?: number
  tasks?: any[]
}

export interface OmniFocusDatabase {
  projects: OmniFocusProject[]
  lastModified: string
  version: string
}

class OmniFocusService {
  private isElectron = false
  private isMacOS = false

  constructor() {
    // Detect if we're running in Electron or on macOS
    this.isElectron = typeof window !== 'undefined' && (window as any).process?.type === 'renderer'
    this.isMacOS = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
  }

  /**
   * Get OmniFocus projects that are due for review
   */
  async getProjectsDueForReview(): Promise<OmniFocusProject[]> {
    try {
      const { omnifocusBridge } = await import('./omnifocus-bridge')
      const projects = await omnifocusBridge.getProjects()
      
      console.log(`Service received ${projects.length} projects from bridge`)
      const totalTasks = projects.reduce((sum, p: any) => sum + (p.tasks?.length || 0), 0)
      console.log(`Service received ${totalTasks} total tasks`)
      
      // Convert bridge projects to our format
      const convertedProjects = projects.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        deferDate: p.deferDate,
        dueDate: p.dueDate,
        reviewIntervalDays: p.reviewIntervalDays,
        lastReviewed: p.lastReviewed,  // CRITICAL: Preserve review dates!
        nextReviewDate: p.nextReviewDate,  // CRITICAL: Preserve review dates!
        tags: p.tags,
        flagged: p.flagged,
        estimatedMinutes: p.estimatedMinutes,
        notes: p.notes,
        tasks: (p as any).tasks || [] // CRITICAL: Preserve tasks from bridge
      }))
      
      const convertedTotalTasks = convertedProjects.reduce((sum, p) => sum + (p.tasks?.length || 0), 0)
      console.log(`Service converted projects with ${convertedTotalTasks} total tasks`)
      
      return convertedProjects
    } catch (error) {
      console.error('Error fetching OmniFocus projects:', error)
      
      // Provide more specific error information
      if (error instanceof Error) {
        if (error.message.includes('not running')) {
          console.warn('OmniFocus is not running. Using fallback projects.')
        } else if (error.message.includes('not installed')) {
          console.warn('OmniFocus is not installed. Using fallback projects.')
        } else {
          console.warn('OmniFocus connection failed:', error.message, '. Using fallback projects.')
        }
      }
      
      return this.getFallbackProjects()
    }
  }

  /**
   * Update project metadata in OmniFocus
   */
  async updateProjectMetadata(projectId: string, updates: Partial<OmniFocusProject>): Promise<boolean> {
    try {
      const { omnifocusBridge } = await import('./omnifocus-bridge')
      return await omnifocusBridge.updateProject(projectId, updates)
    } catch (error) {
      console.error('Error updating OmniFocus project:', error)
      return false
    }
  }

  /**
   * Mark project as reviewed in OmniFocus
   */
  async markProjectReviewed(projectId: string): Promise<boolean> {
    try {
      const { omnifocusBridge } = await import('./omnifocus-bridge')
      const result = await omnifocusBridge.markProjectReviewed(projectId)
      return result.success
    } catch (error) {
      console.error('Error marking project as reviewed:', error)
      return false
    }
  }

  /**
   * Parse OmniFocus database file (XML or SQLite format)
   */
  async parseOmniFocusDatabase(file: File): Promise<OmniFocusProject[]> {
    const { OmniFocusParser } = await import('./omnifocus-parser')
    return OmniFocusParser.parseFile(file)
  }


  /**
   * Get fallback projects when OmniFocus is not available
   */
  getFallbackProjects(): OmniFocusProject[] {
    return [
      {
        id: 'p1',
        name: 'Buy a screwdriver for your toolbox',
        status: 'active',
        reviewIntervalDays: 7,
        tags: [],
        lastReviewed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
      },
      {
        id: 'p2',
        name: 'Revamp Website',
        status: 'active',
        reviewIntervalDays: 7,
        tags: ['Work'],
        lastReviewed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
      },
      {
        id: 'p3',
        name: 'Plan vacation to Japan',
        status: 'on_hold',
        reviewIntervalDays: 14,
        tags: ['Personal'],
        lastReviewed: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days ago
      }
    ]
  }

  /**
   * Check if OmniFocus is available
   */
  isOmniFocusAvailable(): boolean {
    return this.isElectron || this.isMacOS
  }

  /**
   * Get integration status
   */
  getIntegrationStatus(): {
    available: boolean
    method: 'electron' | 'applescript' | 'file-upload' | 'none'
    message: string
  } {
    // Use the bridge to get the most accurate status
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { omnifocusBridge } = require('./omnifocus-bridge')
      return omnifocusBridge.getIntegrationStatus()
    } catch {
      // Fallback to local detection
      if (this.isElectron) {
        return {
          available: true,
          method: 'electron',
          message: 'OmniFocus integration via Electron'
        }
      } else if (this.isMacOS) {
        return {
          available: true,
          method: 'applescript',
          message: 'OmniFocus integration via AppleScript (requires OmniFocus to be installed)'
        }
      } else {
        return {
          available: false,
          method: 'file-upload',
          message: 'Upload your OmniFocus database file to import projects'
        }
      }
    }
  }
}

export const omnifocusService = new OmniFocusService()

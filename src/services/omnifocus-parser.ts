// OmniFocus Database Parser
// Handles both XML (.ofocus) and SQLite database formats

import type { OmniFocusProject } from './omnifocus'

export class OmniFocusParser {
  /**
   * Parse OmniFocus database file
   */
  static async parseFile(file: File): Promise<OmniFocusProject[]> {
    const fileName = file.name.toLowerCase()
    
    if (fileName.endsWith('.xml') || fileName.endsWith('.ofocus')) {
      return this.parseXMLFile(file)
    } else if (fileName.endsWith('.sqlite') || fileName.endsWith('.db')) {
      return this.parseSQLiteFile(file)
    } else {
      throw new Error('Unsupported file format. Please upload an OmniFocus database file (.xml, .ofocus, or .sqlite)')
    }
  }

  /**
   * Parse XML/OFocus file
   */
  private static async parseXMLFile(file: File): Promise<OmniFocusProject[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const xmlText = e.target?.result as string
          const projects = this.parseXMLContent(xmlText)
          resolve(projects)
        } catch (error) {
          reject(error)
        }
      }
      
      reader.onerror = () => reject(new Error('Failed to read XML file'))
      reader.readAsText(file)
    })
  }

  /**
   * Parse SQLite file
   */
  private static async parseSQLiteFile(file: File): Promise<OmniFocusProject[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer
          const projects = await this.parseSQLiteContent(arrayBuffer)
          resolve(projects)
        } catch (error) {
          reject(error)
        }
      }
      
      reader.onerror = () => reject(new Error('Failed to read SQLite file'))
      reader.readAsArrayBuffer(file)
    })
  }

  /**
   * Parse XML content
   */
  private static parseXMLContent(xmlText: string): OmniFocusProject[] {
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
      
      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror')
      if (parseError) {
        throw new Error('Invalid XML format')
      }

      const projects: OmniFocusProject[] = []
      
      // Find all task elements with task_type="0" (projects)
      const taskElements = xmlDoc.querySelectorAll('task[task_type="0"]')
      
      taskElements.forEach((taskElement) => {
        const id = taskElement.getAttribute('id') || taskElement.getAttribute('pk') || ''
        const name = taskElement.querySelector('name')?.textContent || 'Unnamed Project'
        const status = taskElement.getAttribute('status') || '0'
        const deferDate = taskElement.querySelector('defer_date')?.textContent
        const dueDate = taskElement.querySelector('due_date')?.textContent
        const reviewInterval = taskElement.querySelector('review_interval')?.textContent
        const flagged = taskElement.getAttribute('flagged') === 'true'
        const estimatedMinutes = taskElement.querySelector('estimated_minutes')?.textContent
        const note = taskElement.querySelector('note')?.textContent

        // Convert status
        let projectStatus: 'active' | 'on_hold' | 'dropped' = 'active'
        if (status === '1') projectStatus = 'on_hold'
        if (status === '2') projectStatus = 'dropped'

        // Parse dates (OmniFocus uses Core Data timestamps)
        let parsedDeferDate: string | undefined
        let parsedDueDate: string | undefined
        
        if (deferDate) {
          const timestamp = parseFloat(deferDate)
          if (!isNaN(timestamp)) {
            parsedDeferDate = new Date(timestamp * 1000).toISOString()
          }
        }
        
        if (dueDate) {
          const timestamp = parseFloat(dueDate)
          if (!isNaN(timestamp)) {
            parsedDueDate = new Date(timestamp * 1000).toISOString()
          }
        }

        projects.push({
          id: `of_${id}`,
          name,
          status: projectStatus,
          deferDate: parsedDeferDate,
          dueDate: parsedDueDate,
          reviewIntervalDays: reviewInterval ? parseInt(reviewInterval) : 7,
          tags: [], // Would need separate parsing for tags
          flagged: flagged,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
          notes: note || undefined
        })
      })

      return projects
    } catch (error) {
      console.error('Error parsing XML:', error)
      throw new Error('Failed to parse OmniFocus XML file. Please ensure the file is a valid OmniFocus database.')
    }
  }

  /**
   * Parse SQLite content
   */
  private static async parseSQLiteContent(arrayBuffer: ArrayBuffer): Promise<OmniFocusProject[]> {
    try {
      // Import sql.js dynamically
      const initSqlJs = (await import('sql.js')).default
      const SQL = await initSqlJs()
      
      const db = new SQL.Database(new Uint8Array(arrayBuffer))
      
      // Query OmniFocus projects
      const stmt = db.prepare(`
        SELECT 
          pk,
          name,
          status,
          defer_date,
          due_date,
          review_interval,
          flagged,
          estimated_minutes,
          note
        FROM task 
        WHERE task_type = 0 AND status != 2
        ORDER BY name
      `)
      
      const projects: OmniFocusProject[] = []
      
      while (stmt.step()) {
        const row = stmt.getAsObject()
        
        // Convert OmniFocus status to our format
        let status: 'active' | 'on_hold' | 'dropped' = 'active'
        if (row.status === 1) status = 'on_hold'
        if (row.status === 2) status = 'dropped'
        
        // Parse dates
        let deferDate: string | undefined
        let dueDate: string | undefined
        
        if (row.defer_date) {
          deferDate = new Date(row.defer_date as number * 1000).toISOString()
        }
        
        if (row.due_date) {
          dueDate = new Date(row.due_date as number * 1000).toISOString()
        }
        
        projects.push({
          id: `of_${row.pk}`,
          name: row.name as string,
          status,
          deferDate,
          dueDate,
          reviewIntervalDays: row.review_interval as number || 7,
          tags: [], // OmniFocus tags would need a separate query
          flagged: Boolean(row.flagged),
          estimatedMinutes: row.estimated_minutes as number,
          notes: row.note as string
        })
      }
      
      stmt.free()
      db.close()
      
      return projects
    } catch (error) {
      console.error('Error parsing SQLite database:', error)
      throw new Error('Failed to parse OmniFocus SQLite database. Please ensure the file is a valid OmniFocus database.')
    }
  }

  /**
   * Get file format information
   */
  static getFileFormatInfo(fileName: string): {
    format: 'xml' | 'sqlite' | 'unknown'
    description: string
  } {
    const name = fileName.toLowerCase()
    
    if (name.endsWith('.xml') || name.endsWith('.ofocus')) {
      return {
        format: 'xml',
        description: 'OmniFocus XML database file'
      }
    } else if (name.endsWith('.sqlite') || name.endsWith('.db')) {
      return {
        format: 'sqlite',
        description: 'OmniFocus SQLite database file'
      }
    } else {
      return {
        format: 'unknown',
        description: 'Unknown file format'
      }
    }
  }
}

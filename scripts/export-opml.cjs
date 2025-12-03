#!/usr/bin/env node
// OPML Export Script for OmniFocus
// Exports active folders, projects, and tasks to OPML format for MindNode import

const path = require('path')
const fs = require('fs').promises
const os = require('os')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

// Import the SQLite reader
const sqliteReader = require('../electron/omnifocus-sqlite-reader.cjs')

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Get folder path for a project by querying SQLite database
 * Uses ProjectInfo.folder to find the containing folder, then traverses up the folder hierarchy
 */
function getProjectFolderPathFromDB(db, projectId, projectInfoPk) {
  try {
    if (!projectInfoPk) {
      return ''
    }
    
    // Get the folder ID from ProjectInfo
    const projectInfoQuery = `
      SELECT folder
      FROM ProjectInfo
      WHERE pk = ?
    `
    const projectInfoStmt = db.prepare(projectInfoQuery)
    const projectInfo = projectInfoStmt.get(projectInfoPk)
    
    if (!projectInfo || !projectInfo.folder) {
      return ''
    }
    
    // Build folder path by traversing up the folder hierarchy
    const pathParts = []
    let currentFolderId = projectInfo.folder
    let depth = 0
    const maxDepth = 20
    
    while (currentFolderId && depth < maxDepth) {
      // Get folder info
      const folderQuery = `
        SELECT persistentIdentifier, name, parent
        FROM Folder
        WHERE persistentIdentifier = ?
      `
      const folderStmt = db.prepare(folderQuery)
      const folder = folderStmt.get(currentFolderId)
      
      if (!folder || !folder.name) {
        break
      }
      
      pathParts.unshift(folder.name)
      
      // Move to parent folder
      if (!folder.parent) {
        break
      }
      
      currentFolderId = folder.parent
      depth++
    }
    
    return pathParts.join(' > ')
  } catch (error) {
    // Return empty if query fails
    return ''
  }
}

/**
 * Get folder paths for all projects from SQLite
 */
function getFolderPathsFromDB(db, projects) {
  const folderPaths = new Map()
  
  // Build a map of project ID to projectInfo PK
  const projectInfoMap = new Map()
  for (const project of projects) {
    // The projectInfo field should contain the PK
    // We need to get it from the database
    const query = `
      SELECT pk
      FROM ProjectInfo
      WHERE task = ?
    `
    const stmt = db.prepare(query)
    const result = stmt.get(project.id)
    if (result) {
      projectInfoMap.set(project.id, result.pk)
    }
  }
  
  // Get folder paths for each project
  for (const project of projects) {
    const projectInfoPk = projectInfoMap.get(project.id)
    if (projectInfoPk) {
      const folderPath = getProjectFolderPathFromDB(db, project.id, projectInfoPk)
      if (folderPath) {
        folderPaths.set(project.id, folderPath)
      }
    }
  }
  
  return folderPaths
}

/**
 * Build folder hierarchy from folder paths
 */
function buildFolderHierarchy(projects) {
  const folderTree = {}
  
  for (const project of projects) {
    const folderPath = project.folderPath || ''
    const parts = folderPath.split(' > ').filter(p => p.trim() !== '')
    
    if (parts.length === 0) {
      // Project is at root level
      if (!folderTree._root) {
        folderTree._root = []
      }
      folderTree._root.push(project)
    } else {
      // Navigate/create folder structure
      let current = folderTree
      for (let i = 0; i < parts.length; i++) {
        const folderName = parts[i]
        if (!current[folderName]) {
          current[folderName] = { _projects: [] }
        }
        current = current[folderName]
      }
      current._projects.push(project)
    }
  }
  
  return folderTree
}

/**
 * Generate OPML outline element
 */
function generateOutline(text, children = [], baseIndent = '    ') {
  const escapedText = escapeXml(text)
  if (children.length === 0) {
    return `${baseIndent}<outline text="${escapedText}"/>`
  }
  
  const childrenXml = children.join('\n')
  return `${baseIndent}<outline text="${escapedText}">\n${childrenXml}\n${baseIndent}</outline>`
}

/**
 * Convert folder tree to OPML outlines
 */
function folderTreeToOutlines(folderTree, baseIndent = '    ') {
  const outlines = []
  
  // Process root projects first
  if (folderTree._root && folderTree._root.length > 0) {
    for (const project of folderTree._root) {
      outlines.push(...projectToOutlines(project, baseIndent))
    }
  }
  
  // Process folders (sort alphabetically for consistent output)
  const folderKeys = Object.keys(folderTree)
    .filter(key => key !== '_root' && key !== '_projects')
    .sort()
  
  for (const folderName of folderKeys) {
    const folderData = folderTree[folderName]
    const folderOutlines = []
    
    // Add projects in this folder
    if (folderData._projects && folderData._projects.length > 0) {
      for (const project of folderData._projects) {
        folderOutlines.push(...projectToOutlines(project, baseIndent + '    '))
      }
    }
    
    // Add subfolders recursively
    const subfolderOutlines = folderTreeToOutlines(folderData, baseIndent + '    ')
    folderOutlines.push(...subfolderOutlines)
    
    // Create folder outline only if it has content
    if (folderOutlines.length > 0) {
      const folderOutline = generateOutline(folderName, folderOutlines, baseIndent)
      outlines.push(folderOutline)
    }
  }
  
  return outlines
}

/**
 * Convert project to OPML outlines
 */
function projectToOutlines(project, baseIndent = '    ') {
  const outlines = []
  
  // Filter active tasks (exclude completed and blocked)
  const activeTasks = (project.tasks || []).filter(task => {
    return !task.completed && task.status !== 'blocked'
  })
  
  if (activeTasks.length === 0) {
    // Project with no active tasks - just the project name
    outlines.push(generateOutline(project.name, [], baseIndent))
  } else {
    // Project with tasks
    const taskOutlines = activeTasks.map(task => {
      return generateOutline(task.name, [], baseIndent + '    ')
    })
    outlines.push(generateOutline(project.name, taskOutlines, baseIndent))
  }
  
  return outlines
}

/**
 * Generate OPML XML
 */
function generateOPML(projects) {
  const dateCreated = new Date().toISOString()
  
  // Build folder hierarchy
  const folderTree = buildFolderHierarchy(projects)
  
  // Convert to OPML outlines
  const outlines = folderTreeToOutlines(folderTree)
  
  // Build OPML document
  const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <dateCreated>${dateCreated}</dateCreated>
  </head>
  <body>
${outlines.join('\n')}
  </body>
</opml>`
  
  return opml
}

/**
 * Main export function
 */
async function exportToOPML(outputPath) {
  try {
    console.log('📊 Starting OmniFocus OPML export...')
    
    // Check if database exists
    if (!sqliteReader.databaseExists()) {
      throw new Error('OmniFocus database not found. Make sure OmniFocus is installed.')
    }
    
    // Open database for folder path queries
    const db = sqliteReader.openDatabase()
    
    try {
      // Get active projects using existing function
      console.log('📂 Loading projects...')
      const projects = sqliteReader.getProjects()
      
      // Filter for active projects only
      const activeProjects = projects.filter(p => p.status === 'active')
      console.log(`✅ Found ${activeProjects.length} active projects`)
      
      // Get folder paths from SQLite database
      console.log('📁 Getting folder paths from database...')
      const folderPaths = getFolderPathsFromDB(db, activeProjects)
      console.log(`   Found folder paths for ${folderPaths.size}/${activeProjects.length} projects`)
      
      // Show samples
      let sampleCount = 0
      for (const [projectId, folderPath] of folderPaths.entries()) {
        if (sampleCount < 3) {
          const project = activeProjects.find(p => p.id === projectId)
          if (project) {
            console.log(`   Sample: "${project.name}" → "${folderPath}"`)
            sampleCount++
          }
        }
      }
      
      // Combine projects with folder paths
      const projectsWithFolders = activeProjects.map(project => ({
        ...project,
        folderPath: folderPaths.get(project.id) || ''
      }))
      
      // Generate OPML
      console.log('📝 Generating OPML...')
      const opml = generateOPML(projectsWithFolders)
      
      // Write to file
      console.log(`💾 Writing to ${outputPath}...`)
      await fs.writeFile(outputPath, opml, 'utf8')
      
      console.log(`✅ Export complete! Saved to ${outputPath}`)
      console.log(`📊 Exported ${activeProjects.length} projects`)
      
      const totalTasks = activeProjects.reduce((sum, p) => {
        const activeTasks = (p.tasks || []).filter(t => !t.completed && t.status !== 'blocked')
        return sum + activeTasks.length
      }, 0)
      console.log(`📋 Exported ${totalTasks} active tasks`)
      
    } finally {
      db.close()
    }
    
  } catch (error) {
    console.error('❌ Export failed:', error.message)
    if (error.message.includes('locked')) {
      console.error('   Make sure OmniFocus is not running or close it and try again.')
    }
    process.exit(1)
  }
}

// Main execution
const outputPath = process.argv[2] || path.join(os.homedir(), 'Desktop', 'omnifocus-export.opml')

exportToOPML(outputPath).catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})


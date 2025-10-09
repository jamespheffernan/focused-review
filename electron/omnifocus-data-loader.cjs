// OmniFocus Data Loader with SQLite → JXA Fallback
// Tries SQLite first for speed, falls back to JXA if needed

const sqliteReader = require('./omnifocus-sqlite-reader.cjs')

const DataSource = {
  SQLITE: 'sqlite',
  JXA: 'jxa'
}

/**
 * Load OmniFocus data with automatic fallback
 * Tries SQLite first (fast), falls back to JXA if needed (slow but reliable)
 * 
 * @param {Function} jxaLoader - Async function that loads data via JXA
 * @returns {Promise<{projects: any[], source: string, error?: string}>}
 */
async function loadOmniFocusData(jxaLoader) {
  // Try SQLite first
  try {
    console.log('🚀 [DataLoader] Attempting SQLite read...')
    
    if (!sqliteReader.databaseExists()) {
      throw new Error('Database file not found')
    }
    
    const projects = sqliteReader.getProjects()
    
    console.log(`✅ [DataLoader] SQLite read successful: ${projects.length} projects`)
    
    return {
      projects,
      source: DataSource.SQLITE
    }
  } catch (sqliteError) {
    console.warn('⚠️  [DataLoader] SQLite failed, falling back to JXA:', sqliteError.message)
    
    // Fall back to JXA
    try {
      console.log('🔄 [DataLoader] Attempting JXA read...')
      const projects = await jxaLoader()
      
      console.log(`✅ [DataLoader] JXA read successful: ${projects.length} projects`)
      
      return {
        projects,
        source: DataSource.JXA,
        error: sqliteError.message
      }
    } catch (jxaError) {
      console.error('❌ [DataLoader] Both methods failed!')
      console.error('  SQLite error:', sqliteError.message)
      console.error('  JXA error:', jxaError.message)
      
      throw new Error(
        `Both methods failed. SQLite: ${sqliteError.message}, JXA: ${jxaError.message}`
      )
    }
  }
}

module.exports = {
  loadOmniFocusData,
  DataSource
}


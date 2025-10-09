// Sync Manager Service
// Manages synchronization state and timing for OmniFocus integration

export class SyncManager {
  private readonly LAST_SYNC_KEY = 'omnifocus_last_sync'
  private readonly AUTO_SYNC_THRESHOLD_MINUTES = 60 // Auto-sync if data is older than 60 minutes
  private readonly DATA_SOURCE_KEY = 'omnifocus_data_source'
  private readonly FALLBACK_REASON_KEY = 'omnifocus_fallback_reason'
  
  private dataSource: 'sqlite' | 'jxa' = 'sqlite'
  private fallbackReason?: string

  /**
   * Get the timestamp of the last successful sync
   */
  getLastSyncTimestamp(): Date | null {
    const timestamp = localStorage.getItem(this.LAST_SYNC_KEY)
    return timestamp ? new Date(timestamp) : null
  }

  /**
   * Update the last sync timestamp to now
   */
  setLastSyncTimestamp(date: Date = new Date()): void {
    localStorage.setItem(this.LAST_SYNC_KEY, date.toISOString())
  }

  /**
   * Clear the last sync timestamp (for testing or reset)
   */
  clearLastSyncTimestamp(): void {
    localStorage.removeItem(this.LAST_SYNC_KEY)
  }

  /**
   * Check if we should automatically sync based on age of cached data
   * @param maxAgeMinutes - Maximum age in minutes before suggesting sync (default: 60)
   * @returns true if data is stale and should be synced
   */
  shouldAutoSync(maxAgeMinutes: number = this.AUTO_SYNC_THRESHOLD_MINUTES): boolean {
    const lastSync = this.getLastSyncTimestamp()
    
    // No previous sync - should sync
    if (!lastSync) return true
    
    // Calculate age in minutes
    const ageMinutes = (Date.now() - lastSync.getTime()) / (1000 * 60)
    
    return ageMinutes > maxAgeMinutes
  }

  /**
   * Get a human-readable string describing how long ago the last sync was
   * @returns Formatted string like "5 minutes ago", "2 hours ago", "Never synced"
   */
  getTimeSinceLastSync(): string {
    const lastSync = this.getLastSyncTimestamp()
    
    if (!lastSync) return 'Never synced'
    
    const minutes = Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60))
    
    if (minutes < 1) return 'Just now'
    if (minutes === 1) return '1 minute ago'
    if (minutes < 60) return `${minutes} minutes ago`
    
    const hours = Math.floor(minutes / 60)
    if (hours === 1) return '1 hour ago'
    if (hours < 24) return `${hours} hours ago`
    
    const days = Math.floor(hours / 24)
    if (days === 1) return '1 day ago'
    return `${days} days ago`
  }

  /**
   * Get the age of cached data in minutes
   * @returns Number of minutes since last sync, or null if never synced
   */
  getCacheAgeMinutes(): number | null {
    const lastSync = this.getLastSyncTimestamp()
    if (!lastSync) return null
    
    return Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60))
  }

  /**
   * Check if cache exists (has been synced at least once)
   */
  hasCachedData(): boolean {
    return this.getLastSyncTimestamp() !== null
  }

  /**
   * Set the data source used for the last sync
   */
  setDataSource(source: 'sqlite' | 'jxa', reason?: string): void {
    this.dataSource = source
    this.fallbackReason = reason
    
    // Persist to localStorage
    localStorage.setItem(this.DATA_SOURCE_KEY, source)
    if (reason) {
      localStorage.setItem(this.FALLBACK_REASON_KEY, reason)
    } else {
      localStorage.removeItem(this.FALLBACK_REASON_KEY)
    }
  }

  /**
   * Get the current data source and fallback reason
   */
  getDataSource(): { source: 'sqlite' | 'jxa'; reason?: string } {
    // Try to get from window global first (set by bridge during sync)
    if (typeof window !== 'undefined' && (window as any).__omnifocusDataSource) {
      const { source, reason } = (window as any).__omnifocusDataSource
      return { source: source || this.dataSource, reason }
    }
    
    // Fall back to stored values
    const storedSource = localStorage.getItem(this.DATA_SOURCE_KEY) as 'sqlite' | 'jxa' | null
    const storedReason = localStorage.getItem(this.FALLBACK_REASON_KEY) || undefined
    
    return {
      source: storedSource || this.dataSource,
      reason: storedReason || this.fallbackReason
    }
  }

  /**
   * Clear data source info
   */
  clearDataSource(): void {
    this.dataSource = 'sqlite'
    this.fallbackReason = undefined
    localStorage.removeItem(this.DATA_SOURCE_KEY)
    localStorage.removeItem(this.FALLBACK_REASON_KEY)
  }
}

// Singleton instance
export const syncManager = new SyncManager()


// utils/calendar-utils.ts
import type { TimelineCommitmentDTO } from '../types'

/**
 * Get the start and end dates for the calendar view (today + 3 months)
 */
export function getCalendarDateRange(): { startDate: Date; endDate: Date } {
  const startDate = new Date()
  startDate.setHours(0, 0, 0, 0)
  
  const endDate = new Date(startDate)
  endDate.setMonth(endDate.getMonth() + 3)
  
  return { startDate, endDate }
}

/**
 * Calculate the color for a timeline bar based on proximity to committed date
 */
export function getTimelineColor(committedDate: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const commitDate = new Date(committedDate)
  commitDate.setHours(0, 0, 0, 0)
  
  const daysUntil = Math.floor((commitDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  // Past due
  if (daysUntil < 0) {
    return '#9E9E9E' // Gray
  }
  
  // Near-term (< 2 weeks / 14 days)
  if (daysUntil < 14) {
    return '#FF5722' // Red/orange
  }
  
  // Medium-term (2-8 weeks / 14-56 days)
  if (daysUntil < 56) {
    return '#FFC107' // Yellow
  }
  
  // Long-term (> 8 weeks)
  return '#4CAF50' // Green
}

/**
 * Check if a date is past due
 */
export function isPastDue(committedDate: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const commitDate = new Date(committedDate)
  commitDate.setHours(0, 0, 0, 0)
  
  return commitDate < today
}

/**
 * Format date for display (e.g., "Nov 15, 2025")
 */
export function formatDisplayDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
}

/**
 * Format date for week label (e.g., "Week of Oct 21, 2025")
 */
export function formatWeekLabel(weekOf: string): string {
  const date = new Date(weekOf)
  return `Week of ${date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })}`
}

/**
 * Group commitments by date for stacking visualization
 */
export function groupCommitmentsByDate(
  commitments: TimelineCommitmentDTO[]
): Map<string, TimelineCommitmentDTO[]> {
  const grouped = new Map<string, TimelineCommitmentDTO[]>()
  
  for (const commitment of commitments) {
    const existing = grouped.get(commitment.committedDate) || []
    existing.push(commitment)
    grouped.set(commitment.committedDate, existing)
  }
  
  return grouped
}

/**
 * Calculate position percentage for a date on the timeline
 */
export function calculatePositionPercent(
  date: string,
  startDate: Date,
  endDate: Date
): number {
  const targetDate = new Date(date)
  const totalDuration = endDate.getTime() - startDate.getTime()
  const elapsed = targetDate.getTime() - startDate.getTime()
  
  return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100))
}

/**
 * Truncate long project names for display
 */
export function truncateProjectName(name: string, maxLength: number = 40): string {
  if (name.length <= maxLength) {
    return name
  }
  return name.substring(0, maxLength - 3) + '...'
}

/**
 * Get the ISO week offset (for navigating weeks)
 */
export function getWeekOffset(weekOf: string, offset: number): string {
  const date = new Date(weekOf)
  date.setDate(date.getDate() + (offset * 7))
  return date.toISOString().slice(0, 10)
}

/**
 * Generate month markers for the timeline axis
 */
export function generateMonthMarkers(startDate: Date, endDate: Date): Array<{ label: string; position: number }> {
  const markers: Array<{ label: string; position: number }> = []
  const current = new Date(startDate)
  current.setDate(1) // Start of month
  
  while (current <= endDate) {
    const position = calculatePositionPercent(
      current.toISOString().slice(0, 10),
      startDate,
      endDate
    )
    
    markers.push({
      label: current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      position
    })
    
    // Move to next month
    current.setMonth(current.getMonth() + 1)
  }
  
  return markers
}


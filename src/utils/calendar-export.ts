// utils/calendar-export.ts
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { TimelineCommitmentDTO } from '../types'
import {
  calculatePositionPercent,
  formatDisplayDate,
  formatWeekLabel,
  generateMonthMarkers,
  getCalendarDateRange,
  getWeekStartForDate,
  isPastDue
} from './calendar-utils'

/**
 * Export the calendar as a PNG image
 * @param weekOf The week identifier for filename
 */
export async function exportCalendarAsPNG(weekOf: string): Promise<void> {
  const container = document.getElementById('calendar-export-container')
  
  if (!container) {
    throw new Error('Calendar container not found')
  }

  try {
    // Create canvas from the calendar container
    const canvas = await html2canvas(container, {
      backgroundColor: '#14141e',
      scale: 2, // Higher resolution
      logging: false,
      useCORS: true,
      allowTaint: true
    })

    // Convert canvas to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) {
          resolve(b)
        } else {
          reject(new Error('Failed to create blob from canvas'))
        }
      }, 'image/png')
    })

    // Create download link
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Weekly-Review-Calendar-${weekOf}.png`
    
    // Trigger download
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Cleanup
    URL.revokeObjectURL(url)
    
    console.log(`✅ Calendar exported: ${link.download}`)
  } catch (error) {
    console.error('❌ Calendar export error:', error)
    throw error
  }
}

/**
 * Get pattern style for black-and-white printing based on timeline color
 * Returns a pattern identifier for use in PDF rendering
 */
function getPatternForTimeline(daysUntil: number): 'solid' | 'dashed' | 'dotted' | 'dash-dot' {
  if (daysUntil < 0) {
    return 'dotted' // Past due
  }
  if (daysUntil < 14) {
    return 'solid' // < 2 weeks
  }
  if (daysUntil < 56) {
    return 'dashed' // 2-8 weeks
  }
  return 'dash-dot' // > 8 weeks
}

/**
 * Calculate days until a date
 */
function getDaysUntil(date: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)
  return Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Draw a line with pattern in jsPDF
 */
function drawPatternedLine(
  doc: jsPDF,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  pattern: 'solid' | 'dashed' | 'dotted' | 'dash-dot',
  lineWidth: number = 0.5
): void {
  doc.setLineWidth(lineWidth)
  
  if (pattern === 'solid') {
    doc.line(x1, y1, x2, y2)
    return
  }
  
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.sqrt(dx * dx + dy * dy)
  
  if (pattern === 'dashed') {
    const dashLength = 3
    const gapLength = 2
    const steps = Math.floor(length / (dashLength + gapLength))
    const stepX = (dx / length) * (dashLength + gapLength)
    const stepY = (dy / length) * (dashLength + gapLength)
    
    for (let i = 0; i < steps; i++) {
      const startX = x1 + i * stepX
      const startY = y1 + i * stepY
      const endX = startX + (dx / length) * dashLength
      const endY = startY + (dy / length) * dashLength
      doc.line(startX, startY, endX, endY)
    }
    return
  }
  
  if (pattern === 'dotted') {
    const dotSpacing = 2
    const steps = Math.floor(length / dotSpacing)
    const stepX = (dx / length) * dotSpacing
    const stepY = (dy / length) * dotSpacing
    
    for (let i = 0; i < steps; i++) {
      const x = x1 + i * stepX
      const y = y1 + i * stepY
      doc.circle(x, y, 0.3, 'F')
    }
    return
  }
  
  if (pattern === 'dash-dot') {
    const dashLength = 4
    const dotLength = 1
    const gapLength = 2
    const segmentLength = dashLength + gapLength + dotLength + gapLength
    const steps = Math.floor(length / segmentLength)
    const stepX = (dx / length) * segmentLength
    const stepY = (dy / length) * segmentLength
    
    for (let i = 0; i < steps; i++) {
      const baseX = x1 + i * stepX
      const baseY = y1 + i * stepY
      doc.line(
        baseX,
        baseY,
        baseX + (dx / length) * dashLength,
        baseY + (dy / length) * dashLength
      )
      const dotX = baseX + (dx / length) * (dashLength + gapLength)
      const dotY = baseY + (dy / length) * (dashLength + gapLength)
      doc.circle(dotX, dotY, 0.3, 'F')
    }
  }
}

/**
 * Export the calendar as a PDF optimized for A4 black-and-white printing
 * @param weekOf The week identifier for filename
 * @param commitments The commitments to include in the export
 */
export async function exportCalendarAsPDF(
  weekOf: string,
  commitments: TimelineCommitmentDTO[]
): Promise<void> {
  try {
    const A4_WIDTH = 210
    const A4_HEIGHT = 297
    const MARGIN_TOP = 12
    const MARGIN_BOTTOM = 12
    const FOOTER_RESERVE = 32
    const CONTENT_WIDTH = A4_WIDTH - (MARGIN_TOP * 2)
    const TIMELINE_OFFSET = 60
    const MIN_ROW_HEIGHT = 10
    const MAX_ROW_HEIGHT = 22
    const PAGE_CONTENT_LIMIT = A4_HEIGHT - MARGIN_BOTTOM - FOOTER_RESERVE
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, A4_WIDTH, A4_HEIGHT, 'F')
    doc.setTextColor(0, 0, 0)
    doc.setDrawColor(0, 0, 0)
    
    let yPos = MARGIN_TOP
    const resetForNewPage = () => {
      doc.addPage()
      doc.setTextColor(0, 0, 0)
      doc.setDrawColor(0, 0, 0)
      yPos = MARGIN_TOP
    }
    
    const reserveSpace = (height: number) => {
      if (yPos + height > PAGE_CONTENT_LIMIT) {
        resetForNewPage()
      }
    }
    
    // Header
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(formatWeekLabel(weekOf), MARGIN_TOP, yPos)
    yPos += 8
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const exportDate = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    doc.text(`Exported: ${exportDate}`, MARGIN_TOP, yPos)
    yPos += 10
    
    // Date calculations
    const { startDate, endDate } = getCalendarDateRange()
    const sortedCommitments = [...commitments].sort((a, b) =>
      a.committedDate.localeCompare(b.committedDate)
    )
    const commitmentsWithWeek = sortedCommitments.map(commitment => ({
      commitment,
      weekStart: getWeekStartForDate(commitment.committedDate)
    }))
    
    // Week shading (for both axis + rows)
    const weeksInRange: Array<{ weekStart: string; startPercent: number; endPercent: number; shade: number }> = []
    let currentDate = new Date(startDate)
    let weekIndex = 0
    while (currentDate <= endDate) {
      const weekStart = getWeekStartForDate(currentDate.toISOString().slice(0, 10))
      const weekStartDate = new Date(weekStart)
      weekStartDate.setHours(0, 0, 0, 0)
      const weekStartPercent = calculatePositionPercent(
        weekStart,
        startDate,
        endDate
      )
      const weekEndDate = new Date(weekStartDate)
      weekEndDate.setDate(weekEndDate.getDate() + 7)
      const weekEndPercent = Math.min(100, calculatePositionPercent(
        weekEndDate.toISOString().slice(0, 10),
        startDate,
        endDate
      ))
      weeksInRange.push({
        weekStart,
        startPercent: weekStartPercent,
        endPercent: weekEndPercent,
        shade: weekIndex % 2
      })
      currentDate = new Date(weekEndDate)
      weekIndex++
    }
    
    // Timeline axis (only once at the top of the export)
    const timelineY = yPos
    const timelineHeight = 8
    const timelineStartX = MARGIN_TOP + TIMELINE_OFFSET
    const timelineWidth = CONTENT_WIDTH - TIMELINE_OFFSET
    
    weeksInRange.forEach(week => {
      const weekStartX = timelineStartX + (week.startPercent / 100) * timelineWidth
      const weekEndX = timelineStartX + (week.endPercent / 100) * timelineWidth
      const weekWidth = weekEndX - weekStartX
      const shadeColor = week.shade === 0 ? 255 : 245
      doc.setFillColor(shadeColor, shadeColor, shadeColor)
      doc.rect(weekStartX, timelineY - 2, weekWidth, timelineHeight + 2, 'F')
    })
    
    doc.setLineWidth(0.5)
    doc.line(timelineStartX, timelineY, timelineStartX + timelineWidth, timelineY)
    
    const monthMarkers = generateMonthMarkers(startDate, endDate)
    monthMarkers.forEach(marker => {
      const markerX = timelineStartX + (marker.position / 100) * timelineWidth
      doc.setLineWidth(0.3)
      doc.line(markerX, timelineY - 2, markerX, timelineY + 2)
      doc.setFontSize(7)
      doc.text(marker.label, markerX, timelineY - 4, { align: 'center' })
    })
    
    yPos += timelineHeight + 6
    
    const drawLegend = () => {
      reserveSpace(22)
      doc.setLineWidth(0.3)
      doc.line(MARGIN_TOP, yPos, A4_WIDTH - MARGIN_TOP, yPos)
      yPos += 8
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('Legend:', MARGIN_TOP, yPos)
      yPos += 6
      
      const legendItems = [
        { pattern: 'solid' as const, label: '< 2 weeks' },
        { pattern: 'dashed' as const, label: '2-8 weeks' },
        { pattern: 'dash-dot' as const, label: '> 8 weeks' },
        { pattern: 'dotted' as const, label: 'Past due' }
      ]
      
      let legendX = MARGIN_TOP
      const legendSpacing = 40
      legendItems.forEach(item => {
        if (legendX + legendSpacing > A4_WIDTH - MARGIN_TOP) {
          legendX = MARGIN_TOP
          yPos += 8
        }
        const lineY = yPos
        drawPatternedLine(
          doc,
          legendX,
          lineY,
          legendX + 15,
          lineY,
          item.pattern,
          1
        )
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(item.label, legendX + 18, lineY + 1)
        legendX += legendSpacing
      })
      yPos += 6
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(128, 128, 128)
      doc.text(
        `${commitments.length} ${commitments.length === 1 ? 'commitment' : 'commitments'}`,
        MARGIN_TOP,
        A4_HEIGHT - MARGIN_BOTTOM,
        { align: 'left' }
      )
      doc.setTextColor(0, 0, 0)
    }
    
    commitmentsWithWeek.forEach(({ commitment, weekStart }, index: number) => {
      reserveSpace(MIN_ROW_HEIGHT + 4)
      
      const prevWeekStart = index > 0 ? commitmentsWithWeek[index - 1].weekStart : null
      const isDifferentWeek = prevWeekStart !== null && prevWeekStart !== weekStart
      
      const pastDue = isPastDue(commitment.committedDate)
      const daysUntil = getDaysUntil(commitment.committedDate)
      const pattern = getPatternForTimeline(daysUntil)
      const endPosition = calculatePositionPercent(
        commitment.committedDate,
        startDate,
        endDate
      )
      
      doc.setFontSize(8)
      const projectNameLines = doc.splitTextToSize(commitment.projectName, 55)
      const textHeight = projectNameLines.length * 4.2 + 2
      const rowsRemaining = commitmentsWithWeek.length - index
      const heightBudget = Math.max(PAGE_CONTENT_LIMIT - yPos, MIN_ROW_HEIGHT * rowsRemaining)
      const dynamicHeight = Math.min(
        MAX_ROW_HEIGHT,
        Math.max(MIN_ROW_HEIGHT, heightBudget / rowsRemaining)
      )
      const actualRowHeight = Math.max(dynamicHeight, textHeight)
      const rowTop = yPos
      
      if (isDifferentWeek) {
        doc.setLineWidth(0.8)
        doc.line(MARGIN_TOP, yPos, A4_WIDTH - MARGIN_TOP, yPos)
        yPos += 1
      }
      
      weeksInRange.forEach(week => {
        const weekStartX = timelineStartX + (week.startPercent / 100) * timelineWidth
        const weekEndX = timelineStartX + (week.endPercent / 100) * timelineWidth
        const weekWidth = weekEndX - weekStartX
        const fill = week.shade === 0 ? 255 : 245
        doc.setFillColor(fill, fill, fill)
        doc.rect(weekStartX, rowTop, weekWidth, actualRowHeight, 'F')
      })
      
      doc.setFont('helvetica', pastDue ? 'italic' : 'normal')
      doc.setTextColor(pastDue ? 128 : 0, pastDue ? 128 : 0, pastDue ? 128 : 0)
      doc.text(projectNameLines, MARGIN_TOP, yPos + 4, {
        maxWidth: 55,
        align: 'left',
        lineHeightFactor: 1.3
      })
      doc.setTextColor(0, 0, 0)
      
      const barStartX = timelineStartX
      const barEndX = timelineStartX + (endPosition / 100) * timelineWidth
      const timelineBarY = yPos + Math.min(actualRowHeight - 4, 6)
      
      doc.setDrawColor(0, 0, 0)
      drawPatternedLine(doc, barStartX, timelineBarY, barEndX, timelineBarY, pattern, 1.2)
      
      doc.setLineWidth(0.5)
      doc.setFillColor(0, 0, 0)
      doc.circle(barEndX, timelineBarY, 1.5, 'FD')
      
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      const dateLabel = formatDisplayDate(commitment.committedDate)
      doc.text(dateLabel, barEndX, timelineBarY + 5, {
        align: 'center'
      })
      
      yPos += actualRowHeight + 2
    })
    
    drawLegend()
    
    const filename = `Weekly-Review-Calendar-${weekOf}.pdf`
    doc.save(filename)
    console.log(`✅ Calendar exported as PDF: ${filename}`)
  } catch (error) {
    console.error('❌ Calendar PDF export error:', error)
    throw error
  }
}


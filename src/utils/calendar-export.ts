// utils/calendar-export.ts
import html2canvas from 'html2canvas'

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


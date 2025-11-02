// utils/date-parser.ts
import * as chrono from 'chrono-node';

/**
 * Parse natural language date input to ISO date string (YYYY-MM-DD)
 * 
 * Examples:
 * - "tomorrow" -> "2025-10-10"
 * - "next friday" -> "2025-10-11"
 * - "in 2 weeks" -> "2025-10-23"
 * - "monday" (on thursday) -> "next monday" -> "2025-10-13"
 * 
 * @param text Natural language date string
 * @returns ISO date string (YYYY-MM-DD) or null if parsing fails
 */
export function parseNaturalDate(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  try {
    const result = chrono.parseDate(text);
    if (result) {
      // Check if date is in the past (before today at midnight)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (result < today) {
        // Retry with "next " prepended to get a future date
        const retryResult = chrono.parseDate(`next ${text}`);
        if (retryResult && retryResult >= today) {
          // Use the future date instead
          const year = retryResult.getFullYear();
          const month = String(retryResult.getMonth() + 1).padStart(2, '0');
          const day = String(retryResult.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      
      // Return original result (either future date or retry failed)
      const year = result.getFullYear();
      const month = String(result.getMonth() + 1).padStart(2, '0');
      const day = String(result.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  } catch (error) {
    console.error('Error parsing natural date:', error);
    return null;
  }
}

/**
 * Get a human-friendly description of what a natural date string represents
 * Useful for showing feedback to users
 * 
 * Applies the same future-correction logic as parseNaturalDate to ensure
 * preview matches the saved date value.
 * 
 * @param text Natural language date string
 * @returns Formatted date string or null
 */
export function describeNaturalDate(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  try {
    const result = chrono.parseDate(text);
    if (result) {
      // Check if date is in the past (before today at midnight)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let dateToFormat = result;
      
      if (result < today) {
        // Retry with "next " prepended to get a future date
        const retryResult = chrono.parseDate(`next ${text}`);
        if (retryResult && retryResult >= today) {
          // Use the future date instead
          dateToFormat = retryResult;
        }
      }
      
      return dateToFormat.toLocaleDateString('en-US', { 
        weekday: 'short',
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    return null;
  } catch (error) {
    return null;
  }
}




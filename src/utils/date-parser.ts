// utils/date-parser.ts
import * as chrono from 'chrono-node';

/**
 * Parse natural language date input to ISO date string (YYYY-MM-DD)
 * 
 * Examples:
 * - "tomorrow" -> "2025-10-10"
 * - "next friday" -> "2025-10-11"
 * - "in 2 weeks" -> "2025-10-23"
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
      // Format as YYYY-MM-DD for HTML date input
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
      return result.toLocaleDateString('en-US', { 
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




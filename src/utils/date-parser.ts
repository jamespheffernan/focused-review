// utils/date-parser.ts
import * as chrono from 'chrono-node';

// Create a custom chrono instance with enhanced parsing capabilities
const customChrono = chrono.casual.clone();

// Add refiners to improve date extraction
customChrono.refiners.push({
  refine: (context, results) => {
    // Forward date refiner: prefer future dates for relative expressions
    results.forEach((result) => {
      if (!result.start.isCertain('day') && !result.start.isCertain('month')) {
        // For vague dates, prefer future interpretation
        const refDate = result.refDate || new Date();
        if (result.start.date() < refDate) {
          // Adjust to future if parsed date is in the past
          const diff = refDate.getTime() - result.start.date().getTime();
          result.start.imply('day', result.start.date().getDate());
          result.start.imply('month', result.start.date().getMonth() + 1);
        }
      }
    });
    return results;
  }
});

/**
 * Parse natural language date input to ISO date string (YYYY-MM-DD)
 * Uses enhanced chrono parsing with fallback to "in " prepending
 * 
 * Examples:
 * - "tomorrow" -> "2025-10-10"
 * - "next friday" -> "2025-10-11"
 * - "in 2 weeks" -> "2025-10-23"
 * - "monday" (on thursday) -> "next monday" -> "2025-10-13"
 * - "2 weeks" -> tries "in 2 weeks" -> "2025-10-23"
 * 
 * @param text Natural language date string
 * @returns ISO date string (YYYY-MM-DD) or null if parsing fails
 */
export function parseNaturalDate(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  const trimmedText = text.trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper to convert Date to ISO string
  const toISOString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to parse and validate a date string
  const tryParse = (input: string): Date | null => {
    try {
      // Use parse() to get multiple results and pick the best one
      const results = customChrono.parse(input, today);
      if (results && results.length > 0) {
        // Get the first (most confident) result
        const result = results[0];
        if (result.start) {
          const parsedDate = result.start.date();
          // Ensure it's a future date
          if (parsedDate >= today) {
            return parsedDate;
          }
          // If in the past, try with "next " prepended
          if (!trimmedText.toLowerCase().startsWith('next ')) {
            const nextResults = customChrono.parse(`next ${input}`, today);
            if (nextResults && nextResults.length > 0) {
              const nextDate = nextResults[0].start.date();
              if (nextDate >= today) {
                return nextDate;
              }
            }
          }
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  // Try parsing the original text
  let parsedDate = tryParse(trimmedText);
  if (parsedDate) {
    return toISOString(parsedDate);
  }

  // If parsing failed and text doesn't already start with "in ", try with "in " prepended
  if (!trimmedText.toLowerCase().startsWith('in ')) {
    parsedDate = tryParse(`in ${trimmedText}`);
    if (parsedDate) {
      return toISOString(parsedDate);
    }
  }

  return null;
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

  // Use the same parsing logic as parseNaturalDate to ensure consistency
  const parsedDateString = parseNaturalDate(text);
  if (!parsedDateString) {
    return null;
  }

  try {
    // Parse the ISO string back to a Date object for formatting
    const [year, month, day] = parsedDateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch (error) {
    return null;
  }
}




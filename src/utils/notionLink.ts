/**
 * Notion Deep Link Utilities
 * 
 * Utilities for extracting and validating Notion deep links from project notes.
 * The convention is that Notion deep links should be placed on the first line of the notes field.
 */

/**
 * Extract the Notion deep link from the first line of project notes
 * 
 * @param notes - The notes field from a project (optional)
 * @returns The Notion URL if found and valid, null otherwise
 * 
 * @example
 * extractNotionLink("https://www.notion.so/myworkspace/My-Page-abc123\nMore notes here")
 * // Returns: "https://www.notion.so/myworkspace/My-Page-abc123"
 * 
 * extractNotionLink("Some random text\nhttps://notion.so/link")
 * // Returns: null (link not on first line)
 */
export function extractNotionLink(notes?: string): string | null {
  // Handle empty or undefined notes
  if (!notes || notes.trim() === '') {
    return null
  }

  // Extract the first line
  const firstLine = notes.split('\n')[0].trim()
  
  // Check if the first line is empty
  if (firstLine === '') {
    return null
  }

  // Validate that it's a Notion URL
  if (isValidNotionUrl(firstLine)) {
    return firstLine
  }

  return null
}

/**
 * Check if a URL is a valid Notion deep link
 * 
 * @param url - The URL to validate
 * @returns true if the URL is a valid Notion link, false otherwise
 * 
 * @example
 * isValidNotionUrl("https://www.notion.so/workspace/Page-123")
 * // Returns: true
 * 
 * isValidNotionUrl("https://google.com")
 * // Returns: false
 */
export function isValidNotionUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  try {
    const urlObj = new URL(url)
    
    // Check if it's a Notion domain
    const validDomains = [
      'www.notion.so',
      'notion.so'
    ]
    
    return validDomains.includes(urlObj.hostname)
  } catch (error) {
    // Invalid URL format
    return false
  }
}

/**
 * Get a user-friendly error message for missing or invalid Notion links
 * 
 * @param notes - The notes field from a project (optional)
 * @returns An error message explaining why the Notion link couldn't be found
 * 
 * @example
 * getNotionLinkError(undefined)
 * // Returns: "No notes found for this project. Add a Notion link on the first line of the project notes."
 */
export function getNotionLinkError(notes?: string): string {
  // No notes at all
  if (!notes || notes.trim() === '') {
    return 'No notes found for this project. Add a Notion link on the first line of the project notes.'
  }

  const firstLine = notes.split('\n')[0].trim()
  
  // First line is empty
  if (firstLine === '') {
    return 'The first line of notes is empty. Place your Notion link on the first line.'
  }

  // First line exists but isn't a valid Notion URL
  if (!isValidNotionUrl(firstLine)) {
    return `The first line doesn't contain a valid Notion link. Found: "${firstLine.substring(0, 50)}${firstLine.length > 50 ? '...' : ''}"`
  }

  // Shouldn't reach here, but provide a generic error
  return 'Unable to extract Notion link from project notes.'
}

/**
 * Check if a project has a valid Notion link in its notes
 * 
 * @param notes - The notes field from a project (optional)
 * @returns true if a valid Notion link exists, false otherwise
 */
export function hasNotionLink(notes?: string): boolean {
  return extractNotionLink(notes) !== null
}


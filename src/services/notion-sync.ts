// services/notion-sync.ts
import { Client } from '@notionhq/client'
import type { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints'
import { getProjectAnswersForWeek } from '../repos/answersRepo'
import { formatReviewAsMarkdown, getQuestionsForFormatting, getStartOfISOWeek } from './review-formatter'

/**
 * Notion API client configuration
 */
interface NotionConfig {
  token: string
  databaseId: string
  enabled: boolean
}

let notionClient: Client | null = null
let notionConfig: NotionConfig | null = null

/**
 * Initialize Notion client with environment variables
 * Returns true if successfully initialized, false if disabled/missing config
 */
export function initializeNotionClient(): boolean {
  try {
    // Read from environment variables (same as omnifocus-notion-sync)
    const token = process.env.NOTION_TOKEN
    const databaseId = process.env.NOTION_PROJECT_DB
    
    if (!token || !databaseId) {
      console.log('⚠️ Notion sync disabled: NOTION_TOKEN or NOTION_PROJECT_DB not set')
      notionConfig = { token: '', databaseId: '', enabled: false }
      return false
    }
    
    // Validate token format (basic check)
    if (!token.startsWith('secret_') && !token.startsWith('ntn_')) {
      console.warn('⚠️ Notion token format may be invalid')
    }
    
    // Initialize client
    notionClient = new Client({ auth: token })
    notionConfig = { token, databaseId, enabled: true }
    
    console.log('✅ Notion sync initialized successfully')
    return true
  } catch (error) {
    console.error('❌ Failed to initialize Notion client:', error)
    notionConfig = { token: '', databaseId: '', enabled: false }
    return false
  }
}

/**
 * Check if Notion sync is enabled and configured
 */
export function isNotionSyncEnabled(): boolean {
  return notionConfig?.enabled ?? false
}

/**
 * Find Notion page ID by OmniFocus project ID
 * Returns page ID if found, null if not found
 */
export async function findNotionPageByProjectId(projectId: string): Promise<string | null> {
  if (!notionClient || !notionConfig?.enabled) {
    throw new Error('Notion client not initialized')
  }
  
  try {
    // Query database filtering by OF-ID property
    // Type assertion needed due to incomplete type definitions in @notionhq/client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (notionClient.databases as any).query({
      database_id: notionConfig.databaseId,
      filter: {
        property: 'OF-ID',
        rich_text: {
          equals: projectId
        }
      }
    })
    
    if (response.results.length === 0) {
      console.log(`📄 No Notion page found for project: ${projectId}`)
      return null
    }
    
    if (response.results.length > 1) {
      console.warn(`⚠️ Multiple Notion pages found for project ${projectId}, using first one`)
    }
    
    const pageId = response.results[0].id
    console.log(`✅ Found Notion page ${pageId} for project ${projectId}`)
    return pageId
  } catch (error) {
    console.error(`❌ Error finding Notion page for project ${projectId}:`, error)
    throw error
  }
}

/**
 * Convert markdown text to Notion block objects
 * Handles headings, paragraphs, dividers, and basic formatting
 */
function markdownToNotionBlocks(markdown: string): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = []
  const lines = markdown.split('\n')
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Skip empty lines
    if (!trimmed) {
      continue
    }
    
    // Horizontal divider
    if (trimmed === '---') {
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {}
      })
      continue
    }
    
    // Heading 2 (## )
    if (trimmed.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{
            type: 'text',
            text: { content: trimmed.slice(3) }
          }]
        }
      })
      continue
    }
    
    // Heading 3 (### )
    if (trimmed.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{
            type: 'text',
            text: { content: trimmed.slice(4) }
          }]
        }
      })
      continue
    }
    
    // Regular paragraph (including bold text with **)
    // For now, we'll keep bold markers in the text
    // Notion API supports rich text formatting, but we'll keep it simple
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{
          type: 'text',
          text: { content: line } // Keep original formatting
        }]
      }
    })
  }
  
  return blocks
}

/**
 * Append review log blocks to a Notion page
 * Adds the formatted review content to the end of the page
 */
export async function appendReviewToNotionPage(
  pageId: string,
  markdownContent: string
): Promise<void> {
  if (!notionClient || !notionConfig?.enabled) {
    throw new Error('Notion client not initialized')
  }
  
  try {
    // Convert markdown to Notion blocks
    const blocks = markdownToNotionBlocks(markdownContent)
    
    if (blocks.length === 0) {
      console.warn('⚠️ No blocks to append (empty content)')
      return
    }
    
    // Append blocks to the page
    // Note: Notion API limits to 100 blocks per request
    // For review logs, we should stay well under this limit
    await notionClient.blocks.children.append({
      block_id: pageId,
      children: blocks
    })
    
    console.log(`✅ Successfully appended ${blocks.length} blocks to Notion page ${pageId}`)
  } catch (error) {
    console.error(`❌ Error appending review to Notion page ${pageId}:`, error)
    throw error
  }
}

/**
 * Check if a review for a specific week already exists on the Notion page
 * Helps prevent duplicate entries for the same week
 */
export async function checkDuplicateReview(
  pageId: string,
  weekOf: string
): Promise<boolean> {
  if (!notionClient || !notionConfig?.enabled) {
    throw new Error('Notion client not initialized')
  }
  
  try {
    // Fetch all blocks from the page
    const response = await notionClient.blocks.children.list({
      block_id: pageId
    })
    
    // Search for a paragraph containing "Week of {weekOf}"
    // This is a simple check - in practice, we might want more sophisticated duplicate detection
    const weekString = `Week of ${weekOf}`
    
    for (const block of response.results) {
      if ('type' in block && block.type === 'paragraph') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const paragraph = block as any
        if (paragraph.paragraph?.rich_text) {
          for (const richText of paragraph.paragraph.rich_text) {
            if (richText.plain_text && richText.plain_text.includes(weekString)) {
              console.log(`⚠️ Review for ${weekOf} already exists on page ${pageId}`)
              return true
            }
          }
        }
      }
    }
    
    return false
  } catch (error) {
    console.error(`❌ Error checking for duplicate review on page ${pageId}:`, error)
    // If we can't check, assume no duplicate to allow sync attempt
    return false
  }
}

/**
 * Main sync function: Sync a project's weekly review to Notion
 * This orchestrates the entire sync process
 * 
 * @param projectId - OmniFocus project ID
 * @param weekOf - Week date (ISO format, e.g., "2025-10-01"). If not provided, uses current week.
 * @returns true if sync succeeded, false if skipped/failed
 */
export async function syncReviewToNotion(
  projectId: string,
  weekOf?: string
): Promise<boolean> {
  // Use current week if not specified
  const reviewWeek = weekOf || getStartOfISOWeek()
  
  console.log(`🔄 Starting Notion sync for project ${projectId}, week ${reviewWeek}`)
  
  // Check if Notion sync is enabled
  if (!isNotionSyncEnabled()) {
    console.log('⏭️ Notion sync disabled, skipping')
    return false
  }
  
  try {
    // Step 1: Get answers for this project and week
    const answers = await getProjectAnswersForWeek(projectId, reviewWeek)
    
    if (answers.length === 0) {
      console.log(`⏭️ No answers found for project ${projectId}, week ${reviewWeek}`)
      return false
    }
    
    console.log(`✅ Found ${answers.length} answers for project ${projectId}`)
    
    // Step 2: Get questions for formatting
    const questions = await getQuestionsForFormatting(projectId)
    
    // Step 3: Format as markdown
    const markdown = formatReviewAsMarkdown(answers, questions, reviewWeek)
    
    console.log(`✅ Formatted review as markdown (${markdown.length} characters)`)
    
    // Step 4: Find Notion page by project ID
    const pageId = await findNotionPageByProjectId(projectId)
    
    if (!pageId) {
      console.log(`⏭️ No Notion page found for project ${projectId}, skipping sync`)
      return false
    }
    
    // Step 5: Check for duplicate entry
    const isDuplicate = await checkDuplicateReview(pageId, reviewWeek)
    
    if (isDuplicate) {
      console.log(`⏭️ Review for week ${reviewWeek} already exists, skipping`)
      return false
    }
    
    // Step 6: Append review to Notion page
    await appendReviewToNotionPage(pageId, markdown)
    
    console.log(`✅ Successfully synced review to Notion for project ${projectId}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to sync review to Notion for project ${projectId}:`, error)
    throw error
  }
}

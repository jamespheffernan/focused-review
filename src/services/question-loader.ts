import type { QuestionDTO } from '../types'

interface QuestionSet {
  first: QuestionDTO[]
  subsequent: QuestionDTO[]
}

// Parse the markdown file to extract questions
function parseQuestionsFromMarkdown(markdown: string): QuestionSet {
  const lines = markdown.split('\n')
  
  const firstQuestions: QuestionDTO[] = []
  const subsequentQuestions: QuestionDTO[] = []
  
  let currentSection: 'none' | 'first' | 'subsequent' = 'none'
  let currentQuestion: Partial<QuestionDTO> | null = null
  let order = 1
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Detect section headers
    if (line.includes('## First Review Questions')) {
      currentSection = 'first'
      order = 1
      continue
    } else if (line.includes('## Subsequent Review Questions')) {
      currentSection = 'subsequent'
      order = 1
      continue
    } else if (line.startsWith('## ') && !line.includes('Question Types')) {
      // Other section, reset
      currentSection = 'none'
      continue
    }
    
    if (currentSection === 'none') continue
    
    // Parse question fields
    if (line.startsWith('**ID:**')) {
      // Save previous question if exists
      if (currentQuestion && currentQuestion.id && currentQuestion.prompt && currentQuestion.type) {
        const question: QuestionDTO = {
          id: currentQuestion.id,
          prompt: currentQuestion.prompt,
          type: currentQuestion.type as 'text' | 'slider',
          order: currentQuestion.order || order++
        }
        
        if (currentSection === 'first') {
          firstQuestions.push(question)
        } else {
          subsequentQuestions.push(question)
        }
      }
      
      // Start new question
      const id = line.replace('**ID:**', '').trim().replace(/`/g, '')
      currentQuestion = { id }
    } else if (line.startsWith('**Type:**')) {
      let type = line.replace('**Type:**', '').trim().replace(/`/g, '')
      // Convert 'mood' to 'slider' for backward compatibility
      if (type === 'mood') type = 'slider'
      if (currentQuestion) {
        currentQuestion.type = type as 'text' | 'slider'
      }
    } else if (line.startsWith('**Question:**')) {
      const prompt = line.replace('**Question:**', '').trim()
      if (currentQuestion) {
        currentQuestion.prompt = prompt
        currentQuestion.order = order
      }
    }
  }
  
  // Save last question
  if (currentQuestion && currentQuestion.id && currentQuestion.prompt && currentQuestion.type) {
    const question: QuestionDTO = {
      id: currentQuestion.id,
      prompt: currentQuestion.prompt,
      type: currentQuestion.type as 'text' | 'slider',
      order: currentQuestion.order || order
    }
    
    if (currentSection === 'first') {
      firstQuestions.push(question)
    } else {
      subsequentQuestions.push(question)
    }
  }
  
  return {
    first: firstQuestions.sort((a, b) => a.order - b.order),
    subsequent: subsequentQuestions.sort((a, b) => a.order - b.order)
  }
}

// Fallback questions if file can't be loaded
const FALLBACK_QUESTIONS: QuestionSet = {
  first: [
    { id: 'q-purpose', prompt: 'Why am I doing this project?', type: 'text', order: 1 },
    { id: 'q-reality', prompt: 'Where am I right now with it?', type: 'text', order: 2 },
    { id: 'q-next', prompt: 'Is this the clearly defined, physical Next Action?', type: 'text', order: 3 },
    { id: 'q-timeline', prompt: 'What\'s the realistic timeline for this project?', type: 'text', order: 4 },
    { id: 'q-align', prompt: 'Does this align with higher-level goals?', type: 'text', order: 5 },
    { id: 'q-engage', prompt: 'How do you feel about this project?', type: 'slider', order: 6 }
  ],
  subsequent: [
    { id: 'q-relevance', prompt: 'Is this project still relevant to my goals?', type: 'text', order: 1 },
    { id: 'q-reality', prompt: 'Where am I right now with it?', type: 'text', order: 2 },
    { id: 'q-next', prompt: 'Is this the clearly defined, physical Next Action?', type: 'text', order: 3 },
    { id: 'q-timeline', prompt: 'Is the timeline still realistic? Any adjustments needed?', type: 'text', order: 4 },
    { id: 'q-align', prompt: 'Does this align with higher-level goals?', type: 'text', order: 5 },
    { id: 'q-engage', prompt: 'How do you feel about this project?', type: 'slider', order: 6 }
  ]
}

let cachedQuestions: QuestionSet | null = null

/**
 * Load review questions from the markdown file
 */
export async function loadReviewQuestions(): Promise<QuestionSet> {
  if (cachedQuestions) {
    return cachedQuestions
  }
  
  try {
    // Try to load from file system (Electron and web builds)
    // File should be in public/ directory, which gets copied to build root
    const response = await fetch('/review-questions.md')
    const markdown = await response.text()
    cachedQuestions = parseQuestionsFromMarkdown(markdown)
    console.log('✅ Loaded questions from markdown file')
    return cachedQuestions
  } catch (error) {
    console.warn('⚠️ Failed to load questions from markdown, using fallback:', error)
  }
  
  // Use fallback
  cachedQuestions = FALLBACK_QUESTIONS
  return cachedQuestions
}

/**
 * Get questions for a specific project based on review history
 */
export async function getQuestionsForProject(_projectId: string, hasBeenReviewedBefore: boolean): Promise<QuestionDTO[]> {
  const questionSet = await loadReviewQuestions()
  return hasBeenReviewedBefore ? questionSet.subsequent : questionSet.first
}


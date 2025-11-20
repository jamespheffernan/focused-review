import { db } from '../db'
import type { QuestionPackageDTO } from '../types'

/**
 * Get all question packages sorted by order
 */
export async function getAllPackages(): Promise<QuestionPackageDTO[]> {
  return await db.questionPackages.orderBy('order').toArray()
}

/**
 * Get a single question package by ID
 */
export async function getPackageById(id: string): Promise<QuestionPackageDTO | undefined> {
  return await db.questionPackages.get(id)
}

/**
 * Add a new question package
 */
export async function addPackage(pkg: QuestionPackageDTO): Promise<void> {
  await db.questionPackages.add(pkg)
}

/**
 * Update an existing question package
 */
export async function updatePackage(id: string, updates: Partial<QuestionPackageDTO>): Promise<void> {
  await db.questionPackages.update(id, updates)
}

/**
 * Delete a question package and reorder remaining packages
 */
export async function deletePackage(id: string): Promise<void> {
  const packageToDelete = await getPackageById(id)
  if (!packageToDelete) return

  const deletedOrder = packageToDelete.order
  
  // Delete the package
  await db.questionPackages.delete(id)
  
  // Reorder remaining packages
  const remainingPackages = await db.questionPackages
    .where('order')
    .above(deletedOrder)
    .toArray()
  
  for (const pkg of remainingPackages) {
    await db.questionPackages.update(pkg.id, { order: pkg.order - 1 })
  }
}

/**
 * Reorder packages by providing an array of IDs in the desired order
 */
export async function reorderPackages(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, index) => ({
    id,
    order: index + 1
  }))
  
  await db.transaction('rw', db.questionPackages, async () => {
    for (const update of updates) {
      await db.questionPackages.update(update.id, { order: update.order })
    }
  })
}

/**
 * Bulk insert packages (for migration/defaults)
 */
export async function bulkInsertPackages(packages: QuestionPackageDTO[]): Promise<void> {
  await db.questionPackages.bulkAdd(packages)
}

/**
 * Check if any packages exist
 */
export async function hasPackages(): Promise<boolean> {
  const count = await db.questionPackages.count()
  return count > 0
}

/**
 * Restore default question packages
 */
export async function restoreDefaults(): Promise<void> {
  // Clear existing packages
  await db.questionPackages.clear()
  
  // Create default packages
  const defaultPackages: QuestionPackageDTO[] = [
    {
      id: 'pkg-engagement',
      order: 1,
      initialQuestion: 'How do you feel about this project?',
      initialQuestionType: 'slider',
      initialFollowupLogic: 'if_score_lte',
      initialFollowupConditionValue: 1,
      initialFollowup: 'Why do you feel this way?',
      initialFollowupType: 'text',
      subsequentQuestion: 'How do you feel about this project?',
      subsequentQuestionType: 'slider',
      subsequentFollowupLogic: 'if_score_lte',
      subsequentFollowupConditionValue: 1,
      subsequentFollowup: 'Why do you feel this way?',
      subsequentFollowupType: 'text'
    },
    {
      id: 'pkg-alignment',
      order: 2,
      initialQuestion: 'Does this project align with your higher-level goals and priorities?',
      initialQuestionType: 'yes-no',
      initialFollowupLogic: 'if_no',
      initialFollowup: 'Should you deprioritize it then? Why are you doing this project?',
      initialFollowupType: 'text',
      subsequentQuestion: 'Does this project still align with your higher-level goals and priorities?',
      subsequentQuestionType: 'yes-no',
      subsequentFollowupLogic: 'if_no',
      subsequentFollowup: 'Should you deprioritize it then? Why are you still doing this project?',
      subsequentFollowupType: 'text'
    },
    {
      id: 'pkg-next-action',
      order: 3,
      initialQuestion: 'Have you defined the next physical action you can take to move this project forward?',
      initialQuestionType: 'yes-no',
      initialFollowupLogic: 'if_no',
      initialFollowup: 'Please edit your task details and define a clear next action.',
      initialFollowupType: 'instruction',
      subsequentQuestion: 'Have you defined the next physical action you can take to move this project forward?',
      subsequentQuestionType: 'yes-no',
      subsequentFollowupLogic: 'if_no',
      subsequentFollowup: 'Please edit your task details and define a clear next action.',
      subsequentFollowupType: 'instruction'
    },
    {
      id: 'pkg-timeline',
      order: 4,
      initialQuestion: "What's the realistic timeline for this project?",
      initialQuestionType: 'text-parsed',
      subsequentQuestion: 'Is this timeline still realistic?',
      subsequentQuestionType: 'yes-no',
      subsequentFollowupLogic: 'if_no',
      subsequentFollowup: "What's the new realistic timeline for this project?",
      subsequentFollowupType: 'text-parsed'
    }
  ]
  
  await bulkInsertPackages(defaultPackages)
  console.log('✅ Restored default question packages')
}

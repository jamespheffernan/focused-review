import { hasPackages, restoreDefaults } from '../repos/questionPackagesRepo'

/**
 * Migrate to QuestionPackage system
 * Checks if packages exist and initializes defaults if not
 */
export async function migrateToQuestionPackages(): Promise<void> {
  try {
    console.log('🔄 Checking QuestionPackage migration status...')
    const hasExistingPackages = await hasPackages()
    console.log(`📦 QuestionPackages table has data: ${hasExistingPackages}`)
    
    if (!hasExistingPackages) {
      console.log('📦 No question packages found, initializing with defaults...')
      await restoreDefaults()
      console.log('✅ QuestionPackage migration completed successfully')
      
      const packagesAfterMigration = await hasPackages()
      console.log(`📦 Verification: QuestionPackages table has data after migration: ${packagesAfterMigration}`)
    } else {
      console.log('✅ QuestionPackage system already initialized')
    }
  } catch (error) {
    console.error('❌ QuestionPackage migration failed:', error)
    throw error
  }
}

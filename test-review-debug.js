// Debug script to see exactly what's happening with review dates
const of = Application('OmniFocus');
const doc = of.defaultDocument;
const flattenedProjects = doc.flattenedProjects();

console.log(`Total projects: ${flattenedProjects.length}`);

// Test first active project
for (let i = 0; i < flattenedProjects.length; i++) {
  const project = flattenedProjects[i];
  if (project.status() === 'active status') {
    console.log(`\n=== Testing Project: ${project.name()} ===`);
    
    // Test lastReviewDate
    let lastReviewDate = null;
    try {
      console.log('Calling project.lastReviewDate()...');
      const lastRev = project.lastReviewDate();
      console.log(`lastReviewDate() returned: ${lastRev}`);
      console.log(`Type: ${typeof lastRev}`);
      lastReviewDate = lastRev ? lastRev.toISOString() : null;
      console.log(`After toISOString: ${lastReviewDate}`);
    } catch (e) {
      console.log(`ERROR getting lastReviewDate: ${e.message}`);
    }
    
    // Test nextReviewDate
    let nextReviewDate = null;
    try {
      console.log('Calling project.nextReviewDate()...');
      const nextRev = project.nextReviewDate();
      console.log(`nextReviewDate() returned: ${nextRev}`);
      console.log(`Type: ${typeof nextRev}`);
      nextReviewDate = nextRev ? nextRev.toISOString() : null;
      console.log(`After toISOString: ${nextReviewDate}`);
    } catch (e) {
      console.log(`ERROR getting nextReviewDate: ${e.message}`);
    }
    
    console.log(`\nFinal values:`);
    console.log(`  lastReviewDate: ${lastReviewDate}`);
    console.log(`  nextReviewDate: ${nextReviewDate}`);
    
    // Only test first active project
    break;
  }
}


// Test script to check what review properties are available in OmniFocus
const of = Application('OmniFocus');
const doc = of.defaultDocument;
const projects = doc.flattenedProjects();

if (projects.length > 0) {
  const project = projects[0];
  
  console.log('=== Testing Project: ' + project.name() + ' ===\n');
  
  // Test all possible review-related properties
  const propertiesToTest = [
    'reviewInterval',
    'lastReviewDate',
    'nextReviewDate',
    'reviewedDate',
    'nextReviewedDate',
    'reviewDate',
    'nextReview',
    'lastReview'
  ];
  
  const results = {};
  
  for (const prop of propertiesToTest) {
    try {
      const value = project[prop]();
      results[prop] = value ? (value.constructor.name === 'Date' ? value.toISOString() : value) : null;
      console.log(`✅ ${prop}: ${results[prop]}`);
    } catch (e) {
      console.log(`❌ ${prop}: Property doesn't exist or error - ${e.message}`);
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(JSON.stringify(results, null, 2));
}


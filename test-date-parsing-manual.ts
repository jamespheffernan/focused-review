// Manual test script for date parsing
// Run with: npx tsx test-date-parsing-manual.ts

import { parseNaturalDate, describeNaturalDate } from './src/utils/date-parser';

console.log('🧪 Testing Date Parsing with Auto-Prepend Feature\n');
console.log('=' .repeat(60));

const testCases = [
  { input: 'tomorrow', shouldParse: true },
  { input: 'next friday', shouldParse: true },
  { input: 'in 2 weeks', shouldParse: true },
  { input: '2 weeks', shouldParse: true }, // Enhanced parser handles this directly
  { input: 'Friday', shouldParse: true }, // Enhanced parser handles this directly
  { input: '3 months', shouldParse: true }, // Enhanced parser handles this directly
  { input: '6 days', shouldParse: true }, // Enhanced parser handles this directly
  { input: 'Monday', shouldParse: true }, // Enhanced parser handles this directly
  { input: '1 year', shouldParse: true }, // Enhanced parser handles this directly
  { input: 'next month', shouldParse: true },
  { input: 'invalid date string', shouldParse: false },
  { input: 'not a date', shouldParse: false },
  { input: 'In 2 weeks', shouldParse: true }, // Case insensitive
  // Test cases that might need auto-prepend (edge cases)
  { input: 'xyz123', shouldParse: false },
  { input: 'random text', shouldParse: false },
];

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const { input, shouldParse } = testCase;
  
  // Check if original input parses
  const originalParsed = parseNaturalDate(input);
  const wouldAutoPrepend = !originalParsed && !input.toLowerCase().startsWith('in ');
  
  // Get final parsed result (which may use auto-prepend internally)
  const finalParsed = parseNaturalDate(input);
  const description = finalParsed ? describeNaturalDate(input) : null;
  
  const testPassed = (shouldParse && !!finalParsed) || (!shouldParse && !finalParsed);
  
  if (testPassed) {
    passed++;
  } else {
    failed++;
  }
  
  const status = testPassed ? '✅ PASS' : '❌ FAIL';
  const autoPrependStatus = wouldAutoPrepend ? ' [would auto-prepend]' : '';
  
  console.log(`\n${index + 1}. ${status} - "${input}"${autoPrependStatus}`);
  console.log(`   Parsed: ${finalParsed || 'null'}`);
  if (description) {
    console.log(`   Description: ${description}`);
  }
  
  if (!testPassed) {
    console.log(`   Expected: ${shouldParse ? 'parse' : 'fail'}`);
    console.log(`   Got: ${finalParsed ? 'parsed' : 'failed'}`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
  console.log('✅ All tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed');
  process.exit(1);
}


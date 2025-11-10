#!/usr/bin/env node

const path = require('path');
const { run } = require('./run-test.cjs');
const { createLogger } = require('./utils/logger.cjs');

const TEST_SEQUENCE = [
  'timeline-calendar-sync',
  'timeline-edit-interaction',
  'multiple-tags',
  'task-update-sync',
  'due-date-sync',
  'timeline-validation',
  'date-parsing-enhanced',
  'timeline-table-export',
  'error-message-clarity',
  'timeline-two-questions',
  'project-stats-display',
  'calendar-persistence',
  'someday-maybe-review',
  'weekly-review-structure',
];

const logger = createLogger('MasterSuite');

async function main() {
  const [, , ...args] = process.argv;
  const filter = args.includes('--only')
    ? args[args.indexOf('--only') + 1]?.split(',')
    : null;

  const selectedTests = filter
    ? TEST_SEQUENCE.filter((test) => filter.includes(test))
    : TEST_SEQUENCE;

  if (selectedTests.length === 0) {
    logger.warning('No tests selected to run.');
    process.exit(0);
  }

  logger.step(`Running ${selectedTests.length} end-to-end tests`);
  const results = [];

  for (const testName of selectedTests) {
    const result = await run(testName);
    results.push(result);
    if (!result.passed) {
      logger.warning(`Stopping master suite after failure in "${testName}"`);
      break;
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const totalTime = results.reduce((sum, r) => sum + (r.duration ?? 0), 0);

  logger.info('────────────────────────────────────────────');
  logger.info(`Summary: ${passed} passed, ${failed} failed, ${results.length} total`);
  logger.info(`Total time: ${totalTime}ms`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  TEST_SEQUENCE,
};



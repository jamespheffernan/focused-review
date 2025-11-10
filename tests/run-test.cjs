#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createLogger } = require('./utils/logger.cjs');
const { CDPClient } = require('./utils/cdp-client.cjs');
const { sleep } = require('./utils/time.cjs');

const TEST_DIR = path.resolve(__dirname, 'specs');
const logger = createLogger('Runner');

function listTests() {
  if (!fs.existsSync(TEST_DIR)) {
    return [];
  }
  return fs
    .readdirSync(TEST_DIR)
    .filter((file) => file.endsWith('.test.cjs'))
    .map((file) => path.basename(file, '.test.cjs'));
}

function resolveTestPath(testName) {
  return path.resolve(TEST_DIR, `${testName}.test.cjs`);
}

async function loadTest(testName) {
  const testPath = resolveTestPath(testName);
  if (!fs.existsSync(testPath)) {
    throw new Error(
      `Test "${testName}" was not found. Available tests: ${listTests().join(', ') || 'none yet.'}`
    );
  }

  // Clear require cache to allow re-runs in the same process
  delete require.cache[require.resolve(testPath)];
  const testModule = require(testPath);
  const runner = testModule.runTest || testModule.run || testModule.default;

  if (typeof runner !== 'function') {
    throw new Error(
      `Test "${testName}" does not export a runnable function. Expected "runTest(context)".`
    );
  }

  return {
    description: testModule.description ?? testName,
    run: runner,
  };
}

async function run(testName) {
  const { run: runTest, description } = await loadTest(testName);
  const testLogger = createLogger(testName);
  const start = Date.now();

  testLogger.step(`Starting test: ${description}`);

  const context = {
    logger: testLogger,
    sleep,
    createClient: (options = {}) =>
      new CDPClient({
        logger: createLogger(`${testName}:CDP`),
        ...options,
      }),
  };

  try {
    await runTest(context);
    const duration = Date.now() - start;
    testLogger.success(`Test passed in ${duration}ms`);
    return { testName, passed: true, duration };
  } catch (error) {
    const duration = Date.now() - start;
    testLogger.error(`Test failed in ${duration}ms`);
    testLogger.error(error.stack || error.message);
    return { testName, passed: false, duration, error };
  }
}

async function main() {
  const [, , arg] = process.argv;

  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }

  if (!arg || arg === '--list') {
    const tests = listTests();
    if (tests.length === 0) {
      logger.info('No tests found. Create new tests in tests/specs/*.test.cjs');
    } else {
      logger.info(`Available tests:\n- ${tests.join('\n- ')}`);
    }
    process.exit(0);
  }

  const result = await run(arg);
  process.exit(result.passed ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  run,
};



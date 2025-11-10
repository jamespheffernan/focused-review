# End-to-End Test Harness

This directory contains the electron-mcp driven end-to-end tests for Blinders.app.

## Structure

- `run-test.cjs` – CLI runner for a single test (`npm run test:e2e <name>`).
- `master-suite.cjs` – Runs the full suite in dependency order (`npm run test:e2e:all`).
- `specs/` – Individual test specifications (`*.test.cjs`).
- `utils/` – Shared helpers (CDP client, logging, timing).

## Writing a Test

Create a file in `specs/` named `<slug>.test.cjs` that exports an async `runTest(context)` function:

```javascript
module.exports = {
  description: 'Example test',
  async runTest({ createClient, logger, sleep }) {
    const client = await createClient().connect();
    try {
      logger.step('Implement test logic here');
      // ...
    } finally {
      await client.close();
    }
  },
};
```

The `context` object provides:

- `createClient(options)` – Creates a Chrome DevTools Protocol client.
- `logger` – Prefix-aware logger with `info/success/warning/error/step`.
- `sleep(ms)` – Promise-based delay helper.

All tests should connect to the running Electron app (`npm run electron:dev`) and leave the application in a clean state.

## Running Tests

```bash
# List available tests
npm run test:e2e -- --list

# Run a single test
npm run test:e2e -- timeline-calendar-sync

# Run the full suite
npm run test:e2e:all
```

Use the `DEBUG_CDP=1` environment variable for verbose Chrome DevTools Protocol logging while developing tests.



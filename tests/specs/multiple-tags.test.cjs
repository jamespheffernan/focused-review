const TEST_NAME = 'multiple-tags'

module.exports = {
  description: 'Tasks support multiple tags end-to-end through the OmniFocus bridge',
  async runTest({ createClient, logger, sleep }) {
    const client = await createClient({
      targetPredicate: (target) =>
        target.type === 'page' &&
        (target.url.includes('localhost:5174') || target.title.includes('Blinders - Weekly Review'))
    }).connect()

    try {
      logger.step('Waiting for test API availability')
      const apiReady = await client.waitFor(
        () =>
          client.evaluate('Boolean(window.__APP_TEST_API__)').catch(() => false),
        { timeout: 10000, interval: 200, description: '__APP_TEST_API__' }
      )

      if (!apiReady) {
        throw new Error('Test API unavailable')
      }

      logger.step('Setting up Electron API stubs and resetting database')
      const setupResult = await client.evaluate(
        `(async () => {
          const api = window.__APP_TEST_API__
          if (!api) {
            return { success: false, reason: 'Test API unavailable' }
          }

          console.log('[TEST] Resetting database...')
          await api.resetDatabase()
          await api.clearTasks()
          console.log('[TEST] Database reset complete')

          // Initialize call tracking and store stubs
          // Since contextBridge creates read-only properties, we store stubs separately
          // and the bridge's getElectronAPI() will check for them
          window.__TEST_STUBS__ = {
            createTaskCalls: [],
            setTaskTagsCalls: [],
            setTaskDueDateCalls: [],
            updateTaskCalls: [],
            stubs: {
              createTask: async (projectId, taskName) => {
                console.log('[TEST STUB] createTask called:', { projectId, taskName });
                const taskId = \`of-\${projectId}-\${taskName.replace(/\\s+/g, '-').toLowerCase()}\`;
                window.__TEST_STUBS__.createTaskCalls.push({ projectId, taskName, taskId });
                return { success: true, taskId };
              },
              setTaskTags: async (taskId, tags) => {
                console.log('[TEST STUB] setTaskTags called:', { taskId, tags });
                window.__TEST_STUBS__.setTaskTagsCalls.push({ taskId, tags });
                return { success: true, taskId, tags };
              },
              setTaskDueDate: async (taskId, dueDate) => {
                console.log('[TEST STUB] setTaskDueDate called:', { taskId, dueDate });
                window.__TEST_STUBS__.setTaskDueDateCalls.push({ taskId, dueDate });
                return { success: true, taskId, dueDate };
              },
              updateTask: async (taskId, updates) => {
                console.log('[TEST STUB] updateTask called:', { taskId, updates });
                window.__TEST_STUBS__.updateTaskCalls.push({ taskId, updates });
                return { success: true, taskId, updates };
              }
            }
          };

          console.log('[TEST] Electron API stubs installed successfully');
          
          return { success: true }
        })()`,
        { awaitPromise: true }
      )

      if (!setupResult?.success) {
        throw new Error(setupResult?.reason || 'Failed to set up stubs')
      }

      logger.step('Creating project and multi-tag task via repositories')
      const taskResult = await client.evaluate(
        `(async () => {
          const api = window.__APP_TEST_API__
          if (!api) {
            return { success: false, reason: 'Test API unavailable' }
          }

          const projectId = 'project-multi-tag'

          await api.insertProject({
            id: projectId,
            name: 'Multi Tag Project',
            status: 'active',
            reviewIntervalDays: 7,
            tags: [],
            flagged: false
          })

          console.log('[TEST] About to create task...')
          const createdTask = await api.createTask(projectId, {
            name: 'Deep Focus Sprint',
            status: 'available',
            flagged: false,
            completed: false,
            note: 'Exercise multiple tags pipeline',
            tags: ['Focus', 'Deep Work']
          })
          console.log('[TEST] Task created:', createdTask)

          // Wait for sync to call bridge stubs
          // syncTaskToOmniFocus is called asynchronously after createTask returns,
          // so we need to wait for both createTask and setTaskTags to be called
          await new Promise((resolve) => {
            const start = performance.now()
            const check = () => {
              const elapsed = performance.now() - start
              console.log('[TEST] Checking stubs...', {
                createTaskCalls: window.__TEST_STUBS__.createTaskCalls.length,
                setTaskTagsCalls: window.__TEST_STUBS__.setTaskTagsCalls.length,
                elapsed: Math.round(elapsed)
              })
              // Wait for setTaskTags to be called (which happens after createTask succeeds)
              if (window.__TEST_STUBS__.setTaskTagsCalls.length > 0) {
                console.log('[TEST] Sync completed - setTaskTags was called')
                resolve()
                return
              }
              // Timeout after 5 seconds
              if (elapsed > 5000) {
                console.log('[TEST] Timeout waiting for stubs after 5s')
                resolve()
                return
              }
              setTimeout(check, 100)
            }
            check()
          })

          const tasks = await api.getTasks()
          return {
            success: true,
            tasksCount: tasks.length,
            storedTags: tasks.map(t => t.tags),
            stubCalls: window.__TEST_STUBS__
          }
        })()`,
        { awaitPromise: true }
      )

      if (!taskResult?.success) {
        throw new Error('Task creation evaluation failed')
      }

      const { tasksCount, storedTags, stubCalls } = taskResult

      if (tasksCount !== 1) {
        throw new Error(`Expected exactly one task in DB, found ${tasksCount}`)
      }

      const [tagsInDb] = storedTags
      if (!Array.isArray(tagsInDb) || tagsInDb.length !== 2) {
        throw new Error(`Expected task tags to persist as length 2 array, received ${JSON.stringify(tagsInDb)}`)
      }

      const [setTaskTagsCall] = stubCalls.setTaskTagsCalls || []
      if (!setTaskTagsCall) {
        const createCalls = JSON.stringify(stubCalls.createTaskCalls || [])
        throw new Error(`setTaskTags was not invoked on the OmniFocus bridge (createTask calls: ${createCalls})`)
      }

      const expectedTags = ['Focus', 'Deep Work']
      const receivedTags = setTaskTagsCall.tags || []
      expectedTags.forEach(tag => {
        if (!receivedTags.includes(tag)) {
          throw new Error(`Expected tag "${tag}" to be sent to OmniFocus, received ${JSON.stringify(receivedTags)}`)
        }
      })

      logger.success('Multi-tag task creation and sync validated successfully')
    } finally {
      await client.close()
    }
  }
}



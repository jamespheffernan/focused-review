#!/usr/bin/env node
/**
 * Smoke test for the OmniFocus plug-in bridge. The script creates a throwaway
 * inbox task and project, exercises all mutation actions (update, due date,
 * completion, review, drop, etc.), and prints the results as prettified JSON.
 */

const path = require('path')
const { triggerOmniFocusPlugin } = require('../electron/omnifocus-plugin-trigger.cjs')

async function invoke(action, payload = {}) {
  const response = await triggerOmniFocusPlugin({ action, ...payload })
  if (!response || response.success === false) {
    const err = response?.error || `Plugin action ${action} failed`
    throw new Error(err)
  }
  return response.result
}

async function run() {
  const results = {}
  const timestamp = Date.now()

  // Task lifecycle
  results.createInboxTask = await invoke('createInboxTask', { name: `Blinders Plugin Test Task ${timestamp}` })
  const taskId = results.createInboxTask.id
  results.updateTask = await invoke('updateTask', { id: taskId, updates: { note: 'Updated via automated plugin test', flagged: true } })
  results.setTaskDueDate = await invoke('setTaskDueDate', { id: taskId, dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
  results.toggleComplete = await invoke('toggleTaskCompletion', { id: taskId, completed: true })

  // Project lifecycle
  const projectName = `Blinders Plugin Test Project ${timestamp}`
  results.createProject = await invoke('createProject', { name: projectName, updates: { note: 'Created for automated plugin test' } })
  const projectId = results.createProject.id
  results.updateProject = await invoke('updateProject', { id: projectId, updates: { flagged: true } })
  results.markProjectReviewed = await invoke('markProjectReviewed', { id: projectId })
  results.markProjectComplete = await invoke('markProjectComplete', { id: projectId })
  results.dropProject = await invoke('dropProject', { id: projectId })

  console.log(JSON.stringify(results, null, 2))
}

run().catch(error => {
  console.error('OmniFocus plug-in smoke test failed:', error)
  process.exitCode = 1
})

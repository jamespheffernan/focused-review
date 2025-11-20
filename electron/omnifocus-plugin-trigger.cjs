const { execFile } = require('child_process')
const { promisify } = require('util')

const execFileAsync = promisify(execFile)
const PLUGIN_IDENTIFIER = 'com.example.blinders'
const ACTION_IDENTIFIER = 'com.example.blinders'

function buildJXASource(payloadString) {
  const pluginInvocation = [
    `PlugIn.find("${PLUGIN_IDENTIFIER}")`,
    `      .action("${ACTION_IDENTIFIER}")`,
    `      .perform(${payloadString});`
  ].join('\n')

  const escapedInvocation = pluginInvocation.replace(/`/g, '\\`')

  return `function run() {\n  const app = Application("OmniFocus");\n  const script = \`${escapedInvocation}\`;\n  try {\n    const response = app.evaluateJavascript(script);\n    if (typeof response === "string") {\n      return response;\n    }\n    return JSON.stringify(response);\n  } catch (error) {\n    return JSON.stringify({ success: false, error: error.message });\n  }\n}`
}

async function triggerOmniFocusPlugin(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Plugin payload must be an object')
  }

  const payloadString = JSON.stringify(payload)
  const jxaSource = buildJXASource(payloadString)

  const { stdout, stderr } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', jxaSource])

  if (stderr && stderr.trim().length > 0) {
    throw new Error(stderr.trim())
  }

  const raw = (stdout || '').trim()
  if (!raw) {
    throw new Error('No response from OmniFocus plugin')
  }

  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`Failed to parse plugin response: ${raw}`)
  }
}

module.exports = {
  triggerOmniFocusPlugin,
}

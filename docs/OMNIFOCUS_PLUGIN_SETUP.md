# OmniFocus Plugin Setup Guide

This guide explains how to install and verify the Blinders OmniFocus automation plugin that powers all write operations (task + project updates) in the Weekly Review HUD.

## 1. Files & Locations

| Purpose | Path |
| --- | --- |
| Source plugin (tracked in git) | `weekly-review-hud/omnifocus-plugin/com.example.blinders.omnijs` |
| OmniFocus plug-in folder | `~/Library/Application Scripts/com.omnigroup.OmniFocus4/` |
| Installed plug-in | `~/Library/Application Scripts/com.omnigroup.OmniFocus4/com.example.blinders.omnijs` |

Symlink the installed plug-in back to the repo or re-run the `cp` command after edits to keep OmniFocus in sync:

```bash
cp weekly-review-hud/omnifocus-plugin/com.example.blinders.omnijs \
   ~/Library/Application\ Scripts/com.omnigroup.OmniFocus4/com.example.blinders.omnijs
```

## 2. Installation Steps

1. **Create the Automation folder (first-time only):**
   - Open `OmniFocus → Automation → Configure Plug-Ins…`
   - Click `Add Linked Folder…` and select `~/Library/Application Scripts/com.omnigroup.OmniFocus4`
2. **Copy the plug-in file** from the repo to the folder using the command above (or Finder).
3. **Allow external scripts**: `OmniFocus → Preferences → Automation → Allow external scripts`.
4. **Approve the security prompt** the first time the Electron app (or tests) triggers the plug-in. Choose “Always Allow” to prevent future prompts.

## 3. Verifying the Plug-In

1. Open `OmniFocus → Automation → Plug-Ins` and confirm “Blinders Bridge” appears.
2. Open the Automation Console (`Automation → Console…`). Running the app or the CLI smoke test below should stream log output prefixed with `[com.example.blinders]`.

### CLI Smoke Test

From the repo root, run the automated test harness which creates temporary tasks & projects, applies updates, and then drops the test project:

```bash
node ./weekly-review-hud/scripts/test-omnifocus-plugin.cjs
```

> **Note:** If you only need a quick check, run `npm run debug:plugin` once we add it to package scripts. For now the manual `node` invocation above mirrors the integration tests used during development (see `git log`).

## 4. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `OmniFocus is not running` error in the app | Launch OmniFocus and leave it open (frontmost document required for Omni Automation). |
| `Unable to access OmniFocus inbox` / similar | The plug-in file is outdated. Re-run the `cp` command to install the latest version. |
| `PlugIn.find("com.example.blinders")` returns null | Re-open the Plug-Ins preference pane and ensure the folder is linked. Omnifocus caches plug-ins; restart OmniFocus after copying files. |
| Permissions dialog keeps reappearing | Re-open the security prompt and choose “Always Allow”. Check `System Settings → Privacy & Security → Automation` if macOS revoked permissions. |
| Nothing happens when triggering from Electron | Check the Automation Console for `[com.example.blinders]` logs. If the console is empty, ensure the plug-in file compiled (no syntax errors) and OmniFocus has reloaded it (restart OmniFocus). |

## 5. Operational Notes

- All mutations now route through the plug-in; **do not** edit the legacy JXA helpers—they are officially deprecated.
- Any change to `weekly-review-hud/electron/main.cjs` that calls `invokePluginAction()` also requires the OmniFocus plug-in to be up to date.
- Keep development + production copies of the plug-in identical by committing changes in `weekly-review-hud/omnifocus-plugin/` and re-copying to the Automation folder.
- The automated smoke test leaves a completed inbox task and a dropped project for auditing; you can archive them later or expand the script to delete after verification.

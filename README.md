# Blinders

A focused, distraction-free desktop application for conducting weekly reviews of your OmniFocus projects. Named after the horse equipment that helps maintain focus. Built with React, TypeScript, Vite, and Electron.

## Features

> **Note:** Blinders is designed for **OmniFocus 4** and may not work with earlier versions.

### Core Functionality
- **OmniFocus Integration**: Seamlessly sync projects and tasks from OmniFocus 4
- **Guided Review Process**: Answer context-aware questions for each project
- **Task Management**: View, edit, and manage tasks during your review
- **Offline-First**: All data stored locally using IndexedDB with explicit sync
- **Session Tracking**: Track review sessions, time spent, and completion stats
- **Notion Sync**: Automatically sync review answers to Notion pages with retry queue

### Notion Deep Link Integration (NEW ✨)
Quickly access Notion documentation for your projects during reviews:

- **Quick Access**: Press `Ctrl+N` (Windows/Linux) or `Cmd+N` (Mac) to open Notion documentation
- **Visual Indicator**: A 📝 icon appears next to project names when Notion links are available
- **Simple Setup**: Just add your Notion page URL as the first line of your project notes in OmniFocus

#### How to Use Notion Deep Links

1. **In OmniFocus**: Open your project and add a Notion page URL as the **first line** of the project notes:
   ```
   https://www.notion.so/yourworkspace/Your-Project-Page-123abc
   
   Other project notes can go here...
   ```

2. **In Weekly Review HUD**: 
   - Sync your projects from OmniFocus
   - Look for the 📝 icon next to projects with Notion links
   - Click the icon OR press `Ctrl+N` / `Cmd+N` to open the Notion page

3. **Supported URL Formats**:
   - `notion://www.notion.so/{workspace}/{page-id}` (Notion app deep link - recommended)
   - `https://www.notion.so/{workspace}/{page-id}` (Web browser link)
   - `https://notion.so/{workspace}/{page-id}` (Web browser link)

### Notion Review Answers Sync (NEW ✨)
Automatically sync your weekly review answers to Notion project pages:

- **Automatic Sync**: Answers are synced to Notion when you mark a project reviewed
- **Non-Blocking**: Never interrupts your review flow - syncs in background
- **Retry Queue**: Failed syncs automatically retry with smart backoff (2, 4, 8, 16, 32 minutes)
- **Compact Format**: Clean, readable markdown appended to your Notion pages
- **Week-by-Week Log**: Build a permanent history of your project reflections

#### How to Enable Notion Answers Sync

**If you already use omnifocus-notion-sync**: ✅ **Nothing to do!** The app automatically reuses your existing configuration.

**If you're setting up for the first time**:

1. **Set Environment Variables** in your `~/.zshrc` or `~/.bashrc`:
   ```bash
   export NOTION_TOKEN="your_notion_integration_token"
   export NOTION_PROJECT_DB="your_notion_database_id"
   ```
   
   Then reload your shell: `source ~/.zshrc`

2. **Get Your Notion Credentials**:
   - **Notion Token**: Create an integration at https://www.notion.so/my-integrations
   - **Database ID**: From your Active Projects database URL: 
     `https://notion.so/workspace/{database-id}?v=...`

3. **Launch the App** (from anywhere):
   - The app automatically loads variables from your shell config
   - Works when launched from Finder or Terminal
   - Check console for: `✅ Notion sync is configured and enabled`

#### How It Works

When you mark a project reviewed:
1. Your answers are formatted as markdown
2. They're appended to the corresponding Notion page
3. If sync fails (offline, network issue), it's queued automatically
4. Background process retries every 5 minutes with exponential backoff
5. After 5 failed attempts (~62 minutes), marked as permanently failed

**Example Notion Output**:
```markdown
---

**Week of October 8, 2025** *(Reviewed: Oct 8, 2025)*

**Why am I doing this project?**: To improve weekly reflection quality

**Where am I right now with it?**: Implementing Notion sync feature

**Is this the clearly defined, physical Next Action?**: Complete documentation

**What's the realistic timeline for this project?**: End of week

**Does this align with higher-level goals?**: Yes, improves GTD workflow

**Am I engaged and motivated?**: 😊 High (4/5)

---
```

#### Troubleshooting Notion Sync

- **"Notion sync is NOT configured"**: Set `NOTION_TOKEN` and `NOTION_PROJECT_DB` environment variables
- **Sync fails silently**: Check console logs (DevTools) for error messages
- **No Notion page found**: Ensure project exists in omnifocus-notion-sync database with correct OF-ID
- **Duplicate entries**: The app checks for duplicates automatically, but manual duplication may occur if you re-review the same week

The environment variables above are sufficient for the optional Notion integration. Keep tokens and database identifiers in your shell environment; never commit them to the repository.

---

### Smart Review Filtering
The app automatically shows only projects that are **due or overdue** for review:

- **Intelligent Filtering**: Only projects with `nextReviewDate ≤ today` appear in your review queue
- **Priority Sorting**: Most overdue projects appear first, helping you focus on what needs attention
- **Synced with OmniFocus**: Review dates are synchronized from OmniFocus project settings
- **Automatic Updates**: When you mark a project as reviewed, OmniFocus is immediately updated

#### How Review Filtering Works

1. **In OmniFocus**: Set review intervals for your projects (e.g., weekly, monthly)
   - OmniFocus automatically calculates the next review date based on your interval

2. **In Weekly Review HUD**:
   - Sync from OmniFocus to import projects with their review dates
   - Only projects due for review will appear in your queue
   - Projects are automatically sorted by how overdue they are

3. **Mark as Reviewed**:
   - Click "Mark Reviewed" button to update both the app and OmniFocus
   - OmniFocus's `lastReviewDate` is set to now, and `nextReviewDate` is recalculated
   - The project won't appear again until its next review is due

---

### Customizable Themes
Personalize your review experience with 11 beautiful themes:

- **Ocean**: Fresh teal and cyan tones (default)
- **Sunset**: Warm pink, coral, and yellow gradients
- **Forest**: Natural greens and lime
- **Twilight**: Deep purple and violet tones
- **Ember**: Fiery orange and amber
- **DOS**: Retro terminal green on black
- **Solarized Dark**: Low-contrast professional palette
- **Monochrome**: Pure black and white minimalism
- **Nord**: Nordic frost and muted pastels
- **Dracula**: Purple and pink developer theme
- **Cyberpunk**: Neon cyan and magenta futuristic colors

#### Features
- **Dynamic UI**: All buttons, indicators, and accents adapt to your chosen theme
- **Grid Selector**: Visual 3-column grid showing gradient previews
- **Persistent**: Theme preference saved locally and persists across sessions
- **Cohesive Design**: Each theme provides unique colors for primary, secondary, success, warning, and danger states

**To change themes**: Click the 🎨 Theme button in the top-right corner of any screen.

## Installation

### Prerequisites
- macOS (for OmniFocus integration)
- Node.js 22 and npm
- **OmniFocus 4** (required)

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Build Electron app
npm run electron:build
```

### OmniFocus Plug-In Setup (Required for Writes)

All task and project mutations now run inside OmniFocus via the **Blinders Bridge** plug-in. Install it once and keep it in sync whenever `omnifocus-plugin/com.example.blinders.omnijs` changes.

1. Copy the plug-in into OmniFocus’ Automation folder:
   ```bash
   cp omnifocus-plugin/com.example.blinders.omnijs \\
      ~/Library/Application\\ Scripts/com.omnigroup.OmniFocus4/com.example.blinders.omnijs
   ```
2. In OmniFocus: `Automation → Configure Plug-Ins…` and link `~/Library/Application Scripts/com.omnigroup.OmniFocus4`.
3. Enable **Allow external scripts** under `OmniFocus → Preferences → Automation`.
4. Approve the Script Security prompt with “Always Allow” the first time Electron triggers the plug-in.
5. Run the smoke test to verify every action end-to-end:
   ```bash
   node scripts/test-omnifocus-plugin.cjs
   ```

See [`docs/OMNIFOCUS_PLUGIN_SETUP.md`](docs/OMNIFOCUS_PLUGIN_SETUP.md) for detailed setup + troubleshooting notes.

## Usage

### Starting a Review Session

1. Launch the application
2. Click "Sync from OmniFocus" to import your projects
3. Select projects to review
4. Click "Start Review" to begin your session

### During Review

- **Answer Questions**: Type your thoughts for each question
- **Navigate**: Use arrow keys (← →) to move between questions
- **Save**: Press `Enter` to go to next question (auto-saves)
- **View Tasks**: Click the task indicator or task panel to see project tasks
- **Open Notion**: Press `Ctrl+N` / `Cmd+N` to open Notion documentation
- **Skip**: Press `Esc` to skip to next project
- **Complete**: Press `Space` to mark reviewed and move to next project

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `← →` | Navigate between questions |
| `Enter` | Go to next question |
| `Space` | Mark reviewed & next project |
| `Esc` | Skip current project |
| `Ctrl+N` / `Cmd+N` | Open Notion link |
| `Ctrl+S` / `Cmd+S` | Save answer |
| `⌨️` button | Show keyboard shortcuts overlay |

## Architecture

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Desktop**: Electron
- **Database**: Dexie (IndexedDB wrapper)
- **Styling**: CSS with glassmorphism effects
- **Build**: Vite + electron-builder

### Key Components
- **FocusScreen**: Main review interface with question-answer flow
- **QueueScreen**: Project selection and session management
- **SummaryScreen**: Review session statistics
- **TaskList**: Task management with filtering and editing
- **OmniFocus Bridge**: JXA-based integration with OmniFocus

### Data Flow
1. JXA scripts query OmniFocus database
2. Electron main process executes JXA and returns data
3. Bridge layer converts to TypeScript interfaces
4. Service layer processes and validates data
5. Repository layer stores in IndexedDB
6. React components read from store and display UI

## Project Structure

```
blinders/
├── electron/           # Electron main process
│   ├── main.cjs       # Main process, IPC handlers, JXA scripts
│   └── preload.cjs    # Preload script for secure IPC
├── src/
│   ├── components/    # React components
│   ├── screens/       # Main screen components
│   ├── services/      # Business logic and external integrations
│   ├── repos/         # Database repositories (IndexedDB)
│   ├── utils/         # Utility functions
│   ├── types/         # TypeScript type definitions
│   ├── store.ts       # Zustand state management
│   ├── db.ts          # Dexie database configuration
│   └── App.tsx        # Main app component
├── docs/              # Documentation and implementation plans
└── dist-electron/     # Built Electron app
```

## Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
# Build web app
npm run build

# Build Electron app for macOS
npm run electron:build
```

### Debugging
- Open DevTools in Electron: `Cmd+Option+I` (Mac)
- Check console logs for OmniFocus sync issues
- Use `console.time/timeEnd` for performance profiling

## Troubleshooting

### OmniFocus Not Syncing
1. Ensure OmniFocus is running
2. Check that you've granted permissions to the app
3. Look for error messages in the console
4. Try restarting the app

### Notion Link Not Opening
1. Verify the Notion URL is on the **first line** of project notes
2. Ensure it's a valid Notion URL (`https://notion.so/...`)
3. Check that the Electron API is available (desktop app only)
4. Look for error messages in alerts or console

### Performance Issues
- The app uses smart caching to minimize OmniFocus queries
- Only sync when needed using the "Sync from OmniFocus" button
- Check the "Last synced" timestamp to avoid redundant syncs

## Privacy and local data

Blinders reads personal project and task data from OmniFocus and can optionally connect to Notion. Keep tokens, database identifiers, exported task data, screenshots, and local database files out of Git. The repository intentionally contains source and generic documentation only.

## License

No license has been granted. Copyright remains with the project owner.

## Troubleshooting

### No projects appear in my queue

**Problem**: After syncing, no projects show up in the review queue.

**Solutions**:
1. **Check OmniFocus Review Dates**: Make sure your projects have review intervals set in OmniFocus
   - Open project in OmniFocus → Inspector → Review section
   - Set a review interval (e.g., 1 week, 2 weeks, 1 month)

2. **Check if projects are due**: The app only shows projects where `nextReviewDate ≤ today`
   - Projects not due yet won't appear
   - Check console logs for filtering details

3. **Verify OmniFocus is running**: The app requires OmniFocus to be running to sync data

### "Mark Reviewed" doesn't update OmniFocus

**Problem**: Clicking "Mark Reviewed" updates the app but not OmniFocus.

**Solutions**:
1. **Ensure OmniFocus is running**: The app requires OmniFocus to be open
2. **Check console logs**: Look for errors in the developer console (View → Toggle Developer Tools)
3. **Try manual review in OmniFocus**: Right-click project → Review → Mark Reviewed
4. **Re-sync**: Click "Sync from OmniFocus" to refresh data

### Projects I already reviewed keep appearing

**Problem**: Projects reappear after marking them as reviewed.

**Solutions**:
1. **Clear IndexedDB cache**: 
   - Open Developer Tools → Application → IndexedDB → Clear
   - Re-sync from OmniFocus
2. **Check OmniFocus**: Verify the `lastReviewDate` was actually updated in OmniFocus
3. **Restart the app**: Sometimes a fresh start helps sync state

### Debug Mode

To see detailed logging for troubleshooting:
1. Open Developer Tools: `View → Toggle Developer Tools`
2. Go to Console tab
3. Look for messages about:
   - Project filtering: "Filtered to X projects due for review"
   - Mark reviewed: "Project X marked as reviewed in OmniFocus"
   - Sync operations: "Loaded X projects from cache"

## Contributing

This is a personal productivity tool. If you'd like to contribute:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Your License Here]

## Acknowledgments

- Built with React, TypeScript, Vite, and Electron
- Inspired by GTD methodology and weekly review practices
- OmniFocus integration via JXA (JavaScript for Automation)

## Version History

### v0.2.0 (2025-10-07)
- ✨ **NEW**: Notion deep link integration
  - Quick access to Notion documentation with `Ctrl+N` / `Cmd+N`
  - Visual indicator (📝) for projects with Notion links
  - Simple setup: add Notion URL as first line of project notes
- 🔧 Extended data model to include project notes
- 📝 Updated keyboard shortcuts overlay

### v0.1.0
- Initial release with core review functionality
- OmniFocus integration
- Task management
- Session tracking
- Performance optimizations

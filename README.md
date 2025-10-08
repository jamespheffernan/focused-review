# Weekly Review HUD

A focused, distraction-free desktop application for conducting weekly reviews of your OmniFocus projects. Built with React, TypeScript, Vite, and Electron.

## Features

### Core Functionality
- **OmniFocus Integration**: Seamlessly sync projects and tasks from OmniFocus
- **Guided Review Process**: Answer context-aware questions for each project
- **Task Management**: View, edit, and manage tasks during your review
- **Offline-First**: All data stored locally using IndexedDB with explicit sync
- **Session Tracking**: Track review sessions, time spent, and completion stats

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
   - `https://www.notion.so/{workspace}/{page-id}`
   - `https://notion.so/{workspace}/{page-id}`

## Installation

### Prerequisites
- macOS (for OmniFocus integration)
- Node.js 18+ and npm
- OmniFocus 3 or later

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
- **Frontend**: React 18 + TypeScript + Vite
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
weekly-review-hud/
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

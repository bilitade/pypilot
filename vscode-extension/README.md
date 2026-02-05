# PyPilot VS Code Extension

Client that provides the chat UI and executes tool calls locally.

## Structure

```
src/
├── extension.ts       # Entry point, registers commands
├── assistantPanel.ts  # Chat webview, message orchestration
├── toolExecutor.ts    # Executes file operations
└── diffManager.ts     # Visual diff decorations

webview/
├── script.js          # Chat UI logic
└── style.css          # Styling
```

## How It Works

1. User types message → Extension POSTs to backend
2. Backend returns response + tool calls
3. Extension executes tools locally (Node.js `fs`)
4. Results sent back to backend
5. Agent continues or completes
6. File changes show as diffs → user accepts/rejects

## Setup

```bash
npm install
```

Press **F5** in VS Code → launches Extension Development Host

In new window: `Ctrl+Shift+P` → **"Open PyPilot Assistant"**

Make sure backend is running at `http://localhost:8000`

## Tool Execution

`toolExecutor.ts` maps tool names to local operations:

| Tool | Action |
|------|--------|
| `read_file` | `fs.readFileSync()` |
| `write_file` | Create/modify file → propose diff |
| `edit_file` | Find/replace → propose diff |
| `delete_file` | Clear content → propose diff |
| `list_directory` | `fs.readdirSync()` |
| `create_directory` | `fs.mkdirSync()` |
| `get_workspace_info` | Return workspace metadata |
| `search_files` | `vscode.workspace.findFiles()` |

All paths resolved relative to workspace root.

## Diff Management

When modifying existing files:
1. Store original + proposed content
2. Calculate line-by-line diff
3. Apply VS Code decorations:
   - Green background for added lines
   - Red ghost text for removed lines
4. User accepts → save to disk
5. User rejects → revert to original

## Webview

Custom chat UI (`webview/`):
- Message history
- Model selector dropdown
- Status indicators
- Markdown rendering

Communicates with extension via `postMessage`.

## Configuration

Backend URL hardcoded in `assistantPanel.ts`:
```typescript
const response = await fetch('http://localhost:8000/chat', {
```

Change if backend is on different port.

## Commands

- `pypilot.openAssistant` - Open chat panel
- `pypilot.acceptChange` - Accept proposed change
- `pypilot.rejectChange` - Reject proposed change

## Building

```bash
# Development
npm run compile

# Production bundle
npm run package
```

Creates `dist/extension.js`.

## Debugging

- Press `F5` to debug extension
- `console.log()` appears in Debug Console
- For webview: right-click panel → "Open Webview Developer Tools"
- Reload extension: `Ctrl+R` in Extension Host window

## State

- **Thread ID**: Generated per conversation (`thread_${timestamp}_${random}`)
- **Pending Changes**: Map of `filePath → PendingChange` with original/proposed content
- **Decorations**: Managed by `DiffManager` singleton

## Dependencies

- `diff` - Text diff computation
- `@types/vscode` - VS Code API types
- `webpack` + `ts-loader` - Build tooling

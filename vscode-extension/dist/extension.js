/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(__webpack_require__(1));
const assistantPanel_1 = __webpack_require__(2);
const diffManager_1 = __webpack_require__(6);
/**
 * Main activation entry point for the PyPilot extension.
 * Sets up commands, providers, and event listeners.
 */
function activate(context) {
    console.log('PyPilot extension is now active.');
    // Register command to open the Assistant panel
    context.subscriptions.push(vscode.commands.registerCommand('pypilot.openAssistant', () => {
        assistantPanel_1.AssistantPanel.createOrShow(context.extensionUri);
    }));
    // Ensure decorations are updated when switching tabs or editor state changes
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            diffManager_1.DiffManager.getInstance().refreshVisibleDecorations();
        }
    }), vscode.workspace.onDidOpenTextDocument(() => {
        diffManager_1.DiffManager.getInstance().refreshVisibleDecorations();
    }));
    // Initial decoration refresh
    diffManager_1.DiffManager.getInstance().refreshVisibleDecorations();
}
/**
 * Deactivation logic (cleanup if needed).
 */
function deactivate() {
    // Cleanup logic here if necessary
}


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AssistantPanel = void 0;
const vscode = __importStar(__webpack_require__(1));
const toolExecutor_1 = __webpack_require__(3);
const diffManager_1 = __webpack_require__(6);
/**
 * Manages the PyPilot Assistant webview panel.
 * Handles communication between the webview and the VS Code extension host.
 */
class AssistantPanel {
    static currentPanel;
    _panel;
    _disposables = [];
    currentThreadId;
    toolExecutor;
    /**
     * Creates a new assistant panel or reveals the existing one.
     */
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor?.viewColumn;
        if (AssistantPanel.currentPanel) {
            AssistantPanel.currentPanel._panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('pypilotAssistant', 'PyPilot Assistant', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'webview'),
                vscode.Uri.joinPath(extensionUri, 'src', 'asset')
            ]
        });
        AssistantPanel.currentPanel = new AssistantPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this._panel = panel;
        this.currentThreadId = this.generateThreadId();
        this.toolExecutor = new toolExecutor_1.ToolExecutor();
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, extensionUri);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Listen for messages from the webview
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    this.handleUserMessage(message.text, undefined, message.model);
                    break;
                case 'newChat':
                    this.startNewChat();
                    break;
                case 'getThreadId':
                    this._postToWebview('threadId', { threadId: this.currentThreadId });
                    break;
                case 'acceptChange':
                    await diffManager_1.DiffManager.getInstance().acceptChange(message.id);
                    break;
                case 'rejectChange':
                    await diffManager_1.DiffManager.getInstance().rejectChange(message.id);
                    break;
            }
        }, null, this._disposables);
        // Send initial state to webview
        setTimeout(() => {
            this._postToWebview('threadId', { threadId: this.currentThreadId });
        }, 100);
    }
    generateThreadId() {
        return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    startNewChat() {
        this.currentThreadId = this.generateThreadId();
        this._postToWebview('newChat', { threadId: this.currentThreadId });
    }
    /**
     * Orchestrates the conversation flow between user, agent, and tools.
     */
    async handleUserMessage(text, toolResults, selectedModel) {
        if (!toolResults) {
            this._postToWebview('addMessage', {
                message: {
                    type: 'user',
                    text: text,
                    timestamp: new Date().toISOString()
                }
            });
        }
        this._postToWebview('showTypingIndicator');
        try {
            const requestBody = {
                message: text,
                thread_id: this.currentThreadId,
                model: selectedModel
            };
            if (toolResults)
                requestBody.tool_results = toolResults;
            // Proxy request to the LangGraph backend
            const response = await fetch('http://localhost:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok)
                throw new Error(`Server returned ${response.status}`);
            const data = await response.json();
            // Display assistant response
            if (data.response) {
                this._postToWebview('addMessage', {
                    message: {
                        type: 'assistant',
                        text: data.response,
                        timestamp: new Date().toISOString()
                    }
                });
            }
            // Execute tool calls if requested by the agent
            if (data.tool_calls && data.tool_calls.length > 0) {
                let currentResults = [];
                for (const toolCall of data.tool_calls) {
                    let status = 'Working...';
                    let stepText = `Executing ${toolCall.function.name}...`;
                    try {
                        const args = JSON.parse(toolCall.function.arguments);
                        // Map technical tool names to user-friendly status updates
                        const handlers = {
                            'read_file': `Reading ${args.file_path}`,
                            'write_file': `Writing ${args.file_path}`,
                            'edit_file': `Editing ${args.file_path}`,
                            'delete_file': `Deleting ${args.file_path}`,
                            'list_directory': `Listing ${args.directory_path || 'workspace'}`,
                            'create_directory': `Creating ${args.directory_path}`,
                            'get_workspace_info': `Analyzing workspace`,
                            'search_files': `Searching for ${args.pattern || args.query}`
                        };
                        if (handlers[toolCall.function.name]) {
                            stepText = handlers[toolCall.function.name];
                            status = stepText.split(' ')[0] + '...';
                        }
                    }
                    catch (e) { }
                    this._postToWebview('updateStatus', { status: status, done: false });
                    this._postToWebview('addMessage', {
                        message: {
                            type: 'system',
                            text: stepText,
                            timestamp: new Date().toISOString()
                        }
                    });
                    const results = await this.toolExecutor.executeToolCalls([toolCall]);
                    // Surface change proposals to the webview UI
                    for (const result of results) {
                        try {
                            const parsed = JSON.parse(result.output);
                            if (parsed.action === 'proposal') {
                                this._postToWebview('addAction', {
                                    action: {
                                        id: parsed.proposalId,
                                        type: parsed.type,
                                        filePath: parsed.filePath,
                                        timestamp: new Date().toISOString()
                                    }
                                });
                            }
                        }
                        catch (e) { }
                    }
                    currentResults = [...currentResults, ...results];
                }
                this._postToWebview('updateStatus', { status: 'Complete', done: true });
                // Continue the turn with the collected tool results
                await this.handleUserMessage(text, currentResults, selectedModel);
                return;
            }
        }
        catch (error) {
            this._postToWebview('addMessage', {
                message: {
                    type: 'assistant',
                    text: `⚠️ Error: ${error instanceof Error ? error.message : 'Unknown error'}. Ensure the backend service is reachable.`,
                    timestamp: new Date().toISOString()
                }
            });
        }
        finally {
            this._postToWebview('hideTypingIndicator');
        }
    }
    _postToWebview(command, data) {
        this._panel.webview.postMessage({ command, ...data });
    }
    _getHtmlForWebview(webview, extensionUri) {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'webview', 'style.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'webview', 'script.js'));
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'asset', 'pypilot.png'));
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>PyPilot Assistant</title>
</head>
<body>
    <div class="app-container">
        <header class="app-header">
            <div class="logo">
                <img src="${logoUri}" alt="PyPilot Logo" class="logo-img">
            </div>
            <div class="header-actions">
                <button id="newChatBtn" title="New Chat">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                </button>
            </div>
        </header>
        <main id="chat-area" class="chat-area">
            <div id="messages" class="messages-container">
                <div class="welcome-message">
                    <h1>Code with PyPilot</h1>
                    <p>Leverage agentic reasoning to build, debug, and understand your Python codebase.</p>
                </div>
            </div>
        </main>
        <footer class="input-area">
            <div class="input-container">
                <div class="input-tools">
                    <span id="threadId" class="status-badge">New Session</span>
                </div>
                <div class="textarea-wrapper">
                    <textarea id="messageInput" placeholder="How can PyPilot help you today?" rows="1"></textarea>
                    <div class="input-actions">
                        <div class="model-selector-container">
                            <select id="modelSelector">
                                <optgroup label="OpenAI">
                                    <option value="openai/gpt-5-mini" selected>GPT-5 Mini</option>
                                    <option value="openai/gpt-5">GPT-5</option>
                                    <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                                    <option value="openai/gpt-4">GPT-4</option>
                                </optgroup>
                                <optgroup label="Groq (OSS)">
                                    <option value="groq/llama-3.3-70b-versatile">Llama 3.3 70B</option>
                                    <option value="groq/openai/gpt-oss-20b">GPT-OSS 20B</option>
                                </optgroup>
                            </select>
                            <div class="selector-arrow">
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M1 1L5 5L9 1"/>
                                </svg>
                            </div>
                        </div>
                        <button id="sendButton" disabled>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </footer>
    </div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
    dispose() {
        AssistantPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x)
                x.dispose();
        }
    }
}
exports.AssistantPanel = AssistantPanel;


/***/ }),
/* 3 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ToolExecutor = void 0;
const vscode = __importStar(__webpack_require__(1));
const fs = __importStar(__webpack_require__(4));
const path = __importStar(__webpack_require__(5));
const diffManager_1 = __webpack_require__(6);
/**
 * Executes file system and workspace operations requested by the AI.
 */
class ToolExecutor {
    workspaceRoot;
    constructor() {
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
    }
    /**
     * Dispatches multiple tool calls to their respective handlers.
     */
    async executeToolCalls(toolCalls) {
        const results = [];
        for (const toolCall of toolCalls) {
            let output = '';
            try {
                const args = JSON.parse(toolCall.function.arguments);
                switch (toolCall.function.name) {
                    case 'read_file':
                        output = await this.readFile(args.file_path);
                        break;
                    case 'write_file':
                        output = await this.writeFile(args.file_path, args.content);
                        break;
                    case 'edit_file':
                        output = await this.editFile(args.file_path, args.old_text, args.new_text);
                        break;
                    case 'delete_file':
                        output = await this.deleteFile(args.file_path);
                        break;
                    case 'list_directory':
                        output = await this.listDirectory(args.directory_path || '.');
                        break;
                    case 'create_directory':
                        output = await this.createDirectory(args.directory_path);
                        break;
                    case 'get_workspace_info':
                        output = await this.getWorkspaceInfo();
                        break;
                    case 'search_files':
                        output = await this.searchFiles(args.pattern || args.query);
                        break;
                    default:
                        output = `Unknown tool: ${toolCall.function.name}`;
                }
            }
            catch (error) {
                output = `Error: ${error instanceof Error ? error.message : String(error)}`;
            }
            results.push({ tool_call_id: toolCall.id, output });
        }
        return results;
    }
    async readFile(filePath) {
        const fullPath = this.resolvePathInWorkspace(filePath);
        if (!fs.existsSync(fullPath))
            throw new Error(`File not found: ${filePath}`);
        return fs.readFileSync(fullPath, 'utf-8');
    }
    /**
     * Writes content to a file. Proposes a change if the file exists,
     * otherwise creates it immediately.
     */
    async writeFile(filePath, proposedContent) {
        const fullPath = this.resolvePathInWorkspace(filePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        const uri = vscode.Uri.file(fullPath);
        const pending = diffManager_1.DiffManager.getInstance().getChangeForFile(uri);
        const originalContent = pending ? pending.originalContent : (fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '');
        const edit = new vscode.WorkspaceEdit();
        if (fs.existsSync(fullPath)) {
            const document = await vscode.workspace.openTextDocument(uri);
            const fullRange = new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));
            edit.replace(uri, fullRange, proposedContent);
            await vscode.workspace.applyEdit(edit);
            const proposalId = await diffManager_1.DiffManager.getInstance().proposeChange(fullPath, originalContent, proposedContent);
            return JSON.stringify({ action: 'proposal', type: 'write', filePath, proposalId });
        }
        else {
            edit.createFile(uri, { overwrite: true, contents: Buffer.from(proposedContent, 'utf-8') });
            await vscode.workspace.applyEdit(edit);
            return `Created new file: ${filePath}`;
        }
    }
    /**
     * Performs a find-and-replace edit on an existing file.
     */
    async editFile(filePath, oldText, newText) {
        const fullPath = this.resolvePathInWorkspace(filePath);
        if (!fs.existsSync(fullPath))
            throw new Error(`File not found: ${filePath}`);
        const uri = vscode.Uri.file(fullPath);
        const pending = diffManager_1.DiffManager.getInstance().getChangeForFile(uri);
        const originalContent = pending ? pending.originalContent : fs.readFileSync(fullPath, 'utf-8');
        const currentContent = pending ? pending.proposedContent : originalContent;
        if (!currentContent.includes(oldText)) {
            throw new Error(`Could not find text to replace in ${filePath}. Note: The file has a pending change, ensure you are editing the latest state.`);
        }
        const updatedContent = currentContent.replace(oldText, newText);
        const edit = new vscode.WorkspaceEdit();
        const document = await vscode.workspace.openTextDocument(uri);
        const fullRange = new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));
        edit.replace(uri, fullRange, updatedContent);
        await vscode.workspace.applyEdit(edit);
        const proposalId = await diffManager_1.DiffManager.getInstance().proposeChange(fullPath, originalContent, updatedContent);
        return JSON.stringify({ action: 'proposal', type: 'edit', filePath, proposalId });
    }
    async listDirectory(directoryPath) {
        const fullPath = this.resolvePathInWorkspace(directoryPath);
        if (!fs.existsSync(fullPath))
            throw new Error(`Directory not found: ${directoryPath}`);
        const items = fs.readdirSync(fullPath, { withFileTypes: true });
        const result = items.map(item => ({
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            path: path.join(directoryPath, item.name)
        }));
        return JSON.stringify({ directory: directoryPath, items: result });
    }
    async createDirectory(directoryPath) {
        const fullPath = this.resolvePathInWorkspace(directoryPath);
        if (!fs.existsSync(fullPath))
            fs.mkdirSync(fullPath, { recursive: true });
        return `Created directory: ${directoryPath}`;
    }
    /**
     * Proposes the deletion of a file by clearing its content and marking it for review.
     */
    async deleteFile(filePath) {
        const fullPath = this.resolvePathInWorkspace(filePath);
        if (!fs.existsSync(fullPath))
            throw new Error(`File not found: ${filePath}`);
        const uri = vscode.Uri.file(fullPath);
        const pending = diffManager_1.DiffManager.getInstance().getChangeForFile(uri);
        const originalContent = pending ? pending.originalContent : fs.readFileSync(fullPath, 'utf-8');
        const document = await vscode.workspace.openTextDocument(uri);
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));
        edit.replace(uri, fullRange, '');
        await vscode.workspace.applyEdit(edit);
        const proposalId = await diffManager_1.DiffManager.getInstance().proposeChange(fullPath, originalContent, '');
        return JSON.stringify({ action: 'proposal', type: 'delete', filePath, proposalId });
    }
    /**
     * Returns metadata about the current workspace state.
     */
    async getWorkspaceInfo() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const activeEditor = vscode.window.activeTextEditor;
        return JSON.stringify({
            workspace_root: this.workspaceRoot,
            workspace_name: workspaceFolders?.[0]?.name || 'Unknown',
            active_file: activeEditor?.document.fileName || null,
            open_files: vscode.workspace.textDocuments.map(doc => doc.fileName),
            language: activeEditor?.document.languageId || null
        });
    }
    /**
     * Searches for files matching a glob pattern.
     */
    async searchFiles(pattern) {
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
        const relativePaths = files.map(file => path.relative(this.workspaceRoot, file.fsPath));
        return JSON.stringify({ pattern, files: relativePaths, count: relativePaths.length });
    }
    resolvePathInWorkspace(filePath) {
        return path.isAbsolute(filePath) ? filePath : path.join(this.workspaceRoot, filePath);
    }
}
exports.ToolExecutor = ToolExecutor;


/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 5 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 6 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DiffManager = void 0;
const vscode = __importStar(__webpack_require__(1));
const diff = __importStar(__webpack_require__(7));
/**
 * Manages visualization of AI-proposed changes using VS Code decorations.
 * Implemented as a singleton to maintain consistent state across the extension.
 */
class DiffManager {
    static instance;
    pendingChanges = new Map();
    addedDecoration;
    removedDecoration;
    constructor() {
        // Decoration for added lines (background highlight)
        this.addedDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('diffEditor.insertedLineBackground'),
            isWholeLine: true,
            overviewRulerColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
            overviewRulerLane: vscode.OverviewRulerLane.Full
        });
        // Decoration for removed lines (ghost text via 'before' pseudo-element)
        this.removedDecoration = vscode.window.createTextEditorDecorationType({
            isWholeLine: false
        });
    }
    static getInstance() {
        if (!DiffManager.instance) {
            DiffManager.instance = new DiffManager();
        }
        return DiffManager.instance;
    }
    /**
     * Registers a new change proposal and triggers UI refresh.
     * @param filePath Absolute path of the file being changed.
     * @param originalContent Content of the file before modification.
     * @param proposedContent Content of the file after modification.
     * @returns A promise resolving to the unique proposal ID.
     */
    async proposeChange(filePath, originalContent, proposedContent) {
        const id = `change_${Date.now()}`;
        const pathKey = vscode.Uri.file(filePath).toString();
        const change = { id, filePath, originalContent, proposedContent };
        this.pendingChanges.set(pathKey, change);
        await this.updateDecorations(filePath);
        return id;
    }
    /**
     * Finalizes the change by saving the proposed content to disk.
     * @param id The ID of the proposal to accept.
     */
    async acceptChange(id) {
        const change = this.getChangeById(id);
        if (!change)
            return;
        const uri = vscode.Uri.file(change.filePath);
        if (change.proposedContent === '') {
            try {
                // Handle file deletion
                await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: true });
            }
            catch (e) {
                // File might have already been deleted
            }
        }
        else {
            const document = await vscode.workspace.openTextDocument(uri);
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));
            edit.replace(uri, fullRange, change.proposedContent);
            await vscode.workspace.applyEdit(edit);
            await document.save();
        }
        this.removeChange(id);
    }
    /**
     * Reverts the file to its original state.
     * @param id The ID of the proposal to reject.
     */
    async rejectChange(id) {
        const change = this.getChangeById(id);
        if (!change)
            return;
        const uri = vscode.Uri.file(change.filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));
        edit.replace(uri, fullRange, change.originalContent);
        await vscode.workspace.applyEdit(edit);
        await document.save();
        this.removeChange(id);
    }
    /**
     * Removes a change proposal from the internal map and clears decorations.
     */
    removeChange(id) {
        for (const [pathKey, change] of this.pendingChanges.entries()) {
            if (change.id === id) {
                const filePath = change.filePath;
                this.pendingChanges.delete(pathKey);
                this.updateDecorations(filePath);
                break;
            }
        }
    }
    getChangeById(id) {
        for (const change of this.pendingChanges.values()) {
            if (change.id === id)
                return change;
        }
        return undefined;
    }
    /**
     * Retrieves the pending change for a given file URI.
     */
    getChangeForFile(uri) {
        return this.pendingChanges.get(uri.toString());
    }
    /**
     * Refreshes decorations for all currently visible text editors.
     */
    async refreshVisibleDecorations() {
        for (const editor of vscode.window.visibleTextEditors) {
            await this.updateDecorations(editor.document.uri.fsPath, editor);
        }
    }
    /**
     * Calculates diff and applies decorations to the specified file's editors.
     */
    async updateDecorations(filePath, specificEditor) {
        const uri = vscode.Uri.file(filePath);
        const editors = specificEditor ? [specificEditor] : vscode.window.visibleTextEditors.filter(e => e.document.uri.toString() === uri.toString());
        const change = this.getChangeForFile(uri);
        for (const editor of editors) {
            if (!change) {
                editor.setDecorations(this.addedDecoration, []);
                editor.setDecorations(this.removedDecoration, []);
                continue;
            }
            const addedRanges = [];
            const removedOptions = [];
            // Perform line-by-line diff
            const diffResults = diff.diffLines(change.originalContent, change.proposedContent);
            let currentLine = 0;
            for (const part of diffResults) {
                const lineCount = part.count || 0;
                if (part.added) {
                    addedRanges.push(new vscode.Range(currentLine, 0, currentLine + lineCount - 1, 0));
                    currentLine += lineCount;
                }
                else if (part.removed) {
                    // Render removals as ghost text
                    const attachLine = Math.min(currentLine, editor.document.lineCount - 1);
                    const deletedLines = part.value.replace(/\n$/, '').split('\n');
                    for (let i = 0; i < deletedLines.length; i++) {
                        removedOptions.push({
                            range: new vscode.Range(attachLine, 0, attachLine, 0),
                            renderOptions: {
                                before: {
                                    contentText: '  - ' + deletedLines[i],
                                    color: new vscode.ThemeColor('diffEditor.removedTextForeground'),
                                    backgroundColor: new vscode.ThemeColor('diffEditor.removedLineBackground'),
                                    fontStyle: 'italic',
                                    margin: `0 0 -1.2em 0; display: block;`
                                }
                            }
                        });
                    }
                }
                else {
                    currentLine += lineCount;
                }
            }
            editor.setDecorations(this.addedDecoration, addedRanges);
            editor.setDecorations(this.removedDecoration, removedOptions);
        }
    }
}
exports.DiffManager = DiffManager;


/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


/* See LICENSE file for terms of use */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.canonicalize = exports.convertChangesToXML = exports.convertChangesToDMP = exports.reversePatch = exports.parsePatch = exports.applyPatches = exports.applyPatch = exports.OMIT_HEADERS = exports.FILE_HEADERS_ONLY = exports.INCLUDE_HEADERS = exports.formatPatch = exports.createPatch = exports.createTwoFilesPatch = exports.structuredPatch = exports.arrayDiff = exports.diffArrays = exports.jsonDiff = exports.diffJson = exports.cssDiff = exports.diffCss = exports.sentenceDiff = exports.diffSentences = exports.diffTrimmedLines = exports.lineDiff = exports.diffLines = exports.wordsWithSpaceDiff = exports.diffWordsWithSpace = exports.wordDiff = exports.diffWords = exports.characterDiff = exports.diffChars = exports.Diff = void 0;
/*
 * Text diff implementation.
 *
 * This library supports the following APIs:
 * Diff.diffChars: Character by character diff
 * Diff.diffWords: Word (as defined by \b regex) diff which ignores whitespace
 * Diff.diffLines: Line based diff
 *
 * Diff.diffCss: Diff targeted at CSS content
 *
 * These methods are based on the implementation proposed in
 * "An O(ND) Difference Algorithm and its Variations" (Myers, 1986).
 * http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.4.6927
 */
var base_js_1 = __webpack_require__(8);
exports.Diff = base_js_1.default;
var character_js_1 = __webpack_require__(9);
Object.defineProperty(exports, "diffChars", ({ enumerable: true, get: function () { return character_js_1.diffChars; } }));
Object.defineProperty(exports, "characterDiff", ({ enumerable: true, get: function () { return character_js_1.characterDiff; } }));
var word_js_1 = __webpack_require__(10);
Object.defineProperty(exports, "diffWords", ({ enumerable: true, get: function () { return word_js_1.diffWords; } }));
Object.defineProperty(exports, "diffWordsWithSpace", ({ enumerable: true, get: function () { return word_js_1.diffWordsWithSpace; } }));
Object.defineProperty(exports, "wordDiff", ({ enumerable: true, get: function () { return word_js_1.wordDiff; } }));
Object.defineProperty(exports, "wordsWithSpaceDiff", ({ enumerable: true, get: function () { return word_js_1.wordsWithSpaceDiff; } }));
var line_js_1 = __webpack_require__(12);
Object.defineProperty(exports, "diffLines", ({ enumerable: true, get: function () { return line_js_1.diffLines; } }));
Object.defineProperty(exports, "diffTrimmedLines", ({ enumerable: true, get: function () { return line_js_1.diffTrimmedLines; } }));
Object.defineProperty(exports, "lineDiff", ({ enumerable: true, get: function () { return line_js_1.lineDiff; } }));
var sentence_js_1 = __webpack_require__(14);
Object.defineProperty(exports, "diffSentences", ({ enumerable: true, get: function () { return sentence_js_1.diffSentences; } }));
Object.defineProperty(exports, "sentenceDiff", ({ enumerable: true, get: function () { return sentence_js_1.sentenceDiff; } }));
var css_js_1 = __webpack_require__(15);
Object.defineProperty(exports, "diffCss", ({ enumerable: true, get: function () { return css_js_1.diffCss; } }));
Object.defineProperty(exports, "cssDiff", ({ enumerable: true, get: function () { return css_js_1.cssDiff; } }));
var json_js_1 = __webpack_require__(16);
Object.defineProperty(exports, "diffJson", ({ enumerable: true, get: function () { return json_js_1.diffJson; } }));
Object.defineProperty(exports, "canonicalize", ({ enumerable: true, get: function () { return json_js_1.canonicalize; } }));
Object.defineProperty(exports, "jsonDiff", ({ enumerable: true, get: function () { return json_js_1.jsonDiff; } }));
var array_js_1 = __webpack_require__(17);
Object.defineProperty(exports, "diffArrays", ({ enumerable: true, get: function () { return array_js_1.diffArrays; } }));
Object.defineProperty(exports, "arrayDiff", ({ enumerable: true, get: function () { return array_js_1.arrayDiff; } }));
var apply_js_1 = __webpack_require__(18);
Object.defineProperty(exports, "applyPatch", ({ enumerable: true, get: function () { return apply_js_1.applyPatch; } }));
Object.defineProperty(exports, "applyPatches", ({ enumerable: true, get: function () { return apply_js_1.applyPatches; } }));
var parse_js_1 = __webpack_require__(20);
Object.defineProperty(exports, "parsePatch", ({ enumerable: true, get: function () { return parse_js_1.parsePatch; } }));
var reverse_js_1 = __webpack_require__(22);
Object.defineProperty(exports, "reversePatch", ({ enumerable: true, get: function () { return reverse_js_1.reversePatch; } }));
var create_js_1 = __webpack_require__(23);
Object.defineProperty(exports, "structuredPatch", ({ enumerable: true, get: function () { return create_js_1.structuredPatch; } }));
Object.defineProperty(exports, "createTwoFilesPatch", ({ enumerable: true, get: function () { return create_js_1.createTwoFilesPatch; } }));
Object.defineProperty(exports, "createPatch", ({ enumerable: true, get: function () { return create_js_1.createPatch; } }));
Object.defineProperty(exports, "formatPatch", ({ enumerable: true, get: function () { return create_js_1.formatPatch; } }));
Object.defineProperty(exports, "INCLUDE_HEADERS", ({ enumerable: true, get: function () { return create_js_1.INCLUDE_HEADERS; } }));
Object.defineProperty(exports, "FILE_HEADERS_ONLY", ({ enumerable: true, get: function () { return create_js_1.FILE_HEADERS_ONLY; } }));
Object.defineProperty(exports, "OMIT_HEADERS", ({ enumerable: true, get: function () { return create_js_1.OMIT_HEADERS; } }));
var dmp_js_1 = __webpack_require__(24);
Object.defineProperty(exports, "convertChangesToDMP", ({ enumerable: true, get: function () { return dmp_js_1.convertChangesToDMP; } }));
var xml_js_1 = __webpack_require__(25);
Object.defineProperty(exports, "convertChangesToXML", ({ enumerable: true, get: function () { return xml_js_1.convertChangesToXML; } }));


/***/ }),
/* 8 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
var Diff = /** @class */ (function () {
    function Diff() {
    }
    Diff.prototype.diff = function (oldStr, newStr, 
    // Type below is not accurate/complete - see above for full possibilities - but it compiles
    options) {
        if (options === void 0) { options = {}; }
        var callback;
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        else if ('callback' in options) {
            callback = options.callback;
        }
        // Allow subclasses to massage the input prior to running
        var oldString = this.castInput(oldStr, options);
        var newString = this.castInput(newStr, options);
        var oldTokens = this.removeEmpty(this.tokenize(oldString, options));
        var newTokens = this.removeEmpty(this.tokenize(newString, options));
        return this.diffWithOptionsObj(oldTokens, newTokens, options, callback);
    };
    Diff.prototype.diffWithOptionsObj = function (oldTokens, newTokens, options, callback) {
        var _this = this;
        var _a;
        var done = function (value) {
            value = _this.postProcess(value, options);
            if (callback) {
                setTimeout(function () { callback(value); }, 0);
                return undefined;
            }
            else {
                return value;
            }
        };
        var newLen = newTokens.length, oldLen = oldTokens.length;
        var editLength = 1;
        var maxEditLength = newLen + oldLen;
        if (options.maxEditLength != null) {
            maxEditLength = Math.min(maxEditLength, options.maxEditLength);
        }
        var maxExecutionTime = (_a = options.timeout) !== null && _a !== void 0 ? _a : Infinity;
        var abortAfterTimestamp = Date.now() + maxExecutionTime;
        var bestPath = [{ oldPos: -1, lastComponent: undefined }];
        // Seed editLength = 0, i.e. the content starts with the same values
        var newPos = this.extractCommon(bestPath[0], newTokens, oldTokens, 0, options);
        if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
            // Identity per the equality and tokenizer
            return done(this.buildValues(bestPath[0].lastComponent, newTokens, oldTokens));
        }
        // Once we hit the right edge of the edit graph on some diagonal k, we can
        // definitely reach the end of the edit graph in no more than k edits, so
        // there's no point in considering any moves to diagonal k+1 any more (from
        // which we're guaranteed to need at least k+1 more edits).
        // Similarly, once we've reached the bottom of the edit graph, there's no
        // point considering moves to lower diagonals.
        // We record this fact by setting minDiagonalToConsider and
        // maxDiagonalToConsider to some finite value once we've hit the edge of
        // the edit graph.
        // This optimization is not faithful to the original algorithm presented in
        // Myers's paper, which instead pointlessly extends D-paths off the end of
        // the edit graph - see page 7 of Myers's paper which notes this point
        // explicitly and illustrates it with a diagram. This has major performance
        // implications for some common scenarios. For instance, to compute a diff
        // where the new text simply appends d characters on the end of the
        // original text of length n, the true Myers algorithm will take O(n+d^2)
        // time while this optimization needs only O(n+d) time.
        var minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
        // Main worker method. checks all permutations of a given edit length for acceptance.
        var execEditLength = function () {
            for (var diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
                var basePath = void 0;
                var removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
                if (removePath) {
                    // No one else is going to attempt to use this value, clear it
                    // @ts-expect-error - perf optimisation. This type-violating value will never be read.
                    bestPath[diagonalPath - 1] = undefined;
                }
                var canAdd = false;
                if (addPath) {
                    // what newPos will be after we do an insertion:
                    var addPathNewPos = addPath.oldPos - diagonalPath;
                    canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
                }
                var canRemove = removePath && removePath.oldPos + 1 < oldLen;
                if (!canAdd && !canRemove) {
                    // If this path is a terminal then prune
                    // @ts-expect-error - perf optimisation. This type-violating value will never be read.
                    bestPath[diagonalPath] = undefined;
                    continue;
                }
                // Select the diagonal that we want to branch from. We select the prior
                // path whose position in the old string is the farthest from the origin
                // and does not pass the bounds of the diff graph
                if (!canRemove || (canAdd && removePath.oldPos < addPath.oldPos)) {
                    basePath = _this.addToPath(addPath, true, false, 0, options);
                }
                else {
                    basePath = _this.addToPath(removePath, false, true, 1, options);
                }
                newPos = _this.extractCommon(basePath, newTokens, oldTokens, diagonalPath, options);
                if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
                    // If we have hit the end of both strings, then we are done
                    return done(_this.buildValues(basePath.lastComponent, newTokens, oldTokens)) || true;
                }
                else {
                    bestPath[diagonalPath] = basePath;
                    if (basePath.oldPos + 1 >= oldLen) {
                        maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
                    }
                    if (newPos + 1 >= newLen) {
                        minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
                    }
                }
            }
            editLength++;
        };
        // Performs the length of edit iteration. Is a bit fugly as this has to support the
        // sync and async mode which is never fun. Loops over execEditLength until a value
        // is produced, or until the edit length exceeds options.maxEditLength (if given),
        // in which case it will return undefined.
        if (callback) {
            (function exec() {
                setTimeout(function () {
                    if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) {
                        return callback(undefined);
                    }
                    if (!execEditLength()) {
                        exec();
                    }
                }, 0);
            }());
        }
        else {
            while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
                var ret = execEditLength();
                if (ret) {
                    return ret;
                }
            }
        }
    };
    Diff.prototype.addToPath = function (path, added, removed, oldPosInc, options) {
        var last = path.lastComponent;
        if (last && !options.oneChangePerToken && last.added === added && last.removed === removed) {
            return {
                oldPos: path.oldPos + oldPosInc,
                lastComponent: { count: last.count + 1, added: added, removed: removed, previousComponent: last.previousComponent }
            };
        }
        else {
            return {
                oldPos: path.oldPos + oldPosInc,
                lastComponent: { count: 1, added: added, removed: removed, previousComponent: last }
            };
        }
    };
    Diff.prototype.extractCommon = function (basePath, newTokens, oldTokens, diagonalPath, options) {
        var newLen = newTokens.length, oldLen = oldTokens.length;
        var oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
        while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(oldTokens[oldPos + 1], newTokens[newPos + 1], options)) {
            newPos++;
            oldPos++;
            commonCount++;
            if (options.oneChangePerToken) {
                basePath.lastComponent = { count: 1, previousComponent: basePath.lastComponent, added: false, removed: false };
            }
        }
        if (commonCount && !options.oneChangePerToken) {
            basePath.lastComponent = { count: commonCount, previousComponent: basePath.lastComponent, added: false, removed: false };
        }
        basePath.oldPos = oldPos;
        return newPos;
    };
    Diff.prototype.equals = function (left, right, options) {
        if (options.comparator) {
            return options.comparator(left, right);
        }
        else {
            return left === right
                || (!!options.ignoreCase && left.toLowerCase() === right.toLowerCase());
        }
    };
    Diff.prototype.removeEmpty = function (array) {
        var ret = [];
        for (var i = 0; i < array.length; i++) {
            if (array[i]) {
                ret.push(array[i]);
            }
        }
        return ret;
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Diff.prototype.castInput = function (value, options) {
        return value;
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Diff.prototype.tokenize = function (value, options) {
        return Array.from(value);
    };
    Diff.prototype.join = function (chars) {
        // Assumes ValueT is string, which is the case for most subclasses.
        // When it's false, e.g. in diffArrays, this method needs to be overridden (e.g. with a no-op)
        // Yes, the casts are verbose and ugly, because this pattern - of having the base class SORT OF
        // assume tokens and values are strings, but not completely - is weird and janky.
        return chars.join('');
    };
    Diff.prototype.postProcess = function (changeObjects, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options) {
        return changeObjects;
    };
    Object.defineProperty(Diff.prototype, "useLongestToken", {
        get: function () {
            return false;
        },
        enumerable: false,
        configurable: true
    });
    Diff.prototype.buildValues = function (lastComponent, newTokens, oldTokens) {
        // First we convert our linked list of components in reverse order to an
        // array in the right order:
        var components = [];
        var nextComponent;
        while (lastComponent) {
            components.push(lastComponent);
            nextComponent = lastComponent.previousComponent;
            delete lastComponent.previousComponent;
            lastComponent = nextComponent;
        }
        components.reverse();
        var componentLen = components.length;
        var componentPos = 0, newPos = 0, oldPos = 0;
        for (; componentPos < componentLen; componentPos++) {
            var component = components[componentPos];
            if (!component.removed) {
                if (!component.added && this.useLongestToken) {
                    var value = newTokens.slice(newPos, newPos + component.count);
                    value = value.map(function (value, i) {
                        var oldValue = oldTokens[oldPos + i];
                        return oldValue.length > value.length ? oldValue : value;
                    });
                    component.value = this.join(value);
                }
                else {
                    component.value = this.join(newTokens.slice(newPos, newPos + component.count));
                }
                newPos += component.count;
                // Common case
                if (!component.added) {
                    oldPos += component.count;
                }
            }
            else {
                component.value = this.join(oldTokens.slice(oldPos, oldPos + component.count));
                oldPos += component.count;
            }
        }
        return components;
    };
    return Diff;
}());
exports["default"] = Diff;


/***/ }),
/* 9 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.characterDiff = void 0;
exports.diffChars = diffChars;
var base_js_1 = __webpack_require__(8);
var CharacterDiff = /** @class */ (function (_super) {
    __extends(CharacterDiff, _super);
    function CharacterDiff() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return CharacterDiff;
}(base_js_1.default));
exports.characterDiff = new CharacterDiff();
function diffChars(oldStr, newStr, options) {
    return exports.characterDiff.diff(oldStr, newStr, options);
}


/***/ }),
/* 10 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.wordsWithSpaceDiff = exports.wordDiff = void 0;
exports.diffWords = diffWords;
exports.diffWordsWithSpace = diffWordsWithSpace;
var base_js_1 = __webpack_require__(8);
var string_js_1 = __webpack_require__(11);
// Based on https://en.wikipedia.org/wiki/Latin_script_in_Unicode
//
// Chars/ranges counted as "word" characters by this regex are as follows:
//
// + U+00AD  Soft hyphen
// + 00C0–00FF (letters with diacritics from the Latin-1 Supplement), except:
//   - U+00D7  × Multiplication sign
//   - U+00F7  ÷ Division sign
// + Latin Extended-A, 0100–017F
// + Latin Extended-B, 0180–024F
// + IPA Extensions, 0250–02AF
// + Spacing Modifier Letters, 02B0–02FF, except:
//   - U+02C7  ˇ &#711;  Caron
//   - U+02D8  ˘ &#728;  Breve
//   - U+02D9  ˙ &#729;  Dot Above
//   - U+02DA  ˚ &#730;  Ring Above
//   - U+02DB  ˛ &#731;  Ogonek
//   - U+02DC  ˜ &#732;  Small Tilde
//   - U+02DD  ˝ &#733;  Double Acute Accent
// + Latin Extended Additional, 1E00–1EFF
var extendedWordChars = 'a-zA-Z0-9_\\u{AD}\\u{C0}-\\u{D6}\\u{D8}-\\u{F6}\\u{F8}-\\u{2C6}\\u{2C8}-\\u{2D7}\\u{2DE}-\\u{2FF}\\u{1E00}-\\u{1EFF}';
// Each token is one of the following:
// - A punctuation mark plus the surrounding whitespace
// - A word plus the surrounding whitespace
// - Pure whitespace (but only in the special case where the entire text
//   is just whitespace)
//
// We have to include surrounding whitespace in the tokens because the two
// alternative approaches produce horribly broken results:
// * If we just discard the whitespace, we can't fully reproduce the original
//   text from the sequence of tokens and any attempt to render the diff will
//   get the whitespace wrong.
// * If we have separate tokens for whitespace, then in a typical text every
//   second token will be a single space character. But this often results in
//   the optimal diff between two texts being a perverse one that preserves
//   the spaces between words but deletes and reinserts actual common words.
//   See https://github.com/kpdecker/jsdiff/issues/160#issuecomment-1866099640
//   for an example.
//
// Keeping the surrounding whitespace of course has implications for .equals
// and .join, not just .tokenize.
// This regex does NOT fully implement the tokenization rules described above.
// Instead, it gives runs of whitespace their own "token". The tokenize method
// then handles stitching whitespace tokens onto adjacent word or punctuation
// tokens.
var tokenizeIncludingWhitespace = new RegExp("[".concat(extendedWordChars, "]+|\\s+|[^").concat(extendedWordChars, "]"), 'ug');
var WordDiff = /** @class */ (function (_super) {
    __extends(WordDiff, _super);
    function WordDiff() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    WordDiff.prototype.equals = function (left, right, options) {
        if (options.ignoreCase) {
            left = left.toLowerCase();
            right = right.toLowerCase();
        }
        return left.trim() === right.trim();
    };
    WordDiff.prototype.tokenize = function (value, options) {
        if (options === void 0) { options = {}; }
        var parts;
        if (options.intlSegmenter) {
            var segmenter = options.intlSegmenter;
            if (segmenter.resolvedOptions().granularity != 'word') {
                throw new Error('The segmenter passed must have a granularity of "word"');
            }
            // We want `parts` to be an array whose elements alternate between being
            // pure whitespace and being pure non-whitespace. This is ALMOST what the
            // segments returned by a word-based Intl.Segmenter already look like,
            // and therefore we can ALMOST get what we want by simply doing...
            //     parts = Array.from(segmenter.segment(value), segment => segment.segment);
            // ... but not QUITE, because there's of one annoying special case: every
            // newline character gets its own segment, instead of sharing a segment
            // with other surrounding whitespace. We therefore need to manually merge
            // consecutive segments of whitespace into a single part:
            parts = [];
            for (var _i = 0, _a = Array.from(segmenter.segment(value)); _i < _a.length; _i++) {
                var segmentObj = _a[_i];
                var segment = segmentObj.segment;
                if (parts.length && (/\s/).test(parts[parts.length - 1]) && (/\s/).test(segment)) {
                    parts[parts.length - 1] += segment;
                }
                else {
                    parts.push(segment);
                }
            }
        }
        else {
            parts = value.match(tokenizeIncludingWhitespace) || [];
        }
        var tokens = [];
        var prevPart = null;
        parts.forEach(function (part) {
            if ((/\s/).test(part)) {
                if (prevPart == null) {
                    tokens.push(part);
                }
                else {
                    tokens.push(tokens.pop() + part);
                }
            }
            else if (prevPart != null && (/\s/).test(prevPart)) {
                if (tokens[tokens.length - 1] == prevPart) {
                    tokens.push(tokens.pop() + part);
                }
                else {
                    tokens.push(prevPart + part);
                }
            }
            else {
                tokens.push(part);
            }
            prevPart = part;
        });
        return tokens;
    };
    WordDiff.prototype.join = function (tokens) {
        // Tokens being joined here will always have appeared consecutively in the
        // same text, so we can simply strip off the leading whitespace from all the
        // tokens except the first (and except any whitespace-only tokens - but such
        // a token will always be the first and only token anyway) and then join them
        // and the whitespace around words and punctuation will end up correct.
        return tokens.map(function (token, i) {
            if (i == 0) {
                return token;
            }
            else {
                return token.replace((/^\s+/), '');
            }
        }).join('');
    };
    WordDiff.prototype.postProcess = function (changes, options) {
        if (!changes || options.oneChangePerToken) {
            return changes;
        }
        var lastKeep = null;
        // Change objects representing any insertion or deletion since the last
        // "keep" change object. There can be at most one of each.
        var insertion = null;
        var deletion = null;
        changes.forEach(function (change) {
            if (change.added) {
                insertion = change;
            }
            else if (change.removed) {
                deletion = change;
            }
            else {
                if (insertion || deletion) { // May be false at start of text
                    dedupeWhitespaceInChangeObjects(lastKeep, deletion, insertion, change);
                }
                lastKeep = change;
                insertion = null;
                deletion = null;
            }
        });
        if (insertion || deletion) {
            dedupeWhitespaceInChangeObjects(lastKeep, deletion, insertion, null);
        }
        return changes;
    };
    return WordDiff;
}(base_js_1.default));
exports.wordDiff = new WordDiff();
function diffWords(oldStr, newStr, options) {
    // This option has never been documented and never will be (it's clearer to
    // just call `diffWordsWithSpace` directly if you need that behavior), but
    // has existed in jsdiff for a long time, so we retain support for it here
    // for the sake of backwards compatibility.
    if ((options === null || options === void 0 ? void 0 : options.ignoreWhitespace) != null && !options.ignoreWhitespace) {
        return diffWordsWithSpace(oldStr, newStr, options);
    }
    return exports.wordDiff.diff(oldStr, newStr, options);
}
function dedupeWhitespaceInChangeObjects(startKeep, deletion, insertion, endKeep) {
    // Before returning, we tidy up the leading and trailing whitespace of the
    // change objects to eliminate cases where trailing whitespace in one object
    // is repeated as leading whitespace in the next.
    // Below are examples of the outcomes we want here to explain the code.
    // I=insert, K=keep, D=delete
    // 1. diffing 'foo bar baz' vs 'foo baz'
    //    Prior to cleanup, we have K:'foo ' D:' bar ' K:' baz'
    //    After cleanup, we want:   K:'foo ' D:'bar ' K:'baz'
    //
    // 2. Diffing 'foo bar baz' vs 'foo qux baz'
    //    Prior to cleanup, we have K:'foo ' D:' bar ' I:' qux ' K:' baz'
    //    After cleanup, we want K:'foo ' D:'bar' I:'qux' K:' baz'
    //
    // 3. Diffing 'foo\nbar baz' vs 'foo baz'
    //    Prior to cleanup, we have K:'foo ' D:'\nbar ' K:' baz'
    //    After cleanup, we want K'foo' D:'\nbar' K:' baz'
    //
    // 4. Diffing 'foo baz' vs 'foo\nbar baz'
    //    Prior to cleanup, we have K:'foo\n' I:'\nbar ' K:' baz'
    //    After cleanup, we ideally want K'foo' I:'\nbar' K:' baz'
    //    but don't actually manage this currently (the pre-cleanup change
    //    objects don't contain enough information to make it possible).
    //
    // 5. Diffing 'foo   bar baz' vs 'foo  baz'
    //    Prior to cleanup, we have K:'foo  ' D:'   bar ' K:'  baz'
    //    After cleanup, we want K:'foo  ' D:' bar ' K:'baz'
    //
    // Our handling is unavoidably imperfect in the case where there's a single
    // indel between keeps and the whitespace has changed. For instance, consider
    // diffing 'foo\tbar\nbaz' vs 'foo baz'. Unless we create an extra change
    // object to represent the insertion of the space character (which isn't even
    // a token), we have no way to avoid losing information about the texts'
    // original whitespace in the result we return. Still, we do our best to
    // output something that will look sensible if we e.g. print it with
    // insertions in green and deletions in red.
    // Between two "keep" change objects (or before the first or after the last
    // change object), we can have either:
    // * A "delete" followed by an "insert"
    // * Just an "insert"
    // * Just a "delete"
    // We handle the three cases separately.
    if (deletion && insertion) {
        var oldWsPrefix = (0, string_js_1.leadingWs)(deletion.value);
        var oldWsSuffix = (0, string_js_1.trailingWs)(deletion.value);
        var newWsPrefix = (0, string_js_1.leadingWs)(insertion.value);
        var newWsSuffix = (0, string_js_1.trailingWs)(insertion.value);
        if (startKeep) {
            var commonWsPrefix = (0, string_js_1.longestCommonPrefix)(oldWsPrefix, newWsPrefix);
            startKeep.value = (0, string_js_1.replaceSuffix)(startKeep.value, newWsPrefix, commonWsPrefix);
            deletion.value = (0, string_js_1.removePrefix)(deletion.value, commonWsPrefix);
            insertion.value = (0, string_js_1.removePrefix)(insertion.value, commonWsPrefix);
        }
        if (endKeep) {
            var commonWsSuffix = (0, string_js_1.longestCommonSuffix)(oldWsSuffix, newWsSuffix);
            endKeep.value = (0, string_js_1.replacePrefix)(endKeep.value, newWsSuffix, commonWsSuffix);
            deletion.value = (0, string_js_1.removeSuffix)(deletion.value, commonWsSuffix);
            insertion.value = (0, string_js_1.removeSuffix)(insertion.value, commonWsSuffix);
        }
    }
    else if (insertion) {
        // The whitespaces all reflect what was in the new text rather than
        // the old, so we essentially have no information about whitespace
        // insertion or deletion. We just want to dedupe the whitespace.
        // We do that by having each change object keep its trailing
        // whitespace and deleting duplicate leading whitespace where
        // present.
        if (startKeep) {
            var ws = (0, string_js_1.leadingWs)(insertion.value);
            insertion.value = insertion.value.substring(ws.length);
        }
        if (endKeep) {
            var ws = (0, string_js_1.leadingWs)(endKeep.value);
            endKeep.value = endKeep.value.substring(ws.length);
        }
        // otherwise we've got a deletion and no insertion
    }
    else if (startKeep && endKeep) {
        var newWsFull = (0, string_js_1.leadingWs)(endKeep.value), delWsStart = (0, string_js_1.leadingWs)(deletion.value), delWsEnd = (0, string_js_1.trailingWs)(deletion.value);
        // Any whitespace that comes straight after startKeep in both the old and
        // new texts, assign to startKeep and remove from the deletion.
        var newWsStart = (0, string_js_1.longestCommonPrefix)(newWsFull, delWsStart);
        deletion.value = (0, string_js_1.removePrefix)(deletion.value, newWsStart);
        // Any whitespace that comes straight before endKeep in both the old and
        // new texts, and hasn't already been assigned to startKeep, assign to
        // endKeep and remove from the deletion.
        var newWsEnd = (0, string_js_1.longestCommonSuffix)((0, string_js_1.removePrefix)(newWsFull, newWsStart), delWsEnd);
        deletion.value = (0, string_js_1.removeSuffix)(deletion.value, newWsEnd);
        endKeep.value = (0, string_js_1.replacePrefix)(endKeep.value, newWsFull, newWsEnd);
        // If there's any whitespace from the new text that HASN'T already been
        // assigned, assign it to the start:
        startKeep.value = (0, string_js_1.replaceSuffix)(startKeep.value, newWsFull, newWsFull.slice(0, newWsFull.length - newWsEnd.length));
    }
    else if (endKeep) {
        // We are at the start of the text. Preserve all the whitespace on
        // endKeep, and just remove whitespace from the end of deletion to the
        // extent that it overlaps with the start of endKeep.
        var endKeepWsPrefix = (0, string_js_1.leadingWs)(endKeep.value);
        var deletionWsSuffix = (0, string_js_1.trailingWs)(deletion.value);
        var overlap = (0, string_js_1.maximumOverlap)(deletionWsSuffix, endKeepWsPrefix);
        deletion.value = (0, string_js_1.removeSuffix)(deletion.value, overlap);
    }
    else if (startKeep) {
        // We are at the END of the text. Preserve all the whitespace on
        // startKeep, and just remove whitespace from the start of deletion to
        // the extent that it overlaps with the end of startKeep.
        var startKeepWsSuffix = (0, string_js_1.trailingWs)(startKeep.value);
        var deletionWsPrefix = (0, string_js_1.leadingWs)(deletion.value);
        var overlap = (0, string_js_1.maximumOverlap)(startKeepWsSuffix, deletionWsPrefix);
        deletion.value = (0, string_js_1.removePrefix)(deletion.value, overlap);
    }
}
var WordsWithSpaceDiff = /** @class */ (function (_super) {
    __extends(WordsWithSpaceDiff, _super);
    function WordsWithSpaceDiff() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    WordsWithSpaceDiff.prototype.tokenize = function (value) {
        // Slightly different to the tokenizeIncludingWhitespace regex used above in
        // that this one treats each individual newline as a distinct token, rather
        // than merging them into other surrounding whitespace. This was requested
        // in https://github.com/kpdecker/jsdiff/issues/180 &
        //    https://github.com/kpdecker/jsdiff/issues/211
        var regex = new RegExp("(\\r?\\n)|[".concat(extendedWordChars, "]+|[^\\S\\n\\r]+|[^").concat(extendedWordChars, "]"), 'ug');
        return value.match(regex) || [];
    };
    return WordsWithSpaceDiff;
}(base_js_1.default));
exports.wordsWithSpaceDiff = new WordsWithSpaceDiff();
function diffWordsWithSpace(oldStr, newStr, options) {
    return exports.wordsWithSpaceDiff.diff(oldStr, newStr, options);
}


/***/ }),
/* 11 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.longestCommonPrefix = longestCommonPrefix;
exports.longestCommonSuffix = longestCommonSuffix;
exports.replacePrefix = replacePrefix;
exports.replaceSuffix = replaceSuffix;
exports.removePrefix = removePrefix;
exports.removeSuffix = removeSuffix;
exports.maximumOverlap = maximumOverlap;
exports.hasOnlyWinLineEndings = hasOnlyWinLineEndings;
exports.hasOnlyUnixLineEndings = hasOnlyUnixLineEndings;
exports.trailingWs = trailingWs;
exports.leadingWs = leadingWs;
function longestCommonPrefix(str1, str2) {
    var i;
    for (i = 0; i < str1.length && i < str2.length; i++) {
        if (str1[i] != str2[i]) {
            return str1.slice(0, i);
        }
    }
    return str1.slice(0, i);
}
function longestCommonSuffix(str1, str2) {
    var i;
    // Unlike longestCommonPrefix, we need a special case to handle all scenarios
    // where we return the empty string since str1.slice(-0) will return the
    // entire string.
    if (!str1 || !str2 || str1[str1.length - 1] != str2[str2.length - 1]) {
        return '';
    }
    for (i = 0; i < str1.length && i < str2.length; i++) {
        if (str1[str1.length - (i + 1)] != str2[str2.length - (i + 1)]) {
            return str1.slice(-i);
        }
    }
    return str1.slice(-i);
}
function replacePrefix(string, oldPrefix, newPrefix) {
    if (string.slice(0, oldPrefix.length) != oldPrefix) {
        throw Error("string ".concat(JSON.stringify(string), " doesn't start with prefix ").concat(JSON.stringify(oldPrefix), "; this is a bug"));
    }
    return newPrefix + string.slice(oldPrefix.length);
}
function replaceSuffix(string, oldSuffix, newSuffix) {
    if (!oldSuffix) {
        return string + newSuffix;
    }
    if (string.slice(-oldSuffix.length) != oldSuffix) {
        throw Error("string ".concat(JSON.stringify(string), " doesn't end with suffix ").concat(JSON.stringify(oldSuffix), "; this is a bug"));
    }
    return string.slice(0, -oldSuffix.length) + newSuffix;
}
function removePrefix(string, oldPrefix) {
    return replacePrefix(string, oldPrefix, '');
}
function removeSuffix(string, oldSuffix) {
    return replaceSuffix(string, oldSuffix, '');
}
function maximumOverlap(string1, string2) {
    return string2.slice(0, overlapCount(string1, string2));
}
// Nicked from https://stackoverflow.com/a/60422853/1709587
function overlapCount(a, b) {
    // Deal with cases where the strings differ in length
    var startA = 0;
    if (a.length > b.length) {
        startA = a.length - b.length;
    }
    var endB = b.length;
    if (a.length < b.length) {
        endB = a.length;
    }
    // Create a back-reference for each index
    //   that should be followed in case of a mismatch.
    //   We only need B to make these references:
    var map = Array(endB);
    var k = 0; // Index that lags behind j
    map[0] = 0;
    for (var j = 1; j < endB; j++) {
        if (b[j] == b[k]) {
            map[j] = map[k]; // skip over the same character (optional optimisation)
        }
        else {
            map[j] = k;
        }
        while (k > 0 && b[j] != b[k]) {
            k = map[k];
        }
        if (b[j] == b[k]) {
            k++;
        }
    }
    // Phase 2: use these references while iterating over A
    k = 0;
    for (var i = startA; i < a.length; i++) {
        while (k > 0 && a[i] != b[k]) {
            k = map[k];
        }
        if (a[i] == b[k]) {
            k++;
        }
    }
    return k;
}
/**
 * Returns true if the string consistently uses Windows line endings.
 */
function hasOnlyWinLineEndings(string) {
    return string.includes('\r\n') && !string.startsWith('\n') && !string.match(/[^\r]\n/);
}
/**
 * Returns true if the string consistently uses Unix line endings.
 */
function hasOnlyUnixLineEndings(string) {
    return !string.includes('\r\n') && string.includes('\n');
}
function trailingWs(string) {
    // Yes, this looks overcomplicated and dumb - why not replace the whole function with
    //     return string.match(/\s*$/)[0]
    // you ask? Because:
    // 1. the trap described at https://markamery.com/blog/quadratic-time-regexes/ would mean doing
    //    this would cause this function to take O(n²) time in the worst case (specifically when
    //    there is a massive run of NON-TRAILING whitespace in `string`), and
    // 2. the fix proposed in the same blog post, of using a negative lookbehind, is incompatible
    //    with old Safari versions that we'd like to not break if possible (see
    //    https://github.com/kpdecker/jsdiff/pull/550)
    // It feels absurd to do this with an explicit loop instead of a regex, but I really can't see a
    // better way that doesn't result in broken behaviour.
    var i;
    for (i = string.length - 1; i >= 0; i--) {
        if (!string[i].match(/\s/)) {
            break;
        }
    }
    return string.substring(i + 1);
}
function leadingWs(string) {
    // Thankfully the annoying considerations described in trailingWs don't apply here:
    var match = string.match(/^\s*/);
    return match ? match[0] : '';
}


/***/ }),
/* 12 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.lineDiff = void 0;
exports.diffLines = diffLines;
exports.diffTrimmedLines = diffTrimmedLines;
exports.tokenize = tokenize;
var base_js_1 = __webpack_require__(8);
var params_js_1 = __webpack_require__(13);
var LineDiff = /** @class */ (function (_super) {
    __extends(LineDiff, _super);
    function LineDiff() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.tokenize = tokenize;
        return _this;
    }
    LineDiff.prototype.equals = function (left, right, options) {
        // If we're ignoring whitespace, we need to normalise lines by stripping
        // whitespace before checking equality. (This has an annoying interaction
        // with newlineIsToken that requires special handling: if newlines get their
        // own token, then we DON'T want to trim the *newline* tokens down to empty
        // strings, since this would cause us to treat whitespace-only line content
        // as equal to a separator between lines, which would be weird and
        // inconsistent with the documented behavior of the options.)
        if (options.ignoreWhitespace) {
            if (!options.newlineIsToken || !left.includes('\n')) {
                left = left.trim();
            }
            if (!options.newlineIsToken || !right.includes('\n')) {
                right = right.trim();
            }
        }
        else if (options.ignoreNewlineAtEof && !options.newlineIsToken) {
            if (left.endsWith('\n')) {
                left = left.slice(0, -1);
            }
            if (right.endsWith('\n')) {
                right = right.slice(0, -1);
            }
        }
        return _super.prototype.equals.call(this, left, right, options);
    };
    return LineDiff;
}(base_js_1.default));
exports.lineDiff = new LineDiff();
function diffLines(oldStr, newStr, options) {
    return exports.lineDiff.diff(oldStr, newStr, options);
}
function diffTrimmedLines(oldStr, newStr, options) {
    options = (0, params_js_1.generateOptions)(options, { ignoreWhitespace: true });
    return exports.lineDiff.diff(oldStr, newStr, options);
}
// Exported standalone so it can be used from jsonDiff too.
function tokenize(value, options) {
    if (options.stripTrailingCr) {
        // remove one \r before \n to match GNU diff's --strip-trailing-cr behavior
        value = value.replace(/\r\n/g, '\n');
    }
    var retLines = [], linesAndNewlines = value.split(/(\n|\r\n)/);
    // Ignore the final empty token that occurs if the string ends with a new line
    if (!linesAndNewlines[linesAndNewlines.length - 1]) {
        linesAndNewlines.pop();
    }
    // Merge the content and line separators into single tokens
    for (var i = 0; i < linesAndNewlines.length; i++) {
        var line = linesAndNewlines[i];
        if (i % 2 && !options.newlineIsToken) {
            retLines[retLines.length - 1] += line;
        }
        else {
            retLines.push(line);
        }
    }
    return retLines;
}


/***/ }),
/* 13 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.generateOptions = generateOptions;
function generateOptions(options, defaults) {
    if (typeof options === 'function') {
        defaults.callback = options;
    }
    else if (options) {
        for (var name in options) {
            /* istanbul ignore else */
            if (Object.prototype.hasOwnProperty.call(options, name)) {
                defaults[name] = options[name];
            }
        }
    }
    return defaults;
}


/***/ }),
/* 14 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.sentenceDiff = void 0;
exports.diffSentences = diffSentences;
var base_js_1 = __webpack_require__(8);
function isSentenceEndPunct(char) {
    return char == '.' || char == '!' || char == '?';
}
var SentenceDiff = /** @class */ (function (_super) {
    __extends(SentenceDiff, _super);
    function SentenceDiff() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SentenceDiff.prototype.tokenize = function (value) {
        var _a;
        // If in future we drop support for environments that don't support lookbehinds, we can replace
        // this entire function with:
        //     return value.split(/(?<=[.!?])(\s+|$)/);
        // but until then, for similar reasons to the trailingWs function in string.ts, we are forced
        // to do this verbosely "by hand" instead of using a regex.
        var result = [];
        var tokenStartI = 0;
        for (var i = 0; i < value.length; i++) {
            if (i == value.length - 1) {
                result.push(value.slice(tokenStartI));
                break;
            }
            if (isSentenceEndPunct(value[i]) && value[i + 1].match(/\s/)) {
                // We've hit a sentence break - i.e. a punctuation mark followed by whitespace.
                // We now want to push TWO tokens to the result:
                // 1. the sentence
                result.push(value.slice(tokenStartI, i + 1));
                // 2. the whitespace
                i = tokenStartI = i + 1;
                while ((_a = value[i + 1]) === null || _a === void 0 ? void 0 : _a.match(/\s/)) {
                    i++;
                }
                result.push(value.slice(tokenStartI, i + 1));
                // Then the next token (a sentence) starts on the character after the whitespace.
                // (It's okay if this is off the end of the string - then the outer loop will terminate
                // here anyway.)
                tokenStartI = i + 1;
            }
        }
        return result;
    };
    return SentenceDiff;
}(base_js_1.default));
exports.sentenceDiff = new SentenceDiff();
function diffSentences(oldStr, newStr, options) {
    return exports.sentenceDiff.diff(oldStr, newStr, options);
}


/***/ }),
/* 15 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.cssDiff = void 0;
exports.diffCss = diffCss;
var base_js_1 = __webpack_require__(8);
var CssDiff = /** @class */ (function (_super) {
    __extends(CssDiff, _super);
    function CssDiff() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CssDiff.prototype.tokenize = function (value) {
        return value.split(/([{}:;,]|\s+)/);
    };
    return CssDiff;
}(base_js_1.default));
exports.cssDiff = new CssDiff();
function diffCss(oldStr, newStr, options) {
    return exports.cssDiff.diff(oldStr, newStr, options);
}


/***/ }),
/* 16 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.jsonDiff = void 0;
exports.diffJson = diffJson;
exports.canonicalize = canonicalize;
var base_js_1 = __webpack_require__(8);
var line_js_1 = __webpack_require__(12);
var JsonDiff = /** @class */ (function (_super) {
    __extends(JsonDiff, _super);
    function JsonDiff() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.tokenize = line_js_1.tokenize;
        return _this;
    }
    Object.defineProperty(JsonDiff.prototype, "useLongestToken", {
        get: function () {
            // Discriminate between two lines of pretty-printed, serialized JSON where one of them has a
            // dangling comma and the other doesn't. Turns out including the dangling comma yields the nicest output:
            return true;
        },
        enumerable: false,
        configurable: true
    });
    JsonDiff.prototype.castInput = function (value, options) {
        var undefinedReplacement = options.undefinedReplacement, _a = options.stringifyReplacer, stringifyReplacer = _a === void 0 ? function (k, v) { return typeof v === 'undefined' ? undefinedReplacement : v; } : _a;
        return typeof value === 'string' ? value : JSON.stringify(canonicalize(value, null, null, stringifyReplacer), null, '  ');
    };
    JsonDiff.prototype.equals = function (left, right, options) {
        return _super.prototype.equals.call(this, left.replace(/,([\r\n])/g, '$1'), right.replace(/,([\r\n])/g, '$1'), options);
    };
    return JsonDiff;
}(base_js_1.default));
exports.jsonDiff = new JsonDiff();
function diffJson(oldStr, newStr, options) {
    return exports.jsonDiff.diff(oldStr, newStr, options);
}
// This function handles the presence of circular references by bailing out when encountering an
// object that is already on the "stack" of items being processed. Accepts an optional replacer
function canonicalize(obj, stack, replacementStack, replacer, key) {
    stack = stack || [];
    replacementStack = replacementStack || [];
    if (replacer) {
        obj = replacer(key === undefined ? '' : key, obj);
    }
    var i;
    for (i = 0; i < stack.length; i += 1) {
        if (stack[i] === obj) {
            return replacementStack[i];
        }
    }
    var canonicalizedObj;
    if ('[object Array]' === Object.prototype.toString.call(obj)) {
        stack.push(obj);
        canonicalizedObj = new Array(obj.length);
        replacementStack.push(canonicalizedObj);
        for (i = 0; i < obj.length; i += 1) {
            canonicalizedObj[i] = canonicalize(obj[i], stack, replacementStack, replacer, String(i));
        }
        stack.pop();
        replacementStack.pop();
        return canonicalizedObj;
    }
    if (obj && obj.toJSON) {
        obj = obj.toJSON();
    }
    if (typeof obj === 'object' && obj !== null) {
        stack.push(obj);
        canonicalizedObj = {};
        replacementStack.push(canonicalizedObj);
        var sortedKeys = [];
        var key_1;
        for (key_1 in obj) {
            /* istanbul ignore else */
            if (Object.prototype.hasOwnProperty.call(obj, key_1)) {
                sortedKeys.push(key_1);
            }
        }
        sortedKeys.sort();
        for (i = 0; i < sortedKeys.length; i += 1) {
            key_1 = sortedKeys[i];
            canonicalizedObj[key_1] = canonicalize(obj[key_1], stack, replacementStack, replacer, key_1);
        }
        stack.pop();
        replacementStack.pop();
    }
    else {
        canonicalizedObj = obj;
    }
    return canonicalizedObj;
}


/***/ }),
/* 17 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.arrayDiff = void 0;
exports.diffArrays = diffArrays;
var base_js_1 = __webpack_require__(8);
var ArrayDiff = /** @class */ (function (_super) {
    __extends(ArrayDiff, _super);
    function ArrayDiff() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ArrayDiff.prototype.tokenize = function (value) {
        return value.slice();
    };
    ArrayDiff.prototype.join = function (value) {
        return value;
    };
    ArrayDiff.prototype.removeEmpty = function (value) {
        return value;
    };
    return ArrayDiff;
}(base_js_1.default));
exports.arrayDiff = new ArrayDiff();
function diffArrays(oldArr, newArr, options) {
    return exports.arrayDiff.diff(oldArr, newArr, options);
}


/***/ }),
/* 18 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.applyPatch = applyPatch;
exports.applyPatches = applyPatches;
var string_js_1 = __webpack_require__(11);
var line_endings_js_1 = __webpack_require__(19);
var parse_js_1 = __webpack_require__(20);
var distance_iterator_js_1 = __webpack_require__(21);
/**
 * attempts to apply a unified diff patch.
 *
 * Hunks are applied first to last.
 * `applyPatch` first tries to apply the first hunk at the line number specified in the hunk header, and with all context lines matching exactly.
 * If that fails, it tries scanning backwards and forwards, one line at a time, to find a place to apply the hunk where the context lines match exactly.
 * If that still fails, and `fuzzFactor` is greater than zero, it increments the maximum number of mismatches (missing, extra, or changed context lines) that there can be between the hunk context and a region where we are trying to apply the patch such that the hunk will still be considered to match.
 * Regardless of `fuzzFactor`, lines to be deleted in the hunk *must* be present for a hunk to match, and the context lines *immediately* before and after an insertion must match exactly.
 *
 * Once a hunk is successfully fitted, the process begins again with the next hunk.
 * Regardless of `fuzzFactor`, later hunks must be applied later in the file than earlier hunks.
 *
 * If a hunk cannot be successfully fitted *anywhere* with fewer than `fuzzFactor` mismatches, `applyPatch` fails and returns `false`.
 *
 * If a hunk is successfully fitted but not at the line number specified by the hunk header, all subsequent hunks have their target line number adjusted accordingly.
 * (e.g. if the first hunk is applied 10 lines below where the hunk header said it should fit, `applyPatch` will *start* looking for somewhere to apply the second hunk 10 lines below where its hunk header says it goes.)
 *
 * If the patch was applied successfully, returns a string containing the patched text.
 * If the patch could not be applied (because some hunks in the patch couldn't be fitted to the text in `source`), `applyPatch` returns false.
 *
 * @param patch a string diff or the output from the `parsePatch` or `structuredPatch` methods.
 */
function applyPatch(source, patch, options) {
    if (options === void 0) { options = {}; }
    var patches;
    if (typeof patch === 'string') {
        patches = (0, parse_js_1.parsePatch)(patch);
    }
    else if (Array.isArray(patch)) {
        patches = patch;
    }
    else {
        patches = [patch];
    }
    if (patches.length > 1) {
        throw new Error('applyPatch only works with a single input.');
    }
    return applyStructuredPatch(source, patches[0], options);
}
function applyStructuredPatch(source, patch, options) {
    if (options === void 0) { options = {}; }
    if (options.autoConvertLineEndings || options.autoConvertLineEndings == null) {
        if ((0, string_js_1.hasOnlyWinLineEndings)(source) && (0, line_endings_js_1.isUnix)(patch)) {
            patch = (0, line_endings_js_1.unixToWin)(patch);
        }
        else if ((0, string_js_1.hasOnlyUnixLineEndings)(source) && (0, line_endings_js_1.isWin)(patch)) {
            patch = (0, line_endings_js_1.winToUnix)(patch);
        }
    }
    // Apply the diff to the input
    var lines = source.split('\n'), hunks = patch.hunks, compareLine = options.compareLine || (function (lineNumber, line, operation, patchContent) { return line === patchContent; }), fuzzFactor = options.fuzzFactor || 0;
    var minLine = 0;
    if (fuzzFactor < 0 || !Number.isInteger(fuzzFactor)) {
        throw new Error('fuzzFactor must be a non-negative integer');
    }
    // Special case for empty patch.
    if (!hunks.length) {
        return source;
    }
    // Before anything else, handle EOFNL insertion/removal. If the patch tells us to make a change
    // to the EOFNL that is redundant/impossible - i.e. to remove a newline that's not there, or add a
    // newline that already exists - then we either return false and fail to apply the patch (if
    // fuzzFactor is 0) or simply ignore the problem and do nothing (if fuzzFactor is >0).
    // If we do need to remove/add a newline at EOF, this will always be in the final hunk:
    var prevLine = '', removeEOFNL = false, addEOFNL = false;
    for (var i = 0; i < hunks[hunks.length - 1].lines.length; i++) {
        var line = hunks[hunks.length - 1].lines[i];
        if (line[0] == '\\') {
            if (prevLine[0] == '+') {
                removeEOFNL = true;
            }
            else if (prevLine[0] == '-') {
                addEOFNL = true;
            }
        }
        prevLine = line;
    }
    if (removeEOFNL) {
        if (addEOFNL) {
            // This means the final line gets changed but doesn't have a trailing newline in either the
            // original or patched version. In that case, we do nothing if fuzzFactor > 0, and if
            // fuzzFactor is 0, we simply validate that the source file has no trailing newline.
            if (!fuzzFactor && lines[lines.length - 1] == '') {
                return false;
            }
        }
        else if (lines[lines.length - 1] == '') {
            lines.pop();
        }
        else if (!fuzzFactor) {
            return false;
        }
    }
    else if (addEOFNL) {
        if (lines[lines.length - 1] != '') {
            lines.push('');
        }
        else if (!fuzzFactor) {
            return false;
        }
    }
    /**
     * Checks if the hunk can be made to fit at the provided location with at most `maxErrors`
     * insertions, substitutions, or deletions, while ensuring also that:
     * - lines deleted in the hunk match exactly, and
     * - wherever an insertion operation or block of insertion operations appears in the hunk, the
     *   immediately preceding and following lines of context match exactly
     *
     * `toPos` should be set such that lines[toPos] is meant to match hunkLines[0].
     *
     * If the hunk can be applied, returns an object with properties `oldLineLastI` and
     * `replacementLines`. Otherwise, returns null.
     */
    function applyHunk(hunkLines, toPos, maxErrors, hunkLinesI, lastContextLineMatched, patchedLines, patchedLinesLength) {
        if (hunkLinesI === void 0) { hunkLinesI = 0; }
        if (lastContextLineMatched === void 0) { lastContextLineMatched = true; }
        if (patchedLines === void 0) { patchedLines = []; }
        if (patchedLinesLength === void 0) { patchedLinesLength = 0; }
        var nConsecutiveOldContextLines = 0;
        var nextContextLineMustMatch = false;
        for (; hunkLinesI < hunkLines.length; hunkLinesI++) {
            var hunkLine = hunkLines[hunkLinesI], operation = (hunkLine.length > 0 ? hunkLine[0] : ' '), content = (hunkLine.length > 0 ? hunkLine.substr(1) : hunkLine);
            if (operation === '-') {
                if (compareLine(toPos + 1, lines[toPos], operation, content)) {
                    toPos++;
                    nConsecutiveOldContextLines = 0;
                }
                else {
                    if (!maxErrors || lines[toPos] == null) {
                        return null;
                    }
                    patchedLines[patchedLinesLength] = lines[toPos];
                    return applyHunk(hunkLines, toPos + 1, maxErrors - 1, hunkLinesI, false, patchedLines, patchedLinesLength + 1);
                }
            }
            if (operation === '+') {
                if (!lastContextLineMatched) {
                    return null;
                }
                patchedLines[patchedLinesLength] = content;
                patchedLinesLength++;
                nConsecutiveOldContextLines = 0;
                nextContextLineMustMatch = true;
            }
            if (operation === ' ') {
                nConsecutiveOldContextLines++;
                patchedLines[patchedLinesLength] = lines[toPos];
                if (compareLine(toPos + 1, lines[toPos], operation, content)) {
                    patchedLinesLength++;
                    lastContextLineMatched = true;
                    nextContextLineMustMatch = false;
                    toPos++;
                }
                else {
                    if (nextContextLineMustMatch || !maxErrors) {
                        return null;
                    }
                    // Consider 3 possibilities in sequence:
                    // 1. lines contains a *substitution* not included in the patch context, or
                    // 2. lines contains an *insertion* not included in the patch context, or
                    // 3. lines contains a *deletion* not included in the patch context
                    // The first two options are of course only possible if the line from lines is non-null -
                    // i.e. only option 3 is possible if we've overrun the end of the old file.
                    return (lines[toPos] && (applyHunk(hunkLines, toPos + 1, maxErrors - 1, hunkLinesI + 1, false, patchedLines, patchedLinesLength + 1) || applyHunk(hunkLines, toPos + 1, maxErrors - 1, hunkLinesI, false, patchedLines, patchedLinesLength + 1)) || applyHunk(hunkLines, toPos, maxErrors - 1, hunkLinesI + 1, false, patchedLines, patchedLinesLength));
                }
            }
        }
        // Before returning, trim any unmodified context lines off the end of patchedLines and reduce
        // toPos (and thus oldLineLastI) accordingly. This allows later hunks to be applied to a region
        // that starts in this hunk's trailing context.
        patchedLinesLength -= nConsecutiveOldContextLines;
        toPos -= nConsecutiveOldContextLines;
        patchedLines.length = patchedLinesLength;
        return {
            patchedLines: patchedLines,
            oldLineLastI: toPos - 1
        };
    }
    var resultLines = [];
    // Search best fit offsets for each hunk based on the previous ones
    var prevHunkOffset = 0;
    for (var i = 0; i < hunks.length; i++) {
        var hunk = hunks[i];
        var hunkResult = void 0;
        var maxLine = lines.length - hunk.oldLines + fuzzFactor;
        var toPos = void 0;
        for (var maxErrors = 0; maxErrors <= fuzzFactor; maxErrors++) {
            toPos = hunk.oldStart + prevHunkOffset - 1;
            var iterator = (0, distance_iterator_js_1.default)(toPos, minLine, maxLine);
            for (; toPos !== undefined; toPos = iterator()) {
                hunkResult = applyHunk(hunk.lines, toPos, maxErrors);
                if (hunkResult) {
                    break;
                }
            }
            if (hunkResult) {
                break;
            }
        }
        if (!hunkResult) {
            return false;
        }
        // Copy everything from the end of where we applied the last hunk to the start of this hunk
        for (var i_1 = minLine; i_1 < toPos; i_1++) {
            resultLines.push(lines[i_1]);
        }
        // Add the lines produced by applying the hunk:
        for (var i_2 = 0; i_2 < hunkResult.patchedLines.length; i_2++) {
            var line = hunkResult.patchedLines[i_2];
            resultLines.push(line);
        }
        // Set lower text limit to end of the current hunk, so next ones don't try
        // to fit over already patched text
        minLine = hunkResult.oldLineLastI + 1;
        // Note the offset between where the patch said the hunk should've applied and where we
        // applied it, so we can adjust future hunks accordingly:
        prevHunkOffset = toPos + 1 - hunk.oldStart;
    }
    // Copy over the rest of the lines from the old text
    for (var i = minLine; i < lines.length; i++) {
        resultLines.push(lines[i]);
    }
    return resultLines.join('\n');
}
/**
 * applies one or more patches.
 *
 * `patch` may be either an array of structured patch objects, or a string representing a patch in unified diff format (which may patch one or more files).
 *
 * This method will iterate over the contents of the patch and apply to data provided through callbacks. The general flow for each patch index is:
 *
 * - `options.loadFile(index, callback)` is called. The caller should then load the contents of the file and then pass that to the `callback(err, data)` callback. Passing an `err` will terminate further patch execution.
 * - `options.patched(index, content, callback)` is called once the patch has been applied. `content` will be the return value from `applyPatch`. When it's ready, the caller should call `callback(err)` callback. Passing an `err` will terminate further patch execution.
 *
 * Once all patches have been applied or an error occurs, the `options.complete(err)` callback is made.
 */
function applyPatches(uniDiff, options) {
    var spDiff = typeof uniDiff === 'string' ? (0, parse_js_1.parsePatch)(uniDiff) : uniDiff;
    var currentIndex = 0;
    function processIndex() {
        var index = spDiff[currentIndex++];
        if (!index) {
            return options.complete();
        }
        options.loadFile(index, function (err, data) {
            if (err) {
                return options.complete(err);
            }
            var updatedContent = applyPatch(data, index, options);
            options.patched(index, updatedContent, function (err) {
                if (err) {
                    return options.complete(err);
                }
                processIndex();
            });
        });
    }
    processIndex();
}


/***/ }),
/* 19 */
/***/ (function(__unused_webpack_module, exports) {


var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.unixToWin = unixToWin;
exports.winToUnix = winToUnix;
exports.isUnix = isUnix;
exports.isWin = isWin;
function unixToWin(patch) {
    if (Array.isArray(patch)) {
        // It would be cleaner if instead of the line below we could just write
        //     return patch.map(unixToWin)
        // but mysteriously TypeScript (v5.7.3 at the time of writing) does not like this and it will
        // refuse to compile, thinking that unixToWin could then return StructuredPatch[][] and the
        // result would be incompatible with the overload signatures.
        // See bug report at https://github.com/microsoft/TypeScript/issues/61398.
        return patch.map(function (p) { return unixToWin(p); });
    }
    return __assign(__assign({}, patch), { hunks: patch.hunks.map(function (hunk) { return (__assign(__assign({}, hunk), { lines: hunk.lines.map(function (line, i) {
                var _a;
                return (line.startsWith('\\') || line.endsWith('\r') || ((_a = hunk.lines[i + 1]) === null || _a === void 0 ? void 0 : _a.startsWith('\\')))
                    ? line
                    : line + '\r';
            }) })); }) });
}
function winToUnix(patch) {
    if (Array.isArray(patch)) {
        // (See comment above equivalent line in unixToWin)
        return patch.map(function (p) { return winToUnix(p); });
    }
    return __assign(__assign({}, patch), { hunks: patch.hunks.map(function (hunk) { return (__assign(__assign({}, hunk), { lines: hunk.lines.map(function (line) { return line.endsWith('\r') ? line.substring(0, line.length - 1) : line; }) })); }) });
}
/**
 * Returns true if the patch consistently uses Unix line endings (or only involves one line and has
 * no line endings).
 */
function isUnix(patch) {
    if (!Array.isArray(patch)) {
        patch = [patch];
    }
    return !patch.some(function (index) { return index.hunks.some(function (hunk) { return hunk.lines.some(function (line) { return !line.startsWith('\\') && line.endsWith('\r'); }); }); });
}
/**
 * Returns true if the patch uses Windows line endings and only Windows line endings.
 */
function isWin(patch) {
    if (!Array.isArray(patch)) {
        patch = [patch];
    }
    return patch.some(function (index) { return index.hunks.some(function (hunk) { return hunk.lines.some(function (line) { return line.endsWith('\r'); }); }); })
        && patch.every(function (index) { return index.hunks.every(function (hunk) { return hunk.lines.every(function (line, i) { var _a; return line.startsWith('\\') || line.endsWith('\r') || ((_a = hunk.lines[i + 1]) === null || _a === void 0 ? void 0 : _a.startsWith('\\')); }); }); });
}


/***/ }),
/* 20 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.parsePatch = parsePatch;
/**
 * Parses a patch into structured data, in the same structure returned by `structuredPatch`.
 *
 * @return a JSON object representation of the a patch, suitable for use with the `applyPatch` method.
 */
function parsePatch(uniDiff) {
    var diffstr = uniDiff.split(/\n/), list = [];
    var i = 0;
    function parseIndex() {
        var index = {};
        list.push(index);
        // Parse diff metadata
        while (i < diffstr.length) {
            var line = diffstr[i];
            // File header found, end parsing diff metadata
            if ((/^(---|\+\+\+|@@)\s/).test(line)) {
                break;
            }
            // Try to parse the line as a diff header, like
            //     Index: README.md
            // or
            //     diff -r 9117c6561b0b -r 273ce12ad8f1 .hgignore
            // or
            //     Index: something with multiple words
            // and extract the filename (or whatever else is used as an index name)
            // from the end (i.e. 'README.md', '.hgignore', or
            // 'something with multiple words' in the examples above).
            //
            // TODO: It seems awkward that we indiscriminately trim off trailing
            //       whitespace here. Theoretically, couldn't that be meaningful -
            //       e.g. if the patch represents a diff of a file whose name ends
            //       with a space? Seems wrong to nuke it.
            //       But this behaviour has been around since v2.2.1 in 2015, so if
            //       it's going to change, it should be done cautiously and in a new
            //       major release, for backwards-compat reasons.
            //       -- ExplodingCabbage
            var headerMatch = (/^(?:Index:|diff(?: -r \w+)+)\s+/).exec(line);
            if (headerMatch) {
                index.index = line.substring(headerMatch[0].length).trim();
            }
            i++;
        }
        // Parse file headers if they are defined. Unified diff requires them, but
        // there's no technical issues to have an isolated hunk without file header
        parseFileHeader(index);
        parseFileHeader(index);
        // Parse hunks
        index.hunks = [];
        while (i < diffstr.length) {
            var line = diffstr[i];
            if ((/^(Index:\s|diff\s|---\s|\+\+\+\s|===================================================================)/).test(line)) {
                break;
            }
            else if ((/^@@/).test(line)) {
                index.hunks.push(parseHunk());
            }
            else if (line) {
                throw new Error('Unknown line ' + (i + 1) + ' ' + JSON.stringify(line));
            }
            else {
                i++;
            }
        }
    }
    // Parses the --- and +++ headers, if none are found, no lines
    // are consumed.
    function parseFileHeader(index) {
        var fileHeaderMatch = (/^(---|\+\+\+)\s+/).exec(diffstr[i]);
        if (fileHeaderMatch) {
            var prefix = fileHeaderMatch[1], data = diffstr[i].substring(3).trim().split('\t', 2), header = (data[1] || '').trim();
            var fileName = data[0].replace(/\\\\/g, '\\');
            if (fileName.startsWith('"') && fileName.endsWith('"')) {
                fileName = fileName.substr(1, fileName.length - 2);
            }
            if (prefix === '---') {
                index.oldFileName = fileName;
                index.oldHeader = header;
            }
            else {
                index.newFileName = fileName;
                index.newHeader = header;
            }
            i++;
        }
    }
    // Parses a hunk
    // This assumes that we are at the start of a hunk.
    function parseHunk() {
        var _a;
        var chunkHeaderIndex = i, chunkHeaderLine = diffstr[i++], chunkHeader = chunkHeaderLine.split(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        var hunk = {
            oldStart: +chunkHeader[1],
            oldLines: typeof chunkHeader[2] === 'undefined' ? 1 : +chunkHeader[2],
            newStart: +chunkHeader[3],
            newLines: typeof chunkHeader[4] === 'undefined' ? 1 : +chunkHeader[4],
            lines: []
        };
        // Unified Diff Format quirk: If the chunk size is 0,
        // the first number is one lower than one would expect.
        // https://www.artima.com/weblogs/viewpost.jsp?thread=164293
        if (hunk.oldLines === 0) {
            hunk.oldStart += 1;
        }
        if (hunk.newLines === 0) {
            hunk.newStart += 1;
        }
        var addCount = 0, removeCount = 0;
        for (; i < diffstr.length && (removeCount < hunk.oldLines || addCount < hunk.newLines || ((_a = diffstr[i]) === null || _a === void 0 ? void 0 : _a.startsWith('\\'))); i++) {
            var operation = (diffstr[i].length == 0 && i != (diffstr.length - 1)) ? ' ' : diffstr[i][0];
            if (operation === '+' || operation === '-' || operation === ' ' || operation === '\\') {
                hunk.lines.push(diffstr[i]);
                if (operation === '+') {
                    addCount++;
                }
                else if (operation === '-') {
                    removeCount++;
                }
                else if (operation === ' ') {
                    addCount++;
                    removeCount++;
                }
            }
            else {
                throw new Error("Hunk at line ".concat(chunkHeaderIndex + 1, " contained invalid line ").concat(diffstr[i]));
            }
        }
        // Handle the empty block count case
        if (!addCount && hunk.newLines === 1) {
            hunk.newLines = 0;
        }
        if (!removeCount && hunk.oldLines === 1) {
            hunk.oldLines = 0;
        }
        // Perform sanity checking
        if (addCount !== hunk.newLines) {
            throw new Error('Added line count did not match for hunk at line ' + (chunkHeaderIndex + 1));
        }
        if (removeCount !== hunk.oldLines) {
            throw new Error('Removed line count did not match for hunk at line ' + (chunkHeaderIndex + 1));
        }
        return hunk;
    }
    while (i < diffstr.length) {
        parseIndex();
    }
    return list;
}


/***/ }),
/* 21 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports["default"] = default_1;
// Iterator that traverses in the range of [min, max], stepping
// by distance from a given start position. I.e. for [0, 4], with
// start of 2, this will iterate 2, 3, 1, 4, 0.
function default_1(start, minLine, maxLine) {
    var wantForward = true, backwardExhausted = false, forwardExhausted = false, localOffset = 1;
    return function iterator() {
        if (wantForward && !forwardExhausted) {
            if (backwardExhausted) {
                localOffset++;
            }
            else {
                wantForward = false;
            }
            // Check if trying to fit beyond text length, and if not, check it fits
            // after offset location (or desired location on first iteration)
            if (start + localOffset <= maxLine) {
                return start + localOffset;
            }
            forwardExhausted = true;
        }
        if (!backwardExhausted) {
            if (!forwardExhausted) {
                wantForward = true;
            }
            // Check if trying to fit before text beginning, and if not, check it fits
            // before offset location
            if (minLine <= start - localOffset) {
                return start - localOffset++;
            }
            backwardExhausted = true;
            return iterator();
        }
        // We tried to fit hunk before text beginning and beyond text length, then
        // hunk can't fit on the text. Return undefined
        return undefined;
    };
}


/***/ }),
/* 22 */
/***/ (function(__unused_webpack_module, exports) {


var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.reversePatch = reversePatch;
function reversePatch(structuredPatch) {
    if (Array.isArray(structuredPatch)) {
        // (See comment in unixToWin for why we need the pointless-looking anonymous function here)
        return structuredPatch.map(function (patch) { return reversePatch(patch); }).reverse();
    }
    return __assign(__assign({}, structuredPatch), { oldFileName: structuredPatch.newFileName, oldHeader: structuredPatch.newHeader, newFileName: structuredPatch.oldFileName, newHeader: structuredPatch.oldHeader, hunks: structuredPatch.hunks.map(function (hunk) {
            return {
                oldLines: hunk.newLines,
                oldStart: hunk.newStart,
                newLines: hunk.oldLines,
                newStart: hunk.oldStart,
                lines: hunk.lines.map(function (l) {
                    if (l.startsWith('-')) {
                        return "+".concat(l.slice(1));
                    }
                    if (l.startsWith('+')) {
                        return "-".concat(l.slice(1));
                    }
                    return l;
                })
            };
        }) });
}


/***/ }),
/* 23 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.OMIT_HEADERS = exports.FILE_HEADERS_ONLY = exports.INCLUDE_HEADERS = void 0;
exports.structuredPatch = structuredPatch;
exports.formatPatch = formatPatch;
exports.createTwoFilesPatch = createTwoFilesPatch;
exports.createPatch = createPatch;
var line_js_1 = __webpack_require__(12);
exports.INCLUDE_HEADERS = {
    includeIndex: true,
    includeUnderline: true,
    includeFileHeaders: true
};
exports.FILE_HEADERS_ONLY = {
    includeIndex: false,
    includeUnderline: false,
    includeFileHeaders: true
};
exports.OMIT_HEADERS = {
    includeIndex: false,
    includeUnderline: false,
    includeFileHeaders: false
};
function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
    var optionsObj;
    if (!options) {
        optionsObj = {};
    }
    else if (typeof options === 'function') {
        optionsObj = { callback: options };
    }
    else {
        optionsObj = options;
    }
    if (typeof optionsObj.context === 'undefined') {
        optionsObj.context = 4;
    }
    // We copy this into its own variable to placate TypeScript, which thinks
    // optionsObj.context might be undefined in the callbacks below.
    var context = optionsObj.context;
    // @ts-expect-error (runtime check for something that is correctly a static type error)
    if (optionsObj.newlineIsToken) {
        throw new Error('newlineIsToken may not be used with patch-generation functions, only with diffing functions');
    }
    if (!optionsObj.callback) {
        return diffLinesResultToPatch((0, line_js_1.diffLines)(oldStr, newStr, optionsObj));
    }
    else {
        var callback_1 = optionsObj.callback;
        (0, line_js_1.diffLines)(oldStr, newStr, __assign(__assign({}, optionsObj), { callback: function (diff) {
                var patch = diffLinesResultToPatch(diff);
                // TypeScript is unhappy without the cast because it does not understand that `patch` may
                // be undefined here only if `callback` is StructuredPatchCallbackAbortable:
                callback_1(patch);
            } }));
    }
    function diffLinesResultToPatch(diff) {
        // STEP 1: Build up the patch with no "\ No newline at end of file" lines and with the arrays
        //         of lines containing trailing newline characters. We'll tidy up later...
        if (!diff) {
            return;
        }
        diff.push({ value: '', lines: [] }); // Append an empty value to make cleanup easier
        function contextLines(lines) {
            return lines.map(function (entry) { return ' ' + entry; });
        }
        var hunks = [];
        var oldRangeStart = 0, newRangeStart = 0, curRange = [], oldLine = 1, newLine = 1;
        for (var i = 0; i < diff.length; i++) {
            var current = diff[i], lines = current.lines || splitLines(current.value);
            current.lines = lines;
            if (current.added || current.removed) {
                // If we have previous context, start with that
                if (!oldRangeStart) {
                    var prev = diff[i - 1];
                    oldRangeStart = oldLine;
                    newRangeStart = newLine;
                    if (prev) {
                        curRange = context > 0 ? contextLines(prev.lines.slice(-context)) : [];
                        oldRangeStart -= curRange.length;
                        newRangeStart -= curRange.length;
                    }
                }
                // Output our changes
                for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                    var line = lines_1[_i];
                    curRange.push((current.added ? '+' : '-') + line);
                }
                // Track the updated file position
                if (current.added) {
                    newLine += lines.length;
                }
                else {
                    oldLine += lines.length;
                }
            }
            else {
                // Identical context lines. Track line changes
                if (oldRangeStart) {
                    // Close out any changes that have been output (or join overlapping)
                    if (lines.length <= context * 2 && i < diff.length - 2) {
                        // Overlapping
                        for (var _a = 0, _b = contextLines(lines); _a < _b.length; _a++) {
                            var line = _b[_a];
                            curRange.push(line);
                        }
                    }
                    else {
                        // end the range and output
                        var contextSize = Math.min(lines.length, context);
                        for (var _c = 0, _d = contextLines(lines.slice(0, contextSize)); _c < _d.length; _c++) {
                            var line = _d[_c];
                            curRange.push(line);
                        }
                        var hunk = {
                            oldStart: oldRangeStart,
                            oldLines: (oldLine - oldRangeStart + contextSize),
                            newStart: newRangeStart,
                            newLines: (newLine - newRangeStart + contextSize),
                            lines: curRange
                        };
                        hunks.push(hunk);
                        oldRangeStart = 0;
                        newRangeStart = 0;
                        curRange = [];
                    }
                }
                oldLine += lines.length;
                newLine += lines.length;
            }
        }
        // Step 2: eliminate the trailing `\n` from each line of each hunk, and, where needed, add
        //         "\ No newline at end of file".
        for (var _e = 0, hunks_1 = hunks; _e < hunks_1.length; _e++) {
            var hunk = hunks_1[_e];
            for (var i = 0; i < hunk.lines.length; i++) {
                if (hunk.lines[i].endsWith('\n')) {
                    hunk.lines[i] = hunk.lines[i].slice(0, -1);
                }
                else {
                    hunk.lines.splice(i + 1, 0, '\\ No newline at end of file');
                    i++; // Skip the line we just added, then continue iterating
                }
            }
        }
        return {
            oldFileName: oldFileName, newFileName: newFileName,
            oldHeader: oldHeader, newHeader: newHeader,
            hunks: hunks
        };
    }
}
/**
 * creates a unified diff patch.
 * @param patch either a single structured patch object (as returned by `structuredPatch`) or an array of them (as returned by `parsePatch`)
 */
function formatPatch(patch, headerOptions) {
    if (!headerOptions) {
        headerOptions = exports.INCLUDE_HEADERS;
    }
    if (Array.isArray(patch)) {
        if (patch.length > 1 && !headerOptions.includeFileHeaders) {
            throw new Error('Cannot omit file headers on a multi-file patch. '
                + '(The result would be unparseable; how would a tool trying to apply '
                + 'the patch know which changes are to which file?)');
        }
        return patch.map(function (p) { return formatPatch(p, headerOptions); }).join('\n');
    }
    var ret = [];
    if (headerOptions.includeIndex && patch.oldFileName == patch.newFileName) {
        ret.push('Index: ' + patch.oldFileName);
    }
    if (headerOptions.includeUnderline) {
        ret.push('===================================================================');
    }
    if (headerOptions.includeFileHeaders) {
        ret.push('--- ' + patch.oldFileName + (typeof patch.oldHeader === 'undefined' ? '' : '\t' + patch.oldHeader));
        ret.push('+++ ' + patch.newFileName + (typeof patch.newHeader === 'undefined' ? '' : '\t' + patch.newHeader));
    }
    for (var i = 0; i < patch.hunks.length; i++) {
        var hunk = patch.hunks[i];
        // Unified Diff Format quirk: If the chunk size is 0,
        // the first number is one lower than one would expect.
        // https://www.artima.com/weblogs/viewpost.jsp?thread=164293
        if (hunk.oldLines === 0) {
            hunk.oldStart -= 1;
        }
        if (hunk.newLines === 0) {
            hunk.newStart -= 1;
        }
        ret.push('@@ -' + hunk.oldStart + ',' + hunk.oldLines
            + ' +' + hunk.newStart + ',' + hunk.newLines
            + ' @@');
        for (var _i = 0, _a = hunk.lines; _i < _a.length; _i++) {
            var line = _a[_i];
            ret.push(line);
        }
    }
    return ret.join('\n') + '\n';
}
function createTwoFilesPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
    if (typeof options === 'function') {
        options = { callback: options };
    }
    if (!(options === null || options === void 0 ? void 0 : options.callback)) {
        var patchObj = structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options);
        if (!patchObj) {
            return;
        }
        return formatPatch(patchObj, options === null || options === void 0 ? void 0 : options.headerOptions);
    }
    else {
        var callback_2 = options.callback;
        structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, __assign(__assign({}, options), { callback: function (patchObj) {
                if (!patchObj) {
                    callback_2(undefined);
                }
                else {
                    callback_2(formatPatch(patchObj, options.headerOptions));
                }
            } }));
    }
}
function createPatch(fileName, oldStr, newStr, oldHeader, newHeader, options) {
    return createTwoFilesPatch(fileName, fileName, oldStr, newStr, oldHeader, newHeader, options);
}
/**
 * Split `text` into an array of lines, including the trailing newline character (where present)
 */
function splitLines(text) {
    var hasTrailingNl = text.endsWith('\n');
    var result = text.split('\n').map(function (line) { return line + '\n'; });
    if (hasTrailingNl) {
        result.pop();
    }
    else {
        result.push(result.pop().slice(0, -1));
    }
    return result;
}


/***/ }),
/* 24 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.convertChangesToDMP = convertChangesToDMP;
/**
 * converts a list of change objects to the format returned by Google's [diff-match-patch](https://github.com/google/diff-match-patch) library
 */
function convertChangesToDMP(changes) {
    var ret = [];
    var change, operation;
    for (var i = 0; i < changes.length; i++) {
        change = changes[i];
        if (change.added) {
            operation = 1;
        }
        else if (change.removed) {
            operation = -1;
        }
        else {
            operation = 0;
        }
        ret.push([operation, change.value]);
    }
    return ret;
}


/***/ }),
/* 25 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.convertChangesToXML = convertChangesToXML;
/**
 * converts a list of change objects to a serialized XML format
 */
function convertChangesToXML(changes) {
    var ret = [];
    for (var i = 0; i < changes.length; i++) {
        var change = changes[i];
        if (change.added) {
            ret.push('<ins>');
        }
        else if (change.removed) {
            ret.push('<del>');
        }
        ret.push(escapeHTML(change.value));
        if (change.added) {
            ret.push('</ins>');
        }
        else if (change.removed) {
            ret.push('</del>');
        }
    }
    return ret.join('');
}
function escapeHTML(s) {
    var n = s;
    n = n.replace(/&/g, '&amp;');
    n = n.replace(/</g, '&lt;');
    n = n.replace(/>/g, '&gt;');
    n = n.replace(/"/g, '&quot;');
    return n;
}


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map
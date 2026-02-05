import * as vscode from 'vscode';
import { ToolExecutor, ToolCall, ToolResult } from './toolExecutor';
import { DiffManager } from './diffManager';

/**
 * Backend API response structure.
 */
interface ApiResponse {
    response: string;
    thread_id: string;
    tool_calls?: ToolCall[];
}

/**
 * Manages the PyPilot Assistant webview panel.
 * Handles communication between the webview and the VS Code extension host.
 */
export class AssistantPanel {
    public static currentPanel: AssistantPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private currentThreadId: string;
    private toolExecutor: ToolExecutor;

    /**
     * Creates a new assistant panel or reveals the existing one.
     */
    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor?.viewColumn;

        if (AssistantPanel.currentPanel) {
            AssistantPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'pypilotAssistant',
            'PyPilot Assistant',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'webview'),
                    vscode.Uri.joinPath(extensionUri, 'src', 'asset'),
                    vscode.Uri.joinPath(extensionUri, 'node_modules')
                ]
            }
        );

        AssistantPanel.currentPanel = new AssistantPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this.currentThreadId = this.generateThreadId();
        this.toolExecutor = new ToolExecutor();
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, extensionUri);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Listen for messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
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
                        await DiffManager.getInstance().acceptChange(message.id);
                        break;
                    case 'rejectChange':
                        await DiffManager.getInstance().rejectChange(message.id);
                        break;
                }
            },
            null,
            this._disposables
        );

        // Send initial state to webview
        setTimeout(() => {
            this._postToWebview('threadId', { threadId: this.currentThreadId });
        }, 100);
    }

    private generateThreadId(): string {
        return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private startNewChat() {
        this.currentThreadId = this.generateThreadId();
        this._postToWebview('newChat', { threadId: this.currentThreadId });
    }

    /**
     * Orchestrates the conversation flow between user, agent, and tools.
     */
    private async handleUserMessage(text: string, toolResults?: ToolResult[], selectedModel?: string) {
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
            const requestBody: any = {
                message: text,
                thread_id: this.currentThreadId,
                model: selectedModel
            };
            if (toolResults) requestBody.tool_results = toolResults;

            // Proxy request to the LangGraph backend
            const response = await fetch('http://localhost:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error(`Server returned ${response.status}`);
            const data = await response.json() as ApiResponse;

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
                let currentResults: ToolResult[] = [];
                for (const toolCall of data.tool_calls) {
                    let status = 'Working...';
                    let stepText = `Executing ${toolCall.function.name}...`;

                    try {
                        const args = JSON.parse(toolCall.function.arguments);
                        // Map technical tool names to user-friendly status updates
                        const handlers: { [key: string]: string } = {
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
                    } catch (e) { }

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
                        } catch (e) { }
                    }

                    currentResults = [...currentResults, ...results];
                }

                this._postToWebview('updateStatus', { status: 'Complete', done: true });
                // Continue the turn with the collected tool results
                await this.handleUserMessage(text, currentResults, selectedModel);
                return;
            }
        } catch (error) {
            this._postToWebview('addMessage', {
                message: {
                    type: 'assistant',
                    text: `⚠️ Error: ${error instanceof Error ? error.message : 'Unknown error'}. Ensure the backend service is reachable.`,
                    timestamp: new Date().toISOString()
                }
            });
        } finally {
            this._postToWebview('hideTypingIndicator');
        }
    }

    private _postToWebview(command: string, data?: any) {
        this._panel.webview.postMessage({ command, ...data });
    }

    private _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'webview', 'style.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'webview', 'script.js'));
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'asset', 'pypilot.png'));
        
        // Load marked.js and highlight.js from node_modules
        const markedUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'marked', 'marked.min.js'));
        const highlightJsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'highlight.js', 'lib', 'core.js'));
        const highlightCssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'highlight.js', 'styles', 'github-dark.css'));
        
        // Individual language modules for highlight.js
        const hljsLangs = ['python', 'javascript', 'typescript', 'bash', 'json', 'markdown', 'yaml', 'sql', 'css', 'html', 'xml'];
        const langScripts = hljsLangs.map(lang => 
            `<script src="${webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'highlight.js', 'lib', 'languages', `${lang}.js`))}"></script>`
        ).join('\n    ');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${highlightCssUri}" rel="stylesheet">
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
    <!-- Load markdown parser and syntax highlighter -->
    <script src="${markedUri}"></script>
    <script src="${highlightJsUri}"></script>
    ${langScripts}
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }

    public dispose() {
        AssistantPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }
}

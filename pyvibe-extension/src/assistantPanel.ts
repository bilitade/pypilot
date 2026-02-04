import * as vscode from 'vscode';
import { ToolExecutor, ToolCall, ToolResult } from './toolExecutor';

interface ApiResponse {
    response: string;
    thread_id: string;
    tool_calls?: ToolCall[];
}

/**
 * Manages the PyPilot Assistant webview panel.
 */
export class AssistantPanel {
    public static currentPanel: AssistantPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private currentThreadId: string;
    private toolExecutor: ToolExecutor;

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
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'webview')]
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

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'sendMessage':
                        this.handleUserMessage(message.text);
                        break;
                    case 'newChat':
                        this.startNewChat();
                        break;
                    case 'getThreadId':
                        this._postToWebview('threadId', { threadId: this.currentThreadId });
                        break;
                }
            },
            null,
            this._disposables
        );

        // Send initial thread ID to webview
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

    private async handleUserMessage(text: string, toolResults?: ToolResult[]) {
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
            const requestBody: any = { message: text, thread_id: this.currentThreadId };
            if (toolResults) requestBody.tool_results = toolResults;

            const response = await fetch('http://localhost:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error(`Server returned ${response.status}`);
            const data = await response.json() as ApiResponse;

            // 1. Show Reasoning/Thought if present
            if (data.response) {
                this._postToWebview('addMessage', {
                    message: {
                        type: 'assistant',
                        text: data.response,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            // 2. Handle Tool Calls
            if (data.tool_calls && data.tool_calls.length > 0) {
                let currentResults: ToolResult[] = [];
                for (const toolCall of data.tool_calls) {
                    let status = 'Working...';
                    let stepText = `Executing ${toolCall.function.name}...`;

                    try {
                        const args = JSON.parse(toolCall.function.arguments);
                        if (toolCall.function.name === 'read_file') {
                            status = 'Reading...';
                            stepText = `Reading ${args.file_path}`;
                        } else if (toolCall.function.name === 'write_file') {
                            status = 'Writing...';
                            stepText = `Writing ${args.file_path}`;
                        } else if (toolCall.function.name === 'edit_file') {
                            status = 'Editing...';
                            stepText = `Editing ${args.file_path}`;
                        } else if (toolCall.function.name === 'search_files') {
                            status = 'Searching...';
                            stepText = `Searching for ${args.pattern || args.query}`;
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
                    currentResults = [...currentResults, ...results];
                }

                this._postToWebview('updateStatus', { status: 'Complete', done: true });
                // Recursively handle the next step in the turn
                await this.handleUserMessage(text, currentResults);
                return;
            }
        } catch (error) {
            this._postToWebview('addMessage', {
                message: {
                    type: 'assistant',
                    text: `⚠️ Error: ${error instanceof Error ? error.message : 'Unknown error'}. Is the backend running?`,
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
                <span class="logo-icon">🐍</span>
                <span class="logo-text">PyPilot</span>
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
                    <h1>Ready to code?</h1>
                    <p>Ask me to explain code, write functions, or fix bugs in your Python project.</p>
                </div>
            </div>
        </main>
        <footer class="input-area">
            <div class="input-container">
                <div class="input-tools">
                     <span id="threadId" class="status-badge">New Session</span>
                </div>
                <div class="textarea-wrapper">
                    <textarea id="messageInput" placeholder="Message PyPilot..." rows="1"></textarea>
                    <button id="sendButton" disabled>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                        </svg>
                    </button>
                </div>
            </div>
        </footer>
    </div>
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

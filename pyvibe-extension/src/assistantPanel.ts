import * as vscode from 'vscode';

export class AssistantPanel {
    public static currentPanel: AssistantPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private currentThreadId: string;

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (AssistantPanel.currentPanel) {
            AssistantPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'pyvibeAssistant',
            'PyVibe Assistant',
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
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, extensionUri);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'sendMessage':
                        this.handleUserMessage(message.text);
                        return;
                    case 'newChat':
                        this.startNewChat();
                        return;
                    case 'getThreadId':
                        this._panel.webview.postMessage({
                            command: 'threadId',
                            threadId: this.currentThreadId
                        });
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private generateThreadId(): string {
        return 'thread_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    private startNewChat() {
        this.currentThreadId = this.generateThreadId();
        this._panel.webview.postMessage({
            command: 'newChat',
            threadId: this.currentThreadId
        });
    }

    private async handleUserMessage(text: string) {
        // Add user message to chat
        this._panel.webview.postMessage({
            command: 'addMessage',
            message: {
                type: 'user',
                text: text,
                timestamp: new Date().toISOString()
            }
        });

        // Show typing indicator
        this._panel.webview.postMessage({
            command: 'showTypingIndicator'
        });

        try {
            // Call the API endpoint
            const response = await fetch('http://localhost:8000/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: text,
                    thread_id: this.currentThreadId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json() as { response: string; thread_id: string; metadata?: any };

            // Add assistant response to chat
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: {
                    type: 'assistant',
                    text: data.response,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error calling API:', error);
            
            // Add error message to chat
            this._panel.webview.postMessage({
                command: 'addMessage',
                message: {
                    type: 'assistant',
                    text: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please make sure the PyVibe server is running on localhost:8000.`,
                    timestamp: new Date().toISOString()
                }
            });
        } finally {
            // Hide typing indicator
            this._panel.webview.postMessage({
                command: 'hideTypingIndicator'
            });
        }
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
    <title>PyVibe Assistant</title>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <div class="header-title">
                    <h2>🐍 PyVibe Assistant</h2>
                    <p>Your Python coding companion</p>
                </div>
                <div class="header-actions">
                    <button id="newChatBtn" class="new-chat-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 5v14M5 12h14"/>
                        </svg>
                        New Chat
                    </button>
                </div>
            </div>
        </div>
        
        <div class="chat-container">
            <div id="messages" class="messages"></div>
            
            <div class="input-container">
                <div class="input-wrapper">
                    <textarea id="messageInput" placeholder="Ask me anything about Python coding..." rows="3"></textarea>
                    <button id="sendButton">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
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
            if (x) {
                x.dispose();
            }
        }
    }
}

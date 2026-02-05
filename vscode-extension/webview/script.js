/**
 * PyPilot Assistant Webview Logic
 * Handles message rendering, user input, and communication with the extension host.
 */
(function () {
    const vscode = acquireVsCodeApi();

    // UI Elements
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const newChatBtn = document.getElementById('newChatBtn');
    const threadIdSpan = document.getElementById('threadId');
    const modelSelector = document.getElementById('modelSelector');

    // State
    let currentThreadId = '';
    let selectedModel = localStorage.getItem('selectedModel') || 'google/gemini-2.0-flash-exp';

    // SVG Icons
    const ICONS = {
        WORKING: `<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>`,
        COMPLETED: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        SENT: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`
    };

    /**
     * Initialization Logic
     */
    function init() {
        if (modelSelector) {
            modelSelector.value = selectedModel;
            modelSelector.addEventListener('change', () => {
                selectedModel = modelSelector.value;
                localStorage.setItem('selectedModel', selectedModel);
            });
        }

        // Event Listeners
        sendButton.addEventListener('click', sendMessage);
        newChatBtn.addEventListener('click', () => vscode.postMessage({ command: 'newChat' }));

        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = (messageInput.scrollHeight) + 'px';
            sendButton.disabled = !messageInput.value.trim();
        });

        // Extension message handling
        window.addEventListener('message', handleExtensionMessage);
    }

    /**
     * Process incoming messages from the VS Code extension host.
     */
    function handleExtensionMessage(event) {
        const message = event.data;
        switch (message.command) {
            case 'addMessage':
                renderMessage(message.message);
                break;
            case 'threadId':
                updateThreadContext(message.threadId);
                break;
            case 'newChat':
                resetChat(message.threadId);
                break;
            case 'updateStatus':
                updateAppStatus(message.status, message.done);
                break;
            case 'showTypingIndicator':
                toggleTypingIndicator(true);
                break;
            case 'hideTypingIndicator':
                toggleTypingIndicator(false);
                break;
            case 'addAction':
                renderActionProposal(message.action);
                break;
        }
    }

    function sendMessage() {
        const text = messageInput.value.trim();
        if (text) {
            vscode.postMessage({
                command: 'sendMessage',
                text: text,
                model: selectedModel
            });
            messageInput.value = '';
            messageInput.style.height = 'auto';
            sendButton.disabled = true;
        }
    }

    function renderMessage(msg) {
        toggleTypingIndicator(false);

        if (msg.type === 'system') {
            renderExecutionStep(msg.text);
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.type}-message`;

        const label = document.createElement('div');
        label.className = 'message-header';
        label.innerHTML = `<span class="message-label">${msg.type === 'user' ? 'YOU' : 'PYPILOT'}</span>`;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerHTML = `<div class="message-content">${formatContent(msg.text)}</div>`;

        messageDiv.appendChild(label);
        messageDiv.appendChild(bubble);
        messagesContainer.appendChild(messageDiv);

        scrollToBottom();
    }

    /**
     * Renders a tool execution step (e.g. "Reading file...").
     */
    function renderExecutionStep(text) {
        // Mark previous step as finished if it's still spinning
        const activeStep = messagesContainer.querySelector('.step-container[data-status="working"]');
        if (activeStep) {
            activeStep.querySelector('.step-icon').innerHTML = ICONS.COMPLETED;
            activeStep.dataset.status = 'complete';
        }

        const stepDiv = document.createElement('div');
        stepDiv.className = 'step-container pulse-step';
        stepDiv.dataset.status = 'working';
        stepDiv.innerHTML = `
            <div class="step-header">
                <span class="step-icon">${ICONS.WORKING}</span>
                <span class="step-status">${text}</span>
            </div>
        `;

        messagesContainer.appendChild(stepDiv);
        scrollToBottom();
    }

    /**
     * Basic Markdown-like formatting for message text.
     */
    function formatContent(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // Escape HTML
            .replace(/```([\s\S]+?)```/g, '<pre><code>$1</code></pre>') // Code blocks
            .replace(/`([^`]+)`/g, '<code>$1</code>') // Inline code
            .replace(/\n/g, '<br>'); // Newlines
    }

    /**
     * Renders an interactive action block (Accept/Reject).
     */
    function renderActionProposal(action) {
        toggleTypingIndicator(false);

        const actionDiv = document.createElement('div');
        actionDiv.className = 'action-block animate-in';
        actionDiv.id = `action-${action.id}`;

        const isDelete = action.type === 'delete';
        const actionTitle = `${isDelete ? 'Delete' : 'Modify'} ${action.filePath}?`;

        const titleEl = document.createElement('div');
        titleEl.className = 'action-title';
        titleEl.textContent = actionTitle;

        const btnContainer = document.createElement('div');
        btnContainer.className = 'action-buttons';

        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'btn-action btn-accept';
        acceptBtn.innerHTML = `<span>${ICONS.COMPLETED}</span> Accept`;
        acceptBtn.onclick = () => {
            vscode.postMessage({ command: 'acceptChange', id: action.id });
            actionDiv.classList.add('action-completed');
            titleEl.innerHTML = `${ICONS.COMPLETED} Successfully ${isDelete ? 'Deleted' : 'Modified'} <code>${action.filePath}</code>`;
            btnContainer.remove();
        };

        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'btn-action btn-reject';
        rejectBtn.textContent = 'Reject';
        rejectBtn.onclick = () => {
            vscode.postMessage({ command: 'rejectChange', id: action.id });
            actionDiv.remove();
        };

        btnContainer.appendChild(acceptBtn);
        btnContainer.appendChild(rejectBtn);
        actionDiv.appendChild(titleEl);
        actionDiv.appendChild(btnContainer);
        messagesContainer.appendChild(actionDiv);

        scrollToBottom();
    }

    function toggleTypingIndicator(show) {
        const existing = document.querySelector('.typing-indicator');
        if (show && !existing) {
            const indicator = document.createElement('div');
            indicator.className = 'typing-indicator';
            indicator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
            messagesContainer.appendChild(indicator);
            scrollToBottom();
        } else if (!show && existing) {
            // Also clean up any lingering 'working' steps
            const activeStep = messagesContainer.querySelector('.step-container[data-status="working"]');
            if (activeStep) {
                activeStep.querySelector('.step-icon').innerHTML = ICONS.COMPLETED;
                activeStep.dataset.status = 'complete';
            }
            existing.remove();
        }
    }

    function updateThreadContext(threadId) {
        currentThreadId = threadId;
        if (threadIdSpan) threadIdSpan.textContent = threadId;
    }

    function resetChat(threadId) {
        currentThreadId = threadId;
        if (threadIdSpan) threadIdSpan.textContent = threadId;
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <h1>Code with PyPilot</h1>
                <p>Leverage agentic reasoning to build, debug, and understand your Python codebase.</p>
            </div>`;
    }

    function updateAppStatus(status, done) {
        if (!threadIdSpan) return;
        threadIdSpan.textContent = status;
        if (done) {
            setTimeout(() => {
                threadIdSpan.textContent = currentThreadId || 'Ready';
            }, 2000);
        }
    }

    function scrollToBottom() {
        const chatArea = document.getElementById('chat-area');
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    // Initialize the app
    init();
})();

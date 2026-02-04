(function () {
    const vscode = acquireVsCodeApi();
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const newChatBtn = document.getElementById('newChatBtn');
    const threadIdSpan = document.getElementById('threadId');

    let currentThreadId = '';

    // Icons
    const ICONS = {
        WORK: `<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>`,
        CHECK: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        TERMINAL: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`
    };

    // Handle messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'addMessage':
                appendMessage(message.message);
                break;
            case 'threadId':
                currentThreadId = message.threadId;
                threadIdSpan.textContent = currentThreadId;
                break;
            case 'newChat':
                currentThreadId = message.threadId;
                threadIdSpan.textContent = currentThreadId;
                messagesContainer.innerHTML = `
                    <div class="welcome-message">
                        <h1>Ready to code?</h1>
                        <p>Ask me to explain code, write functions, or fix bugs in your Python project.</p>
                    </div>`;
                break;
            case 'updateStatus':
                if (threadIdSpan) {
                    threadIdSpan.textContent = message.status;
                    if (message.done) {
                        setTimeout(() => {
                            threadIdSpan.textContent = currentThreadId || 'Ready';
                        }, 2000);
                    }
                }
                break;
            case 'showTypingIndicator':
                showTypingIndicator();
                break;
            case 'hideTypingIndicator':
                hideTypingIndicator();
                break;
        }
    });

    // Send message on button click
    sendButton.addEventListener('click', () => {
        sendMessage();
    });

    // Send message on Enter (but allow Shift+Enter for new lines)
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
        sendButton.disabled = !messageInput.value.trim();
    });

    newChatBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'newChat' });
    });

    function sendMessage() {
        const text = messageInput.value.trim();
        if (text) {
            vscode.postMessage({
                command: 'sendMessage',
                text: text
            });
            messageInput.value = '';
            messageInput.style.height = 'auto';
            sendButton.disabled = true;
        }
    }

    function appendMessage(msg) {
        hideTypingIndicator();

        if (msg.type === 'system') {
            appendStep(msg.text);
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.type}-message`;

        const header = document.createElement('div');
        header.className = 'message-header';

        const label = document.createElement('span');
        label.className = 'message-label';
        label.textContent = msg.type === 'user' ? 'YOU' : 'PYPILOT';
        header.appendChild(label);

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';

        const content = document.createElement('div');
        content.className = 'message-content';
        content.innerHTML = formatMessage(msg.text);

        bubble.appendChild(content);
        messageDiv.appendChild(header);
        messageDiv.appendChild(bubble);
        messagesContainer.appendChild(messageDiv);

        scrollToBottom();
    }

    function appendStep(text) {
        // Check if there's a previous "system" step that is incomplete
        const steps = messagesContainer.querySelectorAll('.step-container');
        const lastStep = steps[steps.length - 1];

        if (lastStep && lastStep.dataset.status === 'working') {
            // Update the last step to completed
            const iconSpan = lastStep.querySelector('.step-icon');
            if (iconSpan) iconSpan.innerHTML = ICONS.CHECK;
            lastStep.dataset.status = 'complete';
        }

        const stepDiv = document.createElement('div');
        stepDiv.className = 'step-container pulse-step';
        stepDiv.dataset.status = 'working';

        const header = document.createElement('div');
        header.className = 'step-header';

        const icon = document.createElement('span');
        icon.className = 'step-icon';
        icon.innerHTML = ICONS.WORK;

        const statusText = document.createElement('span');
        statusText.className = 'step-status';
        statusText.textContent = text;

        header.appendChild(icon);
        header.appendChild(statusText);
        stepDiv.appendChild(header);
        messagesContainer.appendChild(stepDiv);

        scrollToBottom();

        // Mark as completed after a short delay (simulating step finish)
        // In a real turn, the extension should probably signal completion
        // but for now we'll mark previous as complete when a new one comes or Turn ends.
    }

    function formatMessage(text) {
        if (!text) return '';
        let formatted = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/```([\s\S]+?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
        return formatted;
    }

    function showTypingIndicator() {
        if (document.querySelector('.typing-indicator')) return;
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
        messagesContainer.appendChild(indicator);
        scrollToBottom();
    }

    function hideTypingIndicator() {
        // Also mark the final step as complete when turn ends
        const steps = messagesContainer.querySelectorAll('.step-container');
        const lastStep = steps[steps.length - 1];
        if (lastStep && lastStep.dataset.status === 'working') {
            const iconSpan = lastStep.querySelector('.step-icon');
            if (iconSpan) iconSpan.innerHTML = ICONS.CHECK;
            lastStep.dataset.status = 'complete';
        }

        const indicator = document.querySelector('.typing-indicator');
        if (indicator) indicator.remove();
    }

    function scrollToBottom() {
        const chatArea = document.getElementById('chat-area');
        chatArea.scrollTop = chatArea.scrollHeight;
    }
})();

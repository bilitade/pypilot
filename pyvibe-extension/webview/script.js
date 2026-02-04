(function () {
    const vscode = acquireVsCodeApi();

    let messagesContainer = document.getElementById('messages');
    let messageInput = document.getElementById('messageInput');
    let sendButton = document.getElementById('sendButton');

    function clearMessages() {
        messagesContainer.innerHTML = '';
    }

    function addWelcomeMessage() {
        addMessage({
            type: 'assistant',
            text: '👋 Hello! I\'m PyPilot Assistant, your Python coding companion. I can help you with:\n\n• Code debugging and explanations\n• Writing Python functions and classes\n• Best practices and optimization\n• Understanding Python concepts\n• And much more!\n\nWhat would you like help with today?',
            timestamp: new Date().toISOString()
        });
    }

    // Initialize with welcome message
    addWelcomeMessage();

    // Add event listener for new chat button
    document.getElementById('newChatBtn').addEventListener('click', () => {
        vscode.postMessage({
            command: 'newChat'
        });
    });

    // Request current thread ID
    vscode.postMessage({
        command: 'getThreadId'
    });

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', handleKeyDown);

    function handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    }

    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;

        // Send message to extension
        vscode.postMessage({
            command: 'sendMessage',
            text: text
        });

        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';

        // Disable send button temporarily
        sendButton.disabled = true;
        showTypingIndicator();
    }

    function addMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.type}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = formatMessageText(message.text);

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = formatTime(message.timestamp);

        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);

        messagesContainer.appendChild(messageDiv);
        scrollToBottom();
    }

    function formatMessageText(text) {
        // Format code blocks with language detection
        let formatted = text;

        // Replace diff blocks with styled diff visualization
        formatted = formatted.replace(/```diff\n([\s\S]*?)```/g, (match, diffContent) => {
            const diffId = 'diff-' + Math.random().toString(36).substr(2, 9);
            const diffLines = parseDiffContent(diffContent);

            let diffHtml = '';
            diffLines.forEach(line => {
                const className = line.type;
                diffHtml += `<div class="diff-line ${className}">${escapeHtml(line.content)}</div>`;
            });

            return `
                <div class="diff-block">
                    <div class="diff-header">
                        <span>Diff</span>
                        <button class="copy-btn" onclick="copyDiff('${diffId}')">Copy</button>
                    </div>
                    <div id="${diffId}">${diffHtml}</div>
                </div>
            `;
        });

        // Replace ```language\ncode\n``` with styled code blocks
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'text';
            const codeId = 'code-' + Math.random().toString(36).substr(2, 9);

            return `
                <div class="code-block">
                    <div class="code-header">
                        <span class="code-language">${language}</span>
                        <button class="copy-btn" onclick="copyCode('${codeId}')">Copy</button>
                    </div>
                    <pre><code id="${codeId}" class="language-${language}">${escapeHtml(code.trim())}</code></pre>
                </div>
            `;
        });

        // Replace inline `code` with styled inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Convert newlines to <br>
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    function parseDiffContent(diffContent) {
        const lines = diffContent.split('\n');
        const parsedLines = [];

        lines.forEach(line => {
            if (line.startsWith('+') && !line.startsWith('+++')) {
                parsedLines.push({ type: 'added', content: line });
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                parsedLines.push({ type: 'removed', content: line });
            } else if (line.startsWith(' ')) {
                parsedLines.push({ type: 'unchanged', content: line });
            } else if (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')) {
                parsedLines.push({ type: 'context', content: line });
            } else {
                parsedLines.push({ type: 'context', content: line });
            }
        });

        return parsedLines;
    }

    function copyDiff(diffId) {
        const diffElement = document.getElementById(diffId);
        if (diffElement) {
            const diffText = Array.from(diffElement.querySelectorAll('.diff-line'))
                .map(line => line.textContent)
                .join('\n');

            navigator.clipboard.writeText(diffText).then(() => {
                // Show feedback
                const button = diffElement.previousElementSibling.querySelector('.copy-btn');
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            });
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function copyCode(codeId) {
        const codeElement = document.getElementById(codeId);
        if (codeElement) {
            navigator.clipboard.writeText(codeElement.textContent).then(() => {
                // Show feedback
                const button = codeElement.parentElement.previousElementSibling.querySelector('.copy-btn');
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            });
        }
    }

    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator active';
        typingDiv.id = 'typingIndicator';

        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            typingDiv.appendChild(dot);
        }

        messagesContainer.appendChild(typingDiv);
        scrollToBottom();
    }

    function hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.command) {
            case 'addMessage':
                hideTypingIndicator();
                addMessage(message.message);
                sendButton.disabled = false;
                messageInput.focus();
                break;
            case 'showTypingIndicator':
                showTypingIndicator();
                break;
            case 'hideTypingIndicator':
                hideTypingIndicator();
                break;
            case 'newChat':
                clearMessages();
                addWelcomeMessage();
                // Show visual feedback for new chat
                const threadEl = document.getElementById('threadId');
                if (threadEl) {
                    threadEl.style.opacity = '0.5';
                    setTimeout(() => {
                        threadEl.style.opacity = '1';
                    }, 300);
                }
                break;
            case 'threadId':
                // Display thread ID in the UI
                const threadIdEl = document.getElementById('threadId');
                if (threadIdEl) {
                    // Show short version of thread ID
                    const shortId = message.threadId.replace('thread_', '').substring(0, 12);
                    threadIdEl.textContent = shortId + '...';
                    threadIdEl.title = message.threadId; // Full ID on hover
                }
                console.log('Current thread ID:', message.threadId);
                break;
        }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // Focus on input
    messageInput.focus();
})();

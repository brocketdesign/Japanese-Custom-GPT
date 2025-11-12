/**
 * Chat Input Handler Module
 * 
 * Handles message input and submission
 * - Text input management
 * - Character counting
 * - Input validation
 * - Send functionality
 * - Input state management
 * 
 * @module ChatInputHandler
 * @requires ChatState, ChatMessageDisplay
 */

window.ChatInputHandler = (function() {
    'use strict';

    // Private state
    const inputState = {
        isComposing: false,
        lastInputValue: '',
        inputHistory: [],
        historyIndex: -1,
        isSending: false
    };

    // Configuration
    const config = {
        maxInputLength: 4000,
        minInputLength: 1,
        historySize: 50
    };

    /**
     * Initialize input handler
     * @param {object} options - Configuration options
     */
    function init(options) {
        try {
            Object.assign(config, options || {});
            
            // Set up event listeners
            setupInputListeners();
            
            console.log('[ChatInputHandler] Initialized');
        } catch (error) {
            console.error('[ChatInputHandler] Initialization error:', error);
        }
    }

    /**
     * Set up input element listeners
     */
    function setupInputListeners() {
        const inputElement = getInputElement();
        if (!inputElement) return;

        // Handle text input
        inputElement.addEventListener('input', handleInput);
        
        // Handle composition (IME input)
        inputElement.addEventListener('compositionstart', () => {
            inputState.isComposing = true;
        });
        inputElement.addEventListener('compositionend', () => {
            inputState.isComposing = false;
        });
        
        // Handle key press
        inputElement.addEventListener('keydown', handleKeyDown);
        
        // Handle paste
        inputElement.addEventListener('paste', handlePaste);
    }

    /**
     * Get input element from DOM
     * @returns {HTMLElement} Input element
     */
    function getInputElement() {
        return document.querySelector('[data-input-type="chat-message"]') ||
               document.querySelector('#messageInput') ||
               document.querySelector('textarea[name="message"]') ||
               document.querySelector('input[type="text"].chat-input');
    }

    /**
     * Get send button from DOM
     * @returns {HTMLElement} Send button element
     */
    function getSendButton() {
        return document.querySelector('[data-button-type="send"]') ||
               document.querySelector('#sendBtn') ||
               document.querySelector('button.send-btn');
    }

    /**
     * Handle input change
     * @param {Event} event - Input event
     */
    function handleInput(event) {
        const input = event.target;
        let value = input.value;

        // Enforce max length
        if (value.length > config.maxInputLength) {
            value = value.substring(0, config.maxInputLength);
            input.value = value;
        }

        inputState.lastInputValue = value;
        
        // Update character counter
        updateCharacterCounter(value.length);
        
        // Update send button state
        updateSendButtonState();
    }

    /**
     * Handle key down event
     * @param {KeyboardEvent} event - Keyboard event
     */
    function handleKeyDown(event) {
        // Skip if composing (IME input)
        if (inputState.isComposing) return;

        // Send on Ctrl/Cmd + Enter
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            submitMessage();
            return;
        }

        // Navigate input history with arrow keys
        if (event.key === 'ArrowUp' && event.ctrlKey) {
            event.preventDefault();
            navigateHistory(-1);
            return;
        }

        if (event.key === 'ArrowDown' && event.ctrlKey) {
            event.preventDefault();
            navigateHistory(1);
            return;
        }
    }

    /**
     * Handle paste event
     * @param {ClipboardEvent} event - Paste event
     */
    function handlePaste(event) {
        // Validate pasted content length
        const pastedText = (event.clipboardData || window.clipboardData).getData('text');
        const input = event.target;
        
        const newLength = input.value.length + pastedText.length;
        if (newLength > config.maxInputLength) {
            event.preventDefault();
            console.warn(`[ChatInputHandler] Pasted text exceeds maximum length`);
        }
    }

    /**
     * Navigate input history
     * @param {number} direction - Direction: -1 for up, 1 for down
     */
    function navigateHistory(direction) {
        if (inputState.inputHistory.length === 0) return;

        const input = getInputElement();
        if (!input) return;

        if (direction === -1 && inputState.historyIndex < inputState.inputHistory.length - 1) {
            inputState.historyIndex++;
        } else if (direction === 1 && inputState.historyIndex > 0) {
            inputState.historyIndex--;
        } else if (direction === 1 && inputState.historyIndex === 0) {
            input.value = '';
            inputState.historyIndex = -1;
            return;
        }

        const historyItem = inputState.historyIndex >= 0 ? 
            inputState.inputHistory[inputState.historyIndex] : '';
        
        input.value = historyItem;
        inputState.lastInputValue = historyItem;
    }

    /**
     * Add input to history
     * @param {string} message - Message text
     */
    function addToHistory(message) {
        if (message.trim().length === 0) return;

        // Remove duplicate if exists
        const existingIndex = inputState.inputHistory.indexOf(message);
        if (existingIndex !== -1) {
            inputState.inputHistory.splice(existingIndex, 1);
        }

        // Add to front
        inputState.inputHistory.unshift(message);

        // Limit history size
        if (inputState.inputHistory.length > config.historySize) {
            inputState.inputHistory.pop();
        }

        // Reset history index
        inputState.historyIndex = -1;
    }

    /**
     * Submit message
     * @returns {Promise<void>}
     */
    async function submitMessage() {
        try {
            const input = getInputElement();
            if (!input) return;

            const message = input.value.trim();

            // Validate message
            if (message.length < config.minInputLength) {
                console.warn('[ChatInputHandler] Message too short');
                return;
            }

            if (message.length > config.maxInputLength) {
                console.warn('[ChatInputHandler] Message too long');
                return;
            }

            // Check if already sending
            if (inputState.isSending) {
                console.warn('[ChatInputHandler] Already sending message');
                return;
            }

            // Mark as sending
            inputState.isSending = true;
            setSendingState(true);

            // Add to history
            addToHistory(message);

            // Dispatch custom event for message submission
            window.dispatchEvent(new CustomEvent('chatMessageSubmit', {
                detail: { message: message }
            }));

            // Clear input
            input.value = '';
            inputState.lastInputValue = '';
            updateCharacterCounter(0);
            updateSendButtonState();

        } catch (error) {
            console.error('[ChatInputHandler] Error submitting message:', error);
        } finally {
            inputState.isSending = false;
            setSendingState(false);
        }
    }

    /**
     * Update character counter display
     * @param {number} currentLength - Current character count
     */
    function updateCharacterCounter(currentLength) {
        const counter = document.querySelector('.input-character-counter');
        if (counter) {
            counter.textContent = `${currentLength}/${config.maxInputLength}`;
            
            // Change color based on usage
            if (currentLength > config.maxInputLength * 0.9) {
                counter.classList.add('warning');
            } else {
                counter.classList.remove('warning');
            }
        }
    }

    /**
     * Update send button state
     */
    function updateSendButtonState() {
        const input = getInputElement();
        const button = getSendButton();

        if (!button || !input) return;

        const hasContent = input.value.trim().length >= config.minInputLength;
        
        if (hasContent && !inputState.isSending) {
            button.disabled = false;
            button.classList.add('active');
        } else {
            button.disabled = true;
            button.classList.remove('active');
        }
    }

    /**
     * Set sending state UI
     * @param {boolean} isSending - Is sending
     */
    function setSendingState(isSending) {
        const button = getSendButton();
        if (!button) return;

        if (isSending) {
            button.disabled = true;
            button.classList.add('sending');
            button.dataset.originalText = button.textContent;
            button.textContent = '⏳ Sending...';
        } else {
            button.disabled = false;
            button.classList.remove('sending');
            button.textContent = button.dataset.originalText || 'Send';
        }
    }

    /**
     * Clear input
     */
    function clearInput() {
        const input = getInputElement();
        if (input) {
            input.value = '';
            inputState.lastInputValue = '';
            updateCharacterCounter(0);
            updateSendButtonState();
        }
    }

    /**
     * Get current input value
     * @returns {string} Input value
     */
    function getInputValue() {
        const input = getInputElement();
        return input ? input.value : '';
    }

    /**
     * Set input value
     * @param {string} value - New value
     */
    function setInputValue(value) {
        const input = getInputElement();
        if (input) {
            input.value = value;
            inputState.lastInputValue = value;
            updateCharacterCounter(value.length);
            updateSendButtonState();
        }
    }

    /**
     * Focus input element
     */
    function focusInput() {
        const input = getInputElement();
        if (input) {
            input.focus();
        }
    }

    /**
     * Clear input history
     */
    function clearHistory() {
        inputState.inputHistory = [];
        inputState.historyIndex = -1;
    }

    /**
     * Get input statistics
     * @returns {object} Input state statistics
     */
    function getInputStats() {
        return {
            currentLength: inputState.lastInputValue.length,
            maxLength: config.maxInputLength,
            historySize: inputState.inputHistory.length,
            isSending: inputState.isSending
        };
    }

    // Public API
    return {
        init,
        submitMessage,
        clearInput,
        getInputValue,
        setInputValue,
        focusInput,
        clearHistory,
        getInputStats,
        getInputElement,
        getSendButton,
        // Debugging
        logInputState: () => {
            console.log('[ChatInputHandler] State:', {
                isComposing: inputState.isComposing,
                lastInputValue: inputState.lastInputValue,
                historySize: inputState.inputHistory.length,
                isSending: inputState.isSending
            });
        }
    };
})();

// Module registration
if (window.ChatCore && typeof window.ChatCore.registerModule === 'function') {
    window.ChatCore.registerModule('ChatInputHandler', window.ChatInputHandler);
}

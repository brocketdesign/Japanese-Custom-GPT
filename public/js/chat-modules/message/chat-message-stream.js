/**
 * Chat Message Stream Module
 * Handles real-time message streaming and character-by-character rendering
 * 
 * @module chat-message-stream
 * @requires ChatState
 * @requires ChatMessageFormatter
 * @requires marked (global)
 */

const ChatMessageStream = (function() {
    'use strict';

    // ============================================================================
    // Private Variables
    // ============================================================================

    const activeRenderProcesses = new Set();

    // ============================================================================
    // Core Streaming Functions
    // ============================================================================

    /**
     * Display a message with character-by-character streaming animation
     * @param {string} message - The message to stream
     * @param {string} uniqueId - Unique identifier for this stream
     */
    function displayCompletionMessage(message, uniqueId) {
        // Check if this message is already being rendered
        if (activeRenderProcesses.has(uniqueId)) {
            console.warn(`[ChatMessageStream] Message ${uniqueId} is already being rendered, skipping duplicate`);
            return;
        }

        // Add this process to active renders
        activeRenderProcesses.add(uniqueId);

        const completionElement = $(`#completion-${uniqueId}`);

        if (!completionElement.length) {
            console.warn(`[ChatMessageStream] Element #completion-${uniqueId} not found`);
            activeRenderProcesses.delete(uniqueId);
            return;
        }

        // Check if the message has already been fully rendered
        const currentText = completionElement.text().trim();
        if (currentText === message.trim()) {
            console.log(`[ChatMessageStream] Message ${uniqueId} already fully rendered, skipping`);
            activeRenderProcesses.delete(uniqueId);
            afterStreamEnd(uniqueId, message);
            return;
        }

        // Clear any existing content except loading gif
        completionElement.find('img').fadeOut().remove();

        // Get already rendered text length to continue from where we left off
        const alreadyRendered = currentText.length;
        const graphemes = [...message.slice(alreadyRendered)];
        const CHUNK_SIZE = 1; // One character at a time

        /**
         * Render text chunks using requestAnimationFrame for smooth animation
         * @private
         */
        function renderChunk() {
            // Double-check if process is still active (in case of cleanup)
            if (!activeRenderProcesses.has(uniqueId)) {
                return;
            }

            // Check if element still exists
            if (!$(`#completion-${uniqueId}`).length) {
                activeRenderProcesses.delete(uniqueId);
                return;
            }

            // Append next chunk of characters
            for (let i = 0; i < CHUNK_SIZE && graphemes.length; i++) {
                const textNode = document.createTextNode(graphemes.shift());
                $(`#completion-${uniqueId}`).append(textNode);
            }

            // Continue rendering if more characters to display
            if (graphemes.length > 0) {
                requestAnimationFrame(renderChunk);
            } else {
                // Rendering complete, finalize message
                activeRenderProcesses.delete(uniqueId);
                const finalText = $(`#completion-${uniqueId}`).text();
                afterStreamEnd(uniqueId, finalText);
            }
        }

        // Start auto-play audio if available
        if (typeof autoPlayMessageAudio === 'function') {
            autoPlayMessageAudio(uniqueId, message);
        }

        // Begin the streaming animation
        requestAnimationFrame(renderChunk);
    }

    /**
     * Called after streaming completes to finalize the message
     * @param {string} uniqueId - Unique identifier for this stream
     * @param {string} markdownContent - The final markdown content
     */
    function afterStreamEnd(uniqueId, markdownContent) {
        const completionElement = $(`#completion-${uniqueId}`);
        const messageContainer = $(`#container-${uniqueId}`);

        if (!messageContainer.length) {
            console.warn(`[ChatMessageStream] Container #container-${uniqueId} not found`);
            return;
        }

        try {
            // Update audio button data
            $(`#play-${uniqueId}`).attr('data-content', markdownContent);
            $(`#download-${uniqueId}`).attr('data-content', markdownContent);
            $(`#download-${uniqueId}`).prop('disabled', false).removeClass('disabled');
            $(`#play-${uniqueId}`).closest('.audio-controller').show();

            // Format and update message content
            const currentMessageText = completionElement.text().trim();
            let updatedMessage = ChatMessageFormatter.formatMessageText(currentMessageText);

            // Parse markdown if marked is available
            if (typeof marked !== 'undefined') {
                updatedMessage = marked.parse(updatedMessage);
            }

            completionElement.html(updatedMessage);

            // Add message tools if function is available
            if (typeof getMessageTools === 'function') {
                const currentMessageIndex = $('#chatContainer .assistant-chat-box').length - 1;
                const messageData = {
                    _id: null,
                    content: markdownContent,
                    timestamp: Date.now(),
                    role: 'assistant'
                };

                const toolsHtml = getMessageTools(currentMessageIndex, [], true, true, messageData);
                const relativeContainer = messageContainer.find('.position-relative').last();

                if (relativeContainer.length && !relativeContainer.find('.message-tools-controller').length) {
                    relativeContainer.append(toolsHtml);
                }
            }

            // Show suggestions after message completes
            if (window.chatSuggestionsManager && window.userId && window.chatId && window.userChatId) {
                setTimeout(() => {
                    window.chatSuggestionsManager.showSuggestions(
                        window.userId,
                        window.chatId,
                        window.userChatId
                    );
                }, 500);
            }
        } catch (error) {
            console.error('[ChatMessageStream] Error in afterStreamEnd:', error);
        }
    }

    /**
     * Hide a completion message
     * @param {string} uniqueId - Unique identifier for this stream
     */
    function hideCompletion(uniqueId) {
        $(`#completion-${uniqueId}`).fadeOut();
    }

    /**
     * Hide and remove a completion message
     * @param {string} uniqueId - Unique identifier for this stream
     */
    function hideCompletionMessage(uniqueId) {
        // Clean up active render process
        activeRenderProcesses.delete(uniqueId);
        $(`#completion-${uniqueId}`).closest('.message-container').closest('div').fadeOut().remove();
    }

    // ============================================================================
    // Stream Management Functions
    // ============================================================================

    /**
     * Check if a specific stream is currently rendering
     * @param {string} uniqueId - Unique identifier for this stream
     * @returns {boolean} True if stream is active
     */
    function isRenderingActive(uniqueId) {
        return activeRenderProcesses.has(uniqueId);
    }

    /**
     * Get count of active rendering processes
     * @returns {number} Number of active streams
     */
    function getActiveStreamCount() {
        return activeRenderProcesses.size;
    }

    /**
     * Stop all active rendering processes
     */
    function stopActiveRenderers() {
        activeRenderProcesses.forEach(uniqueId => {
            console.log(`[ChatMessageStream] Stopping renderer: ${uniqueId}`);
            activeRenderProcesses.delete(uniqueId);
        });
    }

    /**
     * Clear all active rendering processes
     */
    function clearActiveRenderers() {
        activeRenderProcesses.clear();
    }

    // ============================================================================
    // Container Creation Functions
    // ============================================================================

    /**
     * Create a bot response container for streaming messages
     * @param {string} uniqueId - Unique identifier for this container
     * @returns {jQuery} The created container element
     */
    function createBotResponseContainer(uniqueId) {
        // Clean up any existing process with same ID
        activeRenderProcesses.delete(uniqueId);

        const state = window.ChatState ? window.ChatState.getState() : {};
        const thumbnail = window.thumbnail || state.thumbnail || '/img/logo.webp';
        const chatId = state.chatId;

        const container = $(`
            <div id="container-${uniqueId}">
                <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container">
                    <img src="${thumbnail}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position: top; cursor: pointer;" onclick="openCharacterInfoModal('${chatId}', event)">
                    <div class="audio-controller bg-dark">
                        <button id="play-${uniqueId}" 
                        class="audio-content badge bg-dark rounded-pill shadow-sm border-light">►</button>
                        <button id="download-${uniqueId}"
                        class="audio-download badge bg-dark rounded-pill shadow-sm border-light ms-2"
                        aria-label="音声をダウンロード"
                        title="音声をダウンロード"
                        disabled>
                            <i class="bi bi-download"></i>
                        </button>
                    </div>
                    <div class="ms-3 p-3 text-start assistant-chat-box flex-grow-1 position-relative">
                        <div id="completion-${uniqueId}"><img src="/img/load-dot.gif" width="50px"></div>
                        <!-- Message tools will be added here after streaming completes -->
                    </div>
                </div>
            </div>
        `).hide();

        $('#chatContainer').append(container);
        container.addClass('animate__animated animate__slideInUp').fadeIn();

        return container;
    }

    // ============================================================================
    // Utility Functions
    // ============================================================================

    /**
     * Check if any streams are currently active
     * @returns {boolean} True if any stream is rendering
     */
    function hasActiveStreams() {
        return activeRenderProcesses.size > 0;
    }

    /**
     * Get list of active stream IDs
     * @returns {Array} Array of unique IDs of active streams
     */
    function getActiveStreamIds() {
        return Array.from(activeRenderProcesses);
    }

    /**
     * Log current state of streaming (for debugging)
     * @private
     */
    function logStreamState() {
        if (activeRenderProcesses.size > 0) {
            console.log('[ChatMessageStream] Active streams:', getActiveStreamIds());
        } else {
            console.log('[ChatMessageStream] No active streams');
        }
    }

    // ============================================================================
    // Public API
    // ============================================================================

    return {
        // Core streaming
        displayCompletionMessage,
        afterStreamEnd,
        hideCompletion,
        hideCompletionMessage,

        // Stream management
        isRenderingActive,
        getActiveStreamCount,
        hasActiveStreams,
        getActiveStreamIds,
        stopActiveRenderers,
        clearActiveRenderers,

        // Container creation
        createBotResponseContainer,

        // Debugging
        logStreamState
    };
})();

// Make it available globally
window.ChatMessageStream = ChatMessageStream;

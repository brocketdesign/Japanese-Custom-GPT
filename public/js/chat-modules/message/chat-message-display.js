/**
 * Chat Message Display Module
 * Handles message rendering and DOM manipulation for chat display
 * 
 * @module chat-message-display
 * @requires ChatState
 * @requires ChatMessageFormatter
 * @requires marked (global)
 */

const ChatMessageDisplay = (function() {
    'use strict';

    // ============================================================================
    // Private Variables
    // ============================================================================

    const displayedMessageIds = new Set();
    const displayedImageIds = new Set();
    const displayedVideoIds = new Set();

    // ============================================================================
    // Core Display Functions
    // ============================================================================

    /**
     * Display a single message in the chat container
     * @param {string} sender - 'user' or 'bot'
     * @param {string} message - Message text or HTML element
     * @param {string} userChatId - User chat ID
     * @param {Function} callback - Callback when message is displayed
     */
    function displayMessage(sender, message, userChatId, callback) {
        const messageContainer = $(`#chatContainer[data-id=${userChatId}]`);
        const messageClass = sender === 'user' ? 'user-message' : sender;
        const animationClass = 'animate__animated animate__slideInUp';
        let messageElement;

        if (messageClass === 'user-message') {
            if (typeof message === 'string' && message.trim() !== '') {
                // Clean message text
                const cleanMessage = message
                    .replace('[Hidden]', '')
                    .replace('[user] ', '')
                    .replace('[context] ', '');

                const state = window.ChatState ? window.ChatState.getState() : {};
                const persona = state.persona || window.persona || {};

                messageElement = $(`
                    <div class="d-flex flex-row justify-content-end mb-4 message-container ${messageClass} ${animationClass}">
                        <div class="p-3 me-3 border-0 text-start user-message" style="border-radius: 15px; background-color: #fbfbfbdb;">
                            <span>${escapeHtml(cleanMessage)}</span>
                        </div>
                        ${persona.chatImageUrl ? `<img src="${persona.chatImageUrl || '/img/logo.webp'}" alt="avatar" class="rounded-circle user-image-chat" data-id="${state.chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top;">` : ''}
                    </div>
                `).hide();

                messageContainer.append(messageElement);
                messageElement.addClass(animationClass).fadeIn();
                scrollToLatestMessage();
            }
        } else if (messageClass === 'bot-image' && message instanceof HTMLElement) {
            displayImageMessage(message, userChatId, animationClass);
        } else if (messageClass === 'assistant' && typeof message === 'string' && message.trim() !== '') {
            displayAssistantMessage(message, userChatId, animationClass);
        }

        if (typeof callback === 'function') {
            callback();
        }
    }

    /**
     * Display an image message
     * @private
     */
    function displayImageMessage(message, userChatId, animationClass) {
        const messageContainer = $(`#chatContainer[data-id=${userChatId}]`);
        const imageId = message.getAttribute('data-id');
        const imageNsfw = message.getAttribute('data-nsfw') === 'true';
        const title = message.getAttribute('alt');
        const prompt = message.getAttribute('data-prompt');
        const imageUrl = message.getAttribute('src');
        const isMergeFace = message.getAttribute('data-isMergeFace') === 'true';

        const state = window.ChatState ? window.ChatState.getState() : {};
        const thumbnail = window.thumbnail || state.thumbnail || '/img/default-avatar.png';
        const chatId = state.chatId;

        // Handle NSFW content
        const subscriptionStatus = (window.user && window.user.subscriptionStatus) === 'active';
        const shouldBlur = imageNsfw && !subscriptionStatus;

        if (shouldBlur) {
            message.removeAttribute('src');
            message.setAttribute('data-src', imageUrl);
            message.classList.add('img-blur');
        }

        const messageElement = $(`
            <div class="d-flex flex-row justify-content-start mb-4 message-container bot-image ${animationClass}">
                <img src="${thumbnail}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top;" onclick="openCharacterInfoModal('${chatId}', event)">
                <div class="ms-3 position-relative">
                    <div 
                    onclick="showImagePreview(this)" 
                    class="ps-0 text-start assistant-image-box vertical-transition ${shouldBlur ? 'isBlurred' : '' }" 
                    data-id="${imageId}" 
                    style="position: relative;">
                        ${message.outerHTML}
                    </div>
                </div>
            </div>
        `).hide();

        messageContainer.append(messageElement);
        messageElement.addClass(animationClass).fadeIn();

        if (shouldBlur) {
            messageElement.find('.img-blur').each(function() {
                if (typeof blurImage === 'function') {
                    blurImage(this);
                }
            });
        }

        displayImageThumb(imageUrl, userChatId, shouldBlur);
    }

    /**
     * Display an assistant (bot) text message
     * @private
     */
    function displayAssistantMessage(message, userChatId, animationClass) {
        const messageContainer = $(`#chatContainer[data-id=${userChatId}]`);
        const uniqueId = `completion-${Date.now()}`;
        const state = window.ChatState ? window.ChatState.getState() : {};
        const thumbnail = window.thumbnail || state.thumbnail || '/img/default-avatar.png';
        const chatId = state.chatId;

        const messageElement = $(`
            <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container ${animationClass}">
                <img src="${thumbnail}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top; cursor:pointer;" onclick="openCharacterInfoModal('${chatId}', event)">
                <div class="audio-controller bg-dark">
                    <button id="play-${uniqueId}" 
                    class="audio-content badge bg-dark rounded-pill shadow-sm border-light" 
                    data-content="${message}">►</button>
                    <button id="download-${uniqueId}" 
                    class="audio-download badge bg-dark rounded-pill shadow-sm border-light ms-2" 
                    data-content="${message}"
                    aria-label="音声をダウンロード"
                    title="音声をダウンロード">
                        <i class="bi bi-download"></i>
                    </button>
                </div>
                <div id="${uniqueId}" class="p-3 ms-3 text-start assistant-chat-box position-relative">
                    ${typeof marked !== 'undefined' ? marked.parse(message) : escapeHtml(message)}
                </div>
            </div>
        `).hide();

        messageContainer.append(messageElement);
        messageElement.show().addClass(animationClass);
        scrollToLatestMessage();
    }

    /**
     * Display an existing chat with all its messages
     * @param {Array} userChat - Array of message objects
     * @param {Object} persona - User persona object
     * @param {Function} callback - Callback when complete
     */
    function displayExistingChat(userChat, persona, callback) {
        if (!Array.isArray(userChat)) {
            console.warn('[ChatMessageDisplay] Invalid userChat data');
            if (callback) callback();
            return;
        }

        const state = window.ChatState ? window.ChatState.getState() : {};
        const chatId = state.chatId;
        const thumbnail = window.thumbnail || state.thumbnail || '/img/default-avatar.png';

        // Clear tracking sets
        displayedMessageIds.clear();
        displayedImageIds.clear();
        displayedVideoIds.clear();

        userChat.forEach((chatMessage, index) => {
            try {
                const messageId = chatMessage._id || `${chatMessage.role}_${index}`;

                // Skip if already displayed
                if (displayedMessageIds.has(messageId)) {
                    return;
                }

                if (chatMessage.role === 'user') {
                    displayUserMessage(chatMessage, persona);
                } else if (chatMessage.role === 'assistant') {
                    displayBotMessage(chatMessage, chatId, thumbnail, index);
                }

                displayedMessageIds.add(messageId);
            } catch (error) {
                console.error('[ChatMessageDisplay] Error displaying message:', error);
            }
        });

        if (callback) callback();
    }

    /**
     * Display a user message from history
     * @private
     */
    function displayUserMessage(chatMessage, persona) {
        const isHidden = chatMessage.hidden === true || 
                        chatMessage.content.startsWith('[Hidden]') || 
                        chatMessage.name === 'master';
        const isStarter = chatMessage.content.startsWith('[Starter]') || 
                         chatMessage.content.startsWith('Invent a situation');

        if (!isHidden && !isStarter) {
            const state = window.ChatState ? window.ChatState.getState() : {};
            const chatContainer = $(`#chatContainer[data-id=${state.userChatId}]`);
            const content = ChatMessageFormatter.removeFormattingTags(chatMessage.content);

            const messageHtml = `
                <div class="d-flex flex-row justify-content-end mb-4 message-container animate__animated animate__slideInUp" style="position: relative;">
                    <div class="p-3 me-3 border-0 text-start user-message" style="border-radius: 15px; background-color: #fbfbfbdb;">
                        ${typeof marked !== 'undefined' ? marked.parse(content) : escapeHtml(content)}
                    </div>
                    ${persona && persona.chatImageUrl ? `<img src="${persona.chatImageUrl || '/img/logo.webp'}" alt="avatar" class="rounded-circle user-image-chat" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top;">` : ''}
                </div>
            `;

            chatContainer.append(messageHtml);
        }
    }

    /**
     * Display a bot message from history
     * @private
     */
    function displayBotMessage(chatMessage, chatId, thumbnail, index) {
        const state = window.ChatState ? window.ChatState.getState() : {};
        const userChatId = state.userChatId;
        const chatContainer = $(`#chatContainer[data-id=${userChatId}]`);
        const designStep = Math.floor(index / 2) + 1;

        const isNarrator = chatMessage.content.startsWith('[Narrator]');
        const isImage = chatMessage.imageId || chatMessage.content.startsWith('[Image]');
        const isMergeFace = chatMessage.mergeId || chatMessage.content.startsWith('[MergeFace]');

        if (isNarrator) {
            const narrationContent = chatMessage.content.replace('[Narrator]', '').trim();
            chatContainer.append(`
                <div id="narrator-container-${designStep}" class="d-flex flex-row justify-content-start message-container">
                    <div id="narration-${designStep}" class="p-3 ms-3 text-start narration-container">
                        ${typeof marked !== 'undefined' ? marked.parse(narrationContent) : escapeHtml(narrationContent)}
                    </div>
                </div>
            `);
        } else if (!isImage && !isMergeFace) {
            const messageHtml = `
                <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container animate__animated animate__slideInUp">
                    <img src="${thumbnail}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top; cursor:pointer;" onclick="openCharacterInfoModal('${chatId}', event)">
                    <div class="p-3 ms-3 text-start assistant-chat-box">
                        ${typeof marked !== 'undefined' ? marked.parse(chatMessage.content) : escapeHtml(chatMessage.content)}
                    </div>
                </div>
            `;
            chatContainer.append(messageHtml);
        }
    }

    /**
     * Display the initial chat interface
     * @param {Object} chat - Chat data object
     */
    function displayInitialChatInterface(chat) {
        const chatContainer = $('#chatContainer');
        chatContainer.empty();
        chatContainer.append('<div class="text-center mt-5"><h5>Ready to start chatting...</h5></div>');
    }

    /**
     * Display a chat starter message
     * @param {Object} chat - Chat data
     */
    function displayStarter(chat) {
        const uniqueId = `starter-${Date.now()}`;
        const state = window.ChatState ? window.ChatState.getState() : {};
        const chatId = state.chatId;
        const thumbnail = window.thumbnail || state.thumbnail || '/img/logo.webp';

        if ($('.starter-on').length === 0) {
            const starterHtml = `
                <div id="starter-${uniqueId}" class="starter-on">
                    <div class="d-flex flex-row justify-content-start position-relative mb-4 message-container">
                        <img src="${thumbnail}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top; cursor:pointer;" onclick="openCharacterInfoModal('${chatId}', event)">
                        <div class="audio-controller bg-dark">
                            <button id="play-${uniqueId}" class="audio-content badge bg-dark rounded-pill shadow-sm border-light">►</button>
                            <button id="download-${uniqueId}" class="audio-download badge bg-dark rounded-pill shadow-sm border-light ms-2" aria-label="音声をダウンロード" title="音声をダウンロード" disabled>
                                <i class="bi bi-download"></i>
                            </button>
                        </div>
                        <div id="completion-${uniqueId}" class="p-3 ms-3 text-start assistant-chat-box">
                            <img src="/img/load-dot.gif" width="50px">
                        </div>
                    </div>
                    <div id="response-${uniqueId}" class="choice-container"></div>
                </div>
            `;

            $('#chatContainer').append(starterHtml);
        }
    }

    /**
     * Display a thank you message
     */
    function displayThankMessage() {
        const state = window.ChatState ? window.ChatState.getState() : {};
        const userChatId = state.userChatId;
        const chatContainer = $(`#chatContainer[data-id=${userChatId}]`);
        const thumbnail = window.thumbnail || state.thumbnail || '/img/logo.webp';

        const thankYouHtml = `
            <div class="d-flex flex-row justify-content-start mb-4 message-container animate__animated animate__slideInUp">
                <img src="${thumbnail}" alt="avatar" class="rounded-circle chatbot-image-chat" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position:top;">
                <div class="p-3 ms-3 text-start assistant-chat-box">
                    Thank you for chatting!
                </div>
            </div>
        `;

        chatContainer.append(thankYouHtml);
    }

    /**
     * Display an image thumbnail
     * @param {string} imageUrl - URL of the image
     * @param {string} userChatId - User chat ID
     * @param {boolean} shouldBlur - Whether to blur the image
     */
    function displayImageThumb(imageUrl, userChatId, shouldBlur = false) {
        if (!imageUrl) return;

        const thumb = new Image();
        thumb.src = imageUrl;
        thumb.onload = function() {
            // Preload image for thumbnail
            if (typeof console !== 'undefined') {
                console.log('[ChatMessageDisplay] Image thumbnail loaded:', imageUrl);
            }
        };
        thumb.onerror = function() {
            console.warn('[ChatMessageDisplay] Failed to load image thumbnail:', imageUrl);
        };
    }

    /**
     * Display a video thumbnail
     * @param {string} videoUrl - URL of the video
     * @param {string} userChatId - User chat ID
     */
    function displayVideoThumb(videoUrl, userChatId) {
        if (!videoUrl) return;

        // Track displayed video to avoid duplicates
        if (!displayedVideoIds.has(videoUrl)) {
            displayedVideoIds.add(videoUrl);
        }
    }

    /**
     * Display an entire chat
     * @param {Object} userChat - Chat data
     * @param {Object} persona - Persona object
     * @param {Function} callback - Callback when complete
     */
    function displayChat(userChat, persona, callback) {
        const chatContainer = $('#chatContainer');
        chatContainer.empty();
        chatContainer.css('overflow', 'hidden');

        // Clear tracking sets
        displayedMessageIds.clear();
        displayedImageIds.clear();
        displayedVideoIds.clear();

        // Display all messages
        displayExistingChat(userChat, persona, () => {
            // Scroll to bottom
            scrollToLatestMessage();
            if (callback) callback();
        });
    }

    // ============================================================================
    // Utility Functions
    // ============================================================================

    /**
     * Scroll to the latest message
     */
    function scrollToLatestMessage() {
        const container = $('#chatContainer');
        if (container.length) {
            container.animate({ scrollTop: container[0].scrollHeight }, 500);
        }
    }

    /**
     * Clear all messages from chat display
     */
    function clearChatDisplay() {
        $('#chatContainer').empty();
        displayedMessageIds.clear();
        displayedImageIds.clear();
        displayedVideoIds.clear();
    }

    /**
     * Get the message container element
     */
    function getMessageContainer() {
        return $('#chatContainer');
    }

    /**
     * Escape HTML special characters
     * @private
     */
    function escapeHtml(text) {
        if (!text) return text;
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, char => map[char]);
    }

    // ============================================================================
    // Public API
    // ============================================================================

    return {
        // Core functions
        displayMessage,
        displayExistingChat,
        displayChat,

        // Special messages
        displayInitialChatInterface,
        displayStarter,
        displayThankMessage,

        // Media
        displayImageThumb,
        displayVideoThumb,

        // Utility
        scrollToLatestMessage,
        clearChatDisplay,
        getMessageContainer
    };
})();

// Make it available globally
window.ChatMessageDisplay = ChatMessageDisplay;

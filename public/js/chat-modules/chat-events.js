/**
 * chat-events.js
 * Event management and listeners for the chat system
 * Handles DOM events, custom events, and cross-document messaging
 * 
 * @version 1.0.0
 * @date November 12, 2025
 * @module ChatEventManager
 */

(function(window) {
    'use strict';

    /**
     * ChatEventManager - Central event management for the chat system
     * Coordinates all event listeners and event-based communication
     */
    const ChatEventManager = {
        // Event tracking
        registeredListeners: new Map(),
        customEventHandlers: new Map(),

        /**
         * Initialize all event listeners
         */
        init: function() {
            console.log('[ChatEventManager] Initializing event listeners');

            try {
                this.setupDOMListeners();
                this.setupCustomEventListeners();
                this.setupPostMessageListeners();
                this.setupKeyboardListeners();
                console.log('[ChatEventManager] All event listeners initialized');
            } catch (error) {
                console.error('[ChatEventManager] Error initializing listeners:', error);
                throw error;
            }
        },

        /**
         * Setup DOM event listeners
         * @private
         */
        setupDOMListeners: function() {
            console.log('[ChatEventManager] Setting up DOM listeners');

            // Message submission via input form
            $(document).on('submit', '#messageForm', (e) => {
                e.preventDefault();
                this.handleMessageSubmit();
            });

            // Send button click
            $(document).on('click', '#sendBtn, .send-button', (e) => {
                e.preventDefault();
                this.handleMessageSubmit();
            });

            // Input field keydown (for Ctrl+Enter support)
            $(document).on('keydown', '#messageInput, .message-input', (e) => {
                this.handleInputKeydown(e);
            });

            // Chat link click
            $(document).on('click', '[data-chat-id]', (e) => {
                e.preventDefault();
                const chatId = $(e.target).closest('[data-chat-id]').data('chat-id');
                this.handleChatSelection(chatId);
            });

            // Dropdown toggle
            $(document).on('click', '.dropdown-toggle', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleDropdownToggle(e.target);
            });

            // Message action buttons (like, regenerate, etc.)
            $(document).on('click', '[data-message-action]', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const action = $(e.target).data('message-action');
                const messageId = $(e.target).closest('[data-message-id]').data('message-id');
                this.handleMessageAction(action, messageId, e.target);
            });

            // Image tools
            $(document).on('click', '[data-image-action]', (e) => {
                e.preventDefault();
                const action = $(e.target).data('image-action');
                const imageId = $(e.target).closest('[data-image-id]').data('image-id');
                this.handleImageAction(action, imageId, e.target);
            });

            // Close dropdowns on document click
            $(document).on('click', (e) => {
                if (!$(e.target).closest('.dropdown-menu, .dropdown-toggle').length) {
                    this.closeAllDropdowns();
                }
            });

            console.log('[ChatEventManager] DOM listeners attached');
        },

        /**
         * Setup custom event listeners
         * @private
         */
        setupCustomEventListeners: function() {
            console.log('[ChatEventManager] Setting up custom event listeners');

            // Chat ready event
            $(document).on('chatcore:ready', () => {
                console.log('[ChatEventManager] Chat core ready event received');
                this.triggerChatEvent('system:ready');
            });

            // API fetch success
            $(document).on('chatapi:fetch-success', (e, data) => {
                console.log('[ChatEventManager] Chat data fetched successfully');
                this.triggerChatEvent('chat:loaded', data);
            });

            // API fetch error
            $(document).on('chatapi:fetch-error', (e, data) => {
                console.error('[ChatEventManager] Chat fetch error:', data);
                this.triggerChatEvent('chat:error', data);
            });

            // Message sent event
            $(document).on('message:sent', (e, data) => {
                console.log('[ChatEventManager] Message sent:', data);
                this.triggerChatEvent('chat:message-sent', data);
            });

            // Message received event
            $(document).on('message:received', (e, data) => {
                console.log('[ChatEventManager] Message received:', data);
                this.triggerChatEvent('chat:message-received', data);
            });

            console.log('[ChatEventManager] Custom event listeners attached');
        },

        /**
         * Setup cross-document messaging listeners (for external modules)
         * @private
         */
        setupPostMessageListeners: function() {
            console.log('[ChatEventManager] Setting up PostMessage listeners');

            // Handle messages from other windows/frames
            window.addEventListener('message', (event) => {
                // Verify origin for security (if needed)
                // if (event.origin !== window.location.origin) return;

                const { type, data } = event.data;

                console.log('[ChatEventManager] PostMessage received:', type, data);

                switch (type) {
                    case 'persona:added':
                        this.handlePersonaAdded(data);
                        break;
                    case 'persona:close':
                        this.handlePersonaModuleClose(data);
                        break;
                    case 'scenario:change':
                        this.handleScenarioChange(data);
                        break;
                    case 'display:message':
                        this.handleExternalDisplayMessage(data);
                        break;
                    case 'chat:action':
                        this.handleExternalChatAction(data);
                        break;
                }
            });

            console.log('[ChatEventManager] PostMessage listeners attached');
        },

        /**
         * Setup keyboard event listeners
         * @private
         */
        setupKeyboardListeners: function() {
            console.log('[ChatEventManager] Setting up keyboard listeners');

            $(document).on('keydown', (e) => {
                // Escape key to close dropdowns
                if (e.key === 'Escape') {
                    this.closeAllDropdowns();
                }

                // Ctrl/Cmd+Enter to send message
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    if ($(e.target).closest('#messageInput, .message-input').length) {
                        e.preventDefault();
                        this.handleMessageSubmit();
                    }
                }

                // Arrow up/down for input history in some contexts
                if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && 
                    $(e.target).closest('#messageInput, .message-input').length) {
                    if (window.ChatInputHandler && window.ChatInputHandler.navigateHistory) {
                        const direction = e.key === 'ArrowUp' ? -1 : 1;
                        window.ChatInputHandler.navigateHistory(direction);
                    }
                }
            });

            console.log('[ChatEventManager] Keyboard listeners attached');
        },

        /**
         * Handle message submission
         * @private
         */
        handleMessageSubmit: function() {
            console.log('[ChatEventManager] Message submission triggered');

            if (window.ChatInputHandler && window.ChatInputHandler.submitMessage) {
                try {
                    window.ChatInputHandler.submitMessage();
                } catch (error) {
                    console.error('[ChatEventManager] Error submitting message:', error);
                }
            } else if (window.sendMessage && typeof window.sendMessage === 'function') {
                // Fallback to old API
                try {
                    window.sendMessage();
                } catch (error) {
                    console.error('[ChatEventManager] Error calling legacy sendMessage:', error);
                }
            } else {
                console.warn('[ChatEventManager] No message submission handler available');
            }
        },

        /**
         * Handle input field keydown
         * @private
         */
        handleInputKeydown: function(e) {
            // Ctrl/Cmd+Enter submits
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.handleMessageSubmit();
                return;
            }

            // Prevent Tab from unfocusing
            if (e.key === 'Tab') {
                // Allow Tab for accessibility
                return;
            }
        },

        /**
         * Handle chat selection
         * @private
         */
        handleChatSelection: function(chatId) {
            console.log('[ChatEventManager] Chat selected:', chatId);

            // Update URL if using ChatRouter
            if (window.ChatRouter && window.ChatRouter.updateUrl) {
                window.ChatRouter.updateUrl(chatId);
            }

            // Fetch and display the chat
            const userId = window.userId || null;
            if (window.ChatAPIFetch && window.ChatAPIFetch.fetchChatData) {
                window.ChatAPIFetch.fetchChatData(chatId, userId, false, (response) => {
                    this.triggerChatEvent('chat:selected', { chatId, response });
                });
            }
        },

        /**
         * Handle dropdown toggle
         * @private
         */
        handleDropdownToggle: function(target) {
            console.log('[ChatEventManager] Dropdown toggle triggered');

            if (window.ChatDropdown && window.ChatDropdown.toggleDropdown) {
                window.ChatDropdown.toggleDropdown(target);
            }
        },

        /**
         * Handle message action (like, regenerate, copy, etc.)
         * @private
         */
        handleMessageAction: function(action, messageId, target) {
            console.log('[ChatEventManager] Message action triggered:', action, messageId);

            switch (action) {
                case 'like':
                    this.triggerChatEvent('message:like', { messageId });
                    break;
                case 'dislike':
                    this.triggerChatEvent('message:dislike', { messageId });
                    break;
                case 'regenerate':
                    this.triggerChatEvent('message:regenerate', { messageId });
                    break;
                case 'copy':
                    if (window.ChatSharing && window.ChatSharing.copyToClipboard) {
                        const text = $(target).closest('[data-message-id]').find('.message-text').text();
                        window.ChatSharing.copyToClipboard(text);
                    }
                    break;
                case 'share':
                    this.triggerChatEvent('message:share', { messageId });
                    break;
                case 'delete':
                    this.triggerChatEvent('message:delete', { messageId });
                    break;
            }
        },

        /**
         * Handle image action
         * @private
         */
        handleImageAction: function(action, imageId, target) {
            console.log('[ChatEventManager] Image action triggered:', action, imageId);

            switch (action) {
                case 'download':
                    this.triggerChatEvent('image:download', { imageId });
                    break;
                case 'upscale':
                    this.triggerChatEvent('image:upscale', { imageId });
                    break;
                case 'share':
                    this.triggerChatEvent('image:share', { imageId });
                    break;
                case 'reveal':
                    // Remove blur effect
                    $(target).closest('[data-image-id]').find('img').removeClass('blur-effect');
                    break;
            }
        },

        /**
         * Handle persona module added event
         * @private
         */
        handlePersonaAdded: function(data) {
            console.log('[ChatEventManager] Persona added:', data);
            this.triggerChatEvent('persona:added', data);
        },

        /**
         * Handle persona module close event
         * @private
         */
        handlePersonaModuleClose: function(data) {
            console.log('[ChatEventManager] Persona module closed');
            this.triggerChatEvent('persona:closed', data);
        },

        /**
         * Handle scenario change event
         * @private
         */
        handleScenarioChange: function(data) {
            console.log('[ChatEventManager] Scenario changed:', data);
            this.triggerChatEvent('scenario:changed', data);
        },

        /**
         * Handle external display message event
         * @private
         */
        handleExternalDisplayMessage: function(data) {
            console.log('[ChatEventManager] External display message:', data);
            if (window.ChatMessageDisplay && window.ChatMessageDisplay.displayMessage) {
                window.ChatMessageDisplay.displayMessage(data.sender, data.message, data.userChatId);
            }
        },

        /**
         * Handle external chat action
         * @private
         */
        handleExternalChatAction: function(data) {
            console.log('[ChatEventManager] External chat action:', data);
            this.triggerChatEvent('external:action', data);
        },

        /**
         * Close all open dropdowns
         * @private
         */
        closeAllDropdowns: function() {
            if (window.ChatDropdown && window.ChatDropdown.closeAllDropdowns) {
                window.ChatDropdown.closeAllDropdowns();
            } else {
                $('.dropdown-menu.show').removeClass('show');
            }
        },

        /**
         * Trigger a custom chat event
         * @param {string} eventName - The event name
         * @param {Object} data - Event data
         */
        triggerChatEvent: function(eventName, data) {
            console.log(`[ChatEventManager] Triggering event: ${eventName}`, data);
            $(document).trigger(`chat:${eventName}`, data);
        },

        /**
         * Register a custom event handler
         * @param {string} eventName - The event name to listen for
         * @param {Function} handler - The handler function
         */
        on: function(eventName, handler) {
            if (!this.customEventHandlers.has(eventName)) {
                this.customEventHandlers.set(eventName, []);
            }
            this.customEventHandlers.get(eventName).push(handler);
        },

        /**
         * Get statistics
         * @returns {Object} Statistics
         */
        getStats: function() {
            return {
                registeredListeners: this.registeredListeners.size,
                customEventHandlers: this.customEventHandlers.size
            };
        }
    };

    // Export to global scope
    window.ChatEventManager = ChatEventManager;

    // Auto-initialize on DOM ready if available
    if (typeof $ !== 'undefined' && typeof $(document).ready !== 'undefined') {
        $(document).ready(() => {
            if (window.ChatCore && window.ChatCore.initialized) {
                ChatEventManager.init();
            }
        });
    }

    console.log('[ChatEventManager] Module loaded successfully');

})(window);

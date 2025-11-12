/**
 * chat-api-fetch.js
 * Chat data fetching and initialization via API
 * Handles fetching chat data, user data, and setting up the chat interface
 * 
 * @version 1.0.0
 * @date November 12, 2025
 * @module ChatAPIFetch
 */

(function(window) {
    'use strict';

    /**
     * ChatAPIFetch - Handles all chat data fetching operations
     * Coordinates with ChatAPI for HTTP requests and ChatState for state management
     */
    const ChatAPIFetch = {
        // Fetch state tracking
        isFetching: false,
        lastFetchTime: 0,
        fetchCache: new Map(),

        /**
         * Fetch chat data from the server
         * @param {string} chatId - The chat ID to fetch
         * @param {string} userId - The user ID
         * @param {boolean} reset - Whether to reset the chat
         * @param {Function} callback - Callback when complete
         */
        fetchChatData: function(chatId, userId, reset, callback) {
            if (this.isFetching) {
                console.warn('[ChatAPIFetch] Already fetching, ignoring duplicate request');
                return;
            }

            this.isFetching = true;
            console.log(`[ChatAPIFetch] Fetching chat data for chatId: ${chatId}, userId: ${userId}`);

            // Build query parameters
            const params = new URLSearchParams({
                chatId: chatId,
                userId: userId
            });

            if (reset) {
                params.append('reset', 'true');
            }

            const endpoint = `/chat?${params.toString()}`;

            window.ChatAPI.makeRequest('GET', endpoint, null, {
                timeout: 30000,
                retries: 2,
                useCache: false
            })
            .then(response => {
                this.isFetching = false;
                console.log('[ChatAPIFetch] Chat data fetched successfully', response);
                
                // Handle success
                this.handleChatSuccess(response, reset, userId, chatId);
                
                // Trigger callback
                if (callback && typeof callback === 'function') {
                    callback(response);
                }
            })
            .catch(error => {
                this.isFetching = false;
                console.error('[ChatAPIFetch] Error fetching chat data:', error);
                
                // Show error message to user
                this.handleFetchError(error, callback);
            });
        },

        /**
         * Post new chat data to the server
         * @param {string} chatId - The chat ID
         * @param {string} userId - The user ID
         * @param {string} userChatId - The user chat ID
         * @param {boolean} reset - Whether to reset
         * @param {Function} callback - Callback when complete
         */
        postChatData: function(chatId, userId, userChatId, reset, callback) {
            if (this.isFetching) {
                console.warn('[ChatAPIFetch] Already posting, ignoring duplicate request');
                return;
            }

            this.isFetching = true;
            console.log('[ChatAPIFetch] Posting new chat data', {
                chatId,
                userId,
                userChatId,
                reset
            });

            const payload = {
                chatId: chatId,
                userId: userId,
                userChatId: userChatId,
                reset: reset || false
            };

            window.ChatAPI.makeRequest('POST', '/chat', payload, {
                timeout: 30000,
                retries: 2
            })
            .then(response => {
                this.isFetching = false;
                console.log('[ChatAPIFetch] Chat data posted successfully', response);
                
                // Handle success
                this.handleChatSuccess(response, reset, userId, userChatId);
                
                // Trigger callback
                if (callback && typeof callback === 'function') {
                    callback(response);
                }
            })
            .catch(error => {
                this.isFetching = false;
                console.error('[ChatAPIFetch] Error posting chat data:', error);
                
                // Show error message to user
                this.handleFetchError(error, callback);
            });
        },

        /**
         * Handle successful chat fetch
         * @param {Object} data - The response data
         * @param {boolean} reset - Whether this was a reset
         * @param {string} userId - The user ID
         * @param {string} userChatId - The user chat ID
         */
        handleChatSuccess: function(data, reset, userId, userChatId) {
            console.log('[ChatAPIFetch] Processing chat success response');

            try {
                // Update chat state with fetched data
                if (window.ChatState) {
                    window.ChatState.setState({
                        chatData: data.chat || {},
                        userChatId: data.userChatId || userChatId,
                        isNew: data.isNew !== false,
                        totalSteps: data.totalSteps || 0,
                        currentStep: data.currentStep || 0
                    });
                }

                // Setup the chat data for display
                this.setupChatData(data.chat);

                // Setup the chat interface
                this.setupChatInterface(data.chat, data.character);

                // Trigger success event
                $(document).trigger('chatapi:fetch-success', {
                    chat: data.chat,
                    character: data.character,
                    isNew: data.isNew
                });

            } catch (error) {
                console.error('[ChatAPIFetch] Error processing chat success:', error);
                throw error;
            }
        },

        /**
         * Setup chat data structures
         * @param {Object} chat - The chat object
         */
        setupChatData: function(chat) {
            if (!chat) {
                console.warn('[ChatAPIFetch] No chat data provided to setupChatData');
                return;
            }

            console.log('[ChatAPIFetch] Setting up chat data', chat);

            // Initialize chat structure if needed
            if (!chat.messages) {
                chat.messages = [];
            }

            if (!chat.history) {
                chat.history = [];
            }

            if (!chat.metadata) {
                chat.metadata = {};
            }

            // Update global chat state if available
            if (window.chatId) {
                window.chatId = chat.id || window.chatId;
            }

            if (window.currentStep !== undefined) {
                window.currentStep = chat.currentStep || 0;
            }

            if (window.totalSteps !== undefined) {
                window.totalSteps = chat.totalSteps || 0;
            }
        },

        /**
         * Setup the chat interface for display
         * @param {Object} chat - The chat object
         * @param {Object} character - The character/persona object
         */
        setupChatInterface: function(chat, character) {
            if (!chat) {
                console.warn('[ChatAPIFetch] No chat provided to setupChatInterface');
                return;
            }

            console.log('[ChatAPIFetch] Setting up chat interface');

            // Show the chat container
            if (window.ChatNavigation && window.ChatNavigation.showChat) {
                window.ChatNavigation.showChat();
            } else {
                // Fallback: show chat manually
                $('#chatContainer').show();
                $('#discoveryContainer').hide();
            }

            // Clear existing messages if reset
            if (window.ChatMessageDisplay && window.ChatMessageDisplay.clearChatDisplay) {
                window.ChatMessageDisplay.clearChatDisplay();
            }

            // Display the chat history
            if (window.ChatMessageDisplay && window.ChatMessageDisplay.displayExistingChat) {
                window.ChatMessageDisplay.displayExistingChat(chat, character);
            }

            // Setup input handler if available
            if (window.ChatInputHandler && window.ChatInputHandler.init) {
                window.ChatInputHandler.init({ maxInputLength: 4000 });
            }

            // Trigger interface ready event
            $(document).trigger('chatapi:interface-ready', { chat, character });
        },

        /**
         * Handle fetch errors
         * @param {Error} error - The error that occurred
         * @param {Function} callback - Error callback
         */
        handleFetchError: function(error, callback) {
            console.error('[ChatAPIFetch] Handling fetch error:', error);

            // Show error to user
            let errorMessage = error.message || 'Failed to load chat data';
            
            if (error.type === 'network') {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.status === 401) {
                errorMessage = 'Your session has expired. Please log in again.';
            } else if (error.status === 404) {
                errorMessage = 'Chat not found.';
            }

            // Display error message
            if (window.showNotification) {
                window.showNotification(errorMessage, 'error');
            } else {
                alert(errorMessage);
            }

            // Trigger error event
            $(document).trigger('chatapi:fetch-error', { error });

            // Call error callback if provided
            if (callback && typeof callback === 'function') {
                callback(null, error);
            }
        },

        /**
         * Get chat history
         * @param {string} chatId - The chat ID
         * @param {number} limit - Maximum messages to fetch
         * @param {number} offset - Offset for pagination
         * @returns {Promise} Chat history
         */
        getChatHistory: function(chatId, limit = 50, offset = 0) {
            const endpoint = `/chat/${chatId}/history?limit=${limit}&offset=${offset}`;
            
            return window.ChatAPI.makeRequest('GET', endpoint, null, {
                useCache: true,
                cacheKey: `history:${chatId}:${limit}:${offset}`
            })
            .then(response => {
                console.log('[ChatAPIFetch] Chat history fetched:', response);
                return response;
            })
            .catch(error => {
                console.error('[ChatAPIFetch] Error fetching chat history:', error);
                throw error;
            });
        },

        /**
         * Save message to chat
         * @param {string} chatId - The chat ID
         * @param {Object} message - The message to save
         * @returns {Promise} Save result
         */
        saveMessage: function(chatId, message) {
            const endpoint = `/chat/${chatId}/message`;
            
            return window.ChatAPI.makeRequest('POST', endpoint, message, {
                timeout: 30000,
                retries: 2
            })
            .then(response => {
                console.log('[ChatAPIFetch] Message saved successfully:', response);
                return response;
            })
            .catch(error => {
                console.error('[ChatAPIFetch] Error saving message:', error);
                throw error;
            });
        },

        /**
         * Get chat statistics
         * @returns {Object} Statistics
         */
        getStats: function() {
            return {
                isFetching: this.isFetching,
                lastFetchTime: this.lastFetchTime,
                cacheSize: this.fetchCache.size
            };
        },

        /**
         * Clear all cached fetch data
         */
        clearCache: function() {
            this.fetchCache.clear();
            console.log('[ChatAPIFetch] Cache cleared');
        }
    };

    // Export to global scope
    window.ChatAPIFetch = ChatAPIFetch;

    console.log('[ChatAPIFetch] Module loaded successfully');

})(window);

/**
 * ChatSuggestionsAPI Module
 * Handles all API communication for suggestions
 * 
 * @module ChatSuggestionsAPI
 * @requires jQuery
 */

window.ChatSuggestionsAPI = (function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const config = {
        apiUrl: typeof API_URL !== 'undefined' ? API_URL : '',
        endpoints: {
            getSuggestions: '/api/chat-suggestions',
            sendSuggestion: '/api/chat-suggestions/send',
            updatePreferences: '/api/chat-suggestions/preferences'
        },
        timeout: 5000
    };

    // ==================== PRIVATE UTILITIES ====================

    /**
     * Build full API URL
     * @private
     * @param {string} endpoint - Endpoint path
     * @returns {string} Full API URL
     */
    function buildUrl(endpoint) {
        return config.apiUrl + endpoint;
    }

    /**
     * Handle AJAX errors
     * @private
     * @param {Object} error - Error object
     * @param {string} context - Context string for logging
     */
    function handleError(error, context) {
        console.error(`[ChatSuggestionsAPI] ${context}:`, error);
    }

    // ==================== PUBLIC API ====================
    return {
        /**
         * Fetch suggestions from server
         * @function fetchSuggestions
         * @param {string} userId - User ID
         * @param {string} chatId - Chat ID
         * @param {string} userChatId - User chat ID
         * @returns {Promise<Object>} Response object with suggestions
         */
        fetchSuggestions: async function(userId, chatId, userChatId) {
            try {
                if (!userId || !chatId || !userChatId) {
                    throw new Error('Missing required parameters: userId, chatId, userChatId');
                }

                const response = await $.ajax({
                    url: buildUrl(config.endpoints.getSuggestions),
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        userId: userId,
                        chatId: chatId,
                        userChatId: userChatId
                    }),
                    timeout: config.timeout
                });

                return response;
            } catch (error) {
                handleError(error, 'fetchSuggestions');
                return {
                    success: false,
                    error: error.message
                };
            }
        },

        /**
         * Send a suggestion as a message
         * @function sendSuggestion
         * @param {string} userId - User ID
         * @param {string} chatId - Chat ID
         * @param {string} userChatId - User chat ID
         * @param {string} message - Message text
         * @returns {Promise<Object>} Response from server
         */
        sendSuggestion: async function(userId, chatId, userChatId, message) {
            try {
                if (!userId || !chatId || !userChatId || !message) {
                    throw new Error('Missing required parameters');
                }

                const response = await $.ajax({
                    url: buildUrl(config.endpoints.sendSuggestion),
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        userId: userId,
                        chatId: chatId,
                        userChatId: userChatId,
                        message: message
                    }),
                    timeout: config.timeout
                });

                return response;
            } catch (error) {
                handleError(error, 'sendSuggestion');
                return {
                    success: false,
                    error: error.message
                };
            }
        },

        /**
         * Update user suggestions preferences
         * @function updatePreferences
         * @param {string} userId - User ID
         * @param {Object} options - Options object
         * @param {boolean} options.disabled - Whether to disable suggestions
         * @param {string} options.chatId - Optional specific chat ID
         * @returns {Promise<Object>} Response from server
         */
        updatePreferences: async function(userId, options = {}) {
            try {
                if (!userId) {
                    throw new Error('Missing userId');
                }

                const response = await $.ajax({
                    url: buildUrl(config.endpoints.updatePreferences),
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        userId: userId,
                        chatId: options.chatId || null,
                        disableSuggestions: options.disabled || false
                    }),
                    timeout: config.timeout
                });

                return response;
            } catch (error) {
                handleError(error, 'updatePreferences');
                return {
                    success: false,
                    error: error.message
                };
            }
        },

        /**
         * Get the API base URL
         * @function getApiUrl
         * @returns {string} API base URL
         */
        getApiUrl: function() {
            return config.apiUrl;
        },

        /**
         * Set the API base URL (for testing or alternative endpoints)
         * @function setApiUrl
         * @param {string} url - New API base URL
         */
        setApiUrl: function(url) {
            config.apiUrl = url;
        }
    };
})();

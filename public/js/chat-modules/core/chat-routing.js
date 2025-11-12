/**
 * chat-routing.js
 * URL parsing and route management for the chat application
 * Handles URL extraction, session storage, and route detection
 * 
 * @version 1.0.0
 * @date November 12, 2025
 */

(function(window) {
    'use strict';

    /**
     * ChatRouter - URL routing and navigation management
     */
    const ChatRouter = {
        // Session storage keys
        STORAGE_KEYS: {
            LAST_CHAT_ID: 'lastChatId',
            CHAT_ID: 'chatId',
            USER_CHAT_ID: 'userChatId',
            REDIRECT_URL: 'redirect_url'
        },

        /**
         * Extract chat ID from URL
         * Looks for pattern: /chat/[a-zA-Z0-9]+
         * @param {string} url - URL to parse (defaults to window.location.href)
         * @returns {string|null} - Chat ID or null if not found
         */
        getIdFromUrl: function(url) {
            if (!url) return null;
            const regex = /\/chat\/([a-zA-Z0-9]+)/;
            const match = url.match(regex);
            return match && match[1] ? match[1] : null;
        },

        /**
         * Get current chat ID from multiple sources with fallback
         * Priority: 1) URL, 2) Session Storage, 3) Cookies
         * @returns {string|null} - Current chat ID
         */
        getCurrentChatId: function() {
            // Try URL first
            let chatId = this.getIdFromUrl(window.location.href);
            if (this.isValidId(chatId)) return chatId;

            // Try session storage
            chatId = sessionStorage.getItem(this.STORAGE_KEYS.LAST_CHAT_ID);
            if (this.isValidId(chatId)) return chatId;

            // Try cookies as last resort
            const redirectUrl = $.cookie(this.STORAGE_KEYS.REDIRECT_URL);
            chatId = this.getIdFromUrl(redirectUrl);
            if (this.isValidId(chatId)) return chatId;

            return null;
        },

        /**
         * Check if ID is valid (not falsy, not string 'null' or 'undefined')
         * @param {*} id - ID to validate
         * @returns {boolean}
         */
        isValidId: function(id) {
            return id && id !== 'null' && id !== 'undefined' && typeof id === 'string' && id.length > 0;
        },

        /**
         * Save chat ID to session storage
         * @param {string} chatId - Chat ID to save
         */
        saveCurrentChatId: function(chatId) {
            if (this.isValidId(chatId)) {
                sessionStorage.setItem(this.STORAGE_KEYS.LAST_CHAT_ID, chatId);
                sessionStorage.setItem(this.STORAGE_KEYS.CHAT_ID, chatId);
                console.log('[ChatRouter] Saved chat ID:', chatId);
            }
        },

        /**
         * Save user chat ID to session storage
         * @param {string} userChatId - User chat ID to save
         */
        saveUserChatId: function(userChatId) {
            if (userChatId) {
                sessionStorage.setItem(this.STORAGE_KEYS.USER_CHAT_ID, userChatId);
                console.log('[ChatRouter] Saved user chat ID:', userChatId);
            }
        },

        /**
         * Get user chat ID from session storage
         * @returns {string|null}
         */
        getUserChatId: function() {
            return sessionStorage.getItem(this.STORAGE_KEYS.USER_CHAT_ID);
        },

        /**
         * Update URL without page reload
         * @param {string} newChatId - New chat ID for URL
         */
        updateUrl: function(newChatId) {
            const currentUrl = window.location.href;
            const urlParts = currentUrl.split('/');
            urlParts[urlParts.length - 1] = newChatId;
            const newUrl = urlParts.join('/');
            window.history.pushState({ path: newUrl }, '', newUrl);
        },

        /**
         * Reset URL to base (remove chat ID)
         */
        resetUrl: function() {
            const currentUrl = window.location.href;
            const urlParts = currentUrl.split('/');
            urlParts[urlParts.length - 1] = '';
            const newUrl = urlParts.join('/');
            window.history.pushState({ path: newUrl }, '', newUrl);
            sessionStorage.setItem(this.STORAGE_KEYS.LAST_CHAT_ID, null);
        }
    };

    // Expose to global scope
    window.ChatRouter = ChatRouter;

    console.log('[ChatRouter] Module loaded successfully');

})(window);

/**
 * chat-state.js
 * Central state management for the chat application
 * Handles global state initialization, getters, setters, and validation
 * 
 * @version 1.0.0
 * @date November 12, 2025
 */

(function(window) {
    'use strict';

    /**
     * ChatState - Centralized state management
     * Maintains all global state variables and provides controlled access
     */
    const ChatState = {
        // Core chat identifiers
        chatId: null,
        userChatId: null,
        userId: null,

        // Chat metadata
        chatName: null,
        chatData: [],
        totalSteps: 0,
        currentStep: 0,

        // Character/Persona information
        persona: null,
        character: {},
        chatImageUrl: null,
        thumbnail: false,

        // Chat status flags
        isNew: true,
        feedback: false,
        isTemporary: false,

        // UI state
        language: 'ja',
        subscriptionStatus: false,

        // Tracking sets
        displayedMessageIds: new Set(),
        displayedImageIds: new Set(),
        displayedVideoIds: new Set(),

        /**
         * Initialize the state with provided data
         * @param {Object} initialData - Initial state data
         */
        init: function(initialData = {}) {
            Object.keys(initialData).forEach(key => {
                if (key in this && typeof this[key] !== 'function') {
                    this[key] = initialData[key];
                }
            });
            console.log('[ChatState] Initialized with data:', initialData);
            return this;
        },

        /**
         * Reset state to initial values
         */
        reset: function() {
            this.chatId = null;
            this.userChatId = null;
            this.chatName = null;
            this.chatData = [];
            this.totalSteps = 0;
            this.currentStep = 0;
            this.persona = null;
            this.character = {};
            this.isNew = true;
            this.feedback = false;
            this.displayedMessageIds.clear();
            this.displayedImageIds.clear();
            this.displayedVideoIds.clear();
            console.log('[ChatState] Reset to initial state');
            return this;
        },

        /**
         * Validate the current state
         * @returns {boolean} - True if state is valid
         */
        validateState: function() {
            const required = ['chatId', 'userId'];
            const missing = required.filter(key => !this[key]);
            
            if (missing.length > 0) {
                console.warn('[ChatState] Missing required fields:', missing);
                return false;
            }
            return true;
        },

        /**
         * Get current state as object
         * @returns {Object} - Current state
         */
        getState: function() {
            return {
                chatId: this.chatId,
                userChatId: this.userChatId,
                userId: this.userId,
                chatName: this.chatName,
                persona: this.persona,
                character: this.character,
                isNew: this.isNew,
                language: this.language,
                subscriptionStatus: this.subscriptionStatus,
                isTemporary: this.isTemporary
            };
        },

        /**
         * Set multiple state values at once
         * @param {Object} updates - Object containing state updates
         */
        setState: function(updates = {}) {
            Object.keys(updates).forEach(key => {
                if (key in this && typeof this[key] !== 'function') {
                    this[key] = updates[key];
                }
            });
            return this;
        },

        /**
         * Add a message ID to tracking set
         * @param {string} messageId - Message ID to track
         */
        addDisplayedMessageId: function(messageId) {
            this.displayedMessageIds.add(messageId);
        },

        /**
         * Check if message ID was already displayed
         * @param {string} messageId - Message ID to check
         * @returns {boolean}
         */
        isMessageDisplayed: function(messageId) {
            return this.displayedMessageIds.has(messageId);
        },

        /**
         * Clear all tracking sets
         */
        clearTrackingSets: function() {
            this.displayedMessageIds.clear();
            this.displayedImageIds.clear();
            this.displayedVideoIds.clear();
        }
    };

    // Expose to global scope
    window.ChatState = ChatState;

    console.log('[ChatState] Module loaded successfully');

})(window);

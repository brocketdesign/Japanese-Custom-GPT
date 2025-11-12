/**
 * ChatSuggestionsManager Module
 * Main suggestions manager handling state, events, and coordination
 * 
 * @module ChatSuggestionsManager
 * @requires jQuery
 * @requires ChatSuggestionsContainer
 * @requires ChatSuggestionsAPI
 */

window.ChatSuggestionsManager = (function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const config = {
        suggestionsPerChatLimit: 5,
        userMessageSelector: '#userMessage',
        documentSelector: document,
        enableSwitchSelector: '#suggestions-enable-switch'
    };

    // ==================== PRIVATE STATE ====================
    let currentSuggestions = [];
    let isVisible = false;
    let isEnabled = true;
    let suggestionCountPerChat = new Map();

    /**
     * Check if suggestions should be shown based on conditions
     * @private
     * @param {string} chatId - Chat ID for limit check
     * @returns {boolean} True if suggestions can be shown
     */
    function canShowSuggestions(chatId) {
        // Don't show if disabled
        if (!isEnabled) {
            return false;
        }

        // Don't show if user is typing
        const userInput = $(config.userMessageSelector).val();
        if (userInput && userInput.trim().length > 0) {
            return false;
        }

        // Check subscription status and suggestion limits
        const subscriptionStatus = (typeof window.user !== 'undefined' && 
                                   window.user.subscriptionStatus === 'active');
        const currentCount = suggestionCountPerChat.get(chatId) || 0;

        // Limit to 5 suggestions per chat for non-subscribed users
        if (!subscriptionStatus && currentCount >= config.suggestionsPerChatLimit) {
            console.log('[ChatSuggestionsManager] Suggestion limit reached for non-subscribed user');
            return false;
        }

        return true;
    }

    /**
     * Attach DOM event listeners
     * @private
     */
    function attachEventListeners() {
        // Close button
        $(document).on('click', '.suggestions-close', function() {
            hideSuggestions();
        });

        // Suggestion click handler
        $(document).on('click', '.suggestion-item', function() {
            const suggestion = $(this).data('suggestion');
            if (suggestion) {
                selectSuggestion(suggestion);
            }
        });

        // Hide suggestions when user starts typing
        $(config.userMessageSelector).on('input', function() {
            if (isVisible && $(this).val().trim().length > 0) {
                hideSuggestions();
            }
        });

        // Hide suggestions when user sends a manual message
        $(document).on('chat:messageSent', function() {
            hideSuggestions();
        });

        // Settings toggle handler
        $(document).on('change', config.enableSwitchSelector, function() {
            setEnabled($(this).prop('checked'));
        });

        // Load settings when settings modal opens
        $(document).on('settings:loaded', function(e, settings) {
            loadSettings(settings);
        });
    }

    /**
     * Display suggestions
     * @private
     * @param {Array<string>} suggestions - Array of suggestion strings
     */
    function displaySuggestions(suggestions) {
        if (typeof ChatSuggestionsContainer === 'undefined') {
            console.error('[ChatSuggestionsManager] ChatSuggestionsContainer not available');
            return;
        }

        currentSuggestions = suggestions;
        ChatSuggestionsContainer.populate(suggestions);
    }

    /**
     * Show suggestions container
     * @private
     */
    function showSuggestions() {
        if (currentSuggestions.length === 0) {
            return;
        }

        if (typeof ChatSuggestionsContainer === 'undefined') {
            console.error('[ChatSuggestionsManager] ChatSuggestionsContainer not available');
            return;
        }

        ChatSuggestionsContainer.show();
        isVisible = true;
    }

    /**
     * Hide suggestions container
     * @private
     */
    function hideSuggestions() {
        if (!isVisible) {
            return;
        }

        if (typeof ChatSuggestionsContainer === 'undefined') {
            return;
        }

        ChatSuggestionsContainer.hide();
        isVisible = false;
        currentSuggestions = [];
    }

    /**
     * Handle suggestion selection and sending
     * @private
     * @param {string} suggestion - Selected suggestion text
     */
    async function selectSuggestion(suggestion) {
        try {
            // Hide suggestions
            hideSuggestions();

            // Increment suggestion count for this chat
            const chatId = sessionStorage.getItem('chatId') || window.chatId;
            if (chatId) {
                const currentCount = suggestionCountPerChat.get(chatId) || 0;
                suggestionCountPerChat.set(chatId, currentCount + 1);
            }

            // Fill the message input
            $(config.userMessageSelector).val(suggestion);

            // Send the suggested message
            await sendSuggestedMessage(suggestion);

        } catch (error) {
            console.error('[ChatSuggestionsManager] Error selecting suggestion:', error);
        }
    }

    /**
     * Send a suggested message via API and chat system
     * @private
     * @param {string} message - Message to send
     */
    async function sendSuggestedMessage(message) {
        try {
            // Get current chat context
            const userId = window.userId || (typeof user !== 'undefined' ? user._id : null);
            const chatId = sessionStorage.getItem('chatId') || window.chatId;
            const userChatId = sessionStorage.getItem('userChatId') || window.userChatId;

            if (!userId || !chatId || !userChatId) {
                console.error('[ChatSuggestionsManager] Missing chat context');
                return;
            }

            // Send via API
            if (typeof ChatSuggestionsAPI !== 'undefined') {
                const response = await ChatSuggestionsAPI.sendSuggestion(
                    userId,
                    chatId,
                    userChatId,
                    message
                );

                if (!response.success) {
                    console.error('[ChatSuggestionsManager] API error:', response.error);
                }
            }

            // Display message in chat
            if (typeof displayMessage === 'function') {
                displayMessage('user', message, userChatId);
            }

            // Clear input
            $(config.userMessageSelector).val('');

            // Trigger completion
            if (typeof generateChatCompletion === 'function') {
                generateChatCompletion();
            }

            // Trigger custom event
            $(document).trigger('chat:suggestionSent', { message: message });

        } catch (error) {
            console.error('[ChatSuggestionsManager] Error sending suggested message:', error);
        }
    }

    /**
     * Set enabled state
     * @private
     * @param {boolean} enabled - Whether to enable suggestions
     */
    async function setEnabled(enabled) {
        isEnabled = enabled;

        // Update preferences on server
        if (typeof ChatSuggestionsAPI !== 'undefined') {
            const userId = window.userId || (typeof user !== 'undefined' ? user._id : null);
            if (userId) {
                await ChatSuggestionsAPI.updatePreferences(userId, {
                    disabled: !enabled
                });
            }
        }

        // Hide current suggestions if disabled
        if (!enabled && isVisible) {
            hideSuggestions();
        }
    }

    /**
     * Load settings from object
     * @private
     * @param {Object} settings - Settings object
     */
    function loadSettings(settings) {
        if (settings && typeof settings.disableSuggestions === 'boolean') {
            isEnabled = !settings.disableSuggestions;
            $(config.enableSwitchSelector).prop('checked', isEnabled);
        }
    }

    // ==================== PUBLIC API ====================
    return {
        /**
         * Initialize the suggestions manager
         * @function init
         */
        init: function() {
            attachEventListeners();
            console.log('[ChatSuggestionsManager] Initialized');
        },

        /**
         * Show suggestions after assistant message
         * @function show
         * @param {string} userId - User ID
         * @param {string} chatId - Chat ID
         * @param {string} userChatId - User chat ID
         */
        show: async function(userId, chatId, userChatId) {
            try {
                if (!canShowSuggestions(chatId)) {
                    return;
                }

                if (typeof ChatSuggestionsAPI === 'undefined') {
                    console.error('[ChatSuggestionsManager] ChatSuggestionsAPI not available');
                    return;
                }

                const response = await ChatSuggestionsAPI.fetchSuggestions(
                    userId,
                    chatId,
                    userChatId
                );

                if (response.success && response.suggestions && response.suggestions.length > 0) {
                    displaySuggestions(response.suggestions);
                    showSuggestions();
                }

            } catch (error) {
                console.error('[ChatSuggestionsManager] Error showing suggestions:', error);
            }
        },

        /**
         * Hide suggestions
         * @function hide
         */
        hide: function() {
            hideSuggestions();
        },

        /**
         * Check if suggestions are currently visible
         * @function isShowing
         * @returns {boolean} True if visible
         */
        isShowing: function() {
            return isVisible;
        },

        /**
         * Get current suggestions
         * @function getSuggestions
         * @returns {Array<string>} Current suggestions
         */
        getSuggestions: function() {
            return currentSuggestions;
        },

        /**
         * Check if suggestions are enabled
         * @function isEnabled
         * @returns {boolean} True if enabled
         */
        isEnabled: function() {
            return isEnabled;
        },

        /**
         * Set enabled state
         * @function setEnabled
         * @param {boolean} enabled - Whether to enable
         */
        setEnabled: function(enabled) {
            setEnabled(enabled);
        },

        /**
         * Get suggestion count for a chat
         * @function getCountForChat
         * @param {string} chatId - Chat ID
         * @returns {number} Number of suggestions shown for this chat
         */
        getCountForChat: function(chatId) {
            return suggestionCountPerChat.get(chatId) || 0;
        },

        /**
         * Reset suggestion counts
         * @function resetCounts
         */
        resetCounts: function() {
            suggestionCountPerChat.clear();
        },

        /**
         * Debug: Show dummy suggestions
         * @function debug_showDummySuggestions
         */
        debug_showDummySuggestions: function() {
            const dummySuggestions = [
                'はい、分かりました (Yes, I understand)',
                'もう少し詳しく教えてください (Please tell me more details)',
                'ありがとうございます (Thank you)',
                '質問があります (I have a question)',
                'それは面白いですね (That\'s interesting)'
            ];

            displaySuggestions(dummySuggestions);
            showSuggestions();
        }
    };
})();

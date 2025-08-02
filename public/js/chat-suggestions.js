/**
 * Chat Suggestions Manager
 * Handles displaying and managing user response suggestions in chat
 */
class ChatSuggestionsManager {
    constructor() {
        this.suggestionsContainer = null;
        this.currentSuggestions = [];
        this.isVisible = false;
        this.isEnabled = true; // Default enabled state
        this.suggestionCountPerChat = new Map(); // Track usage per chat
        this.init();
    }

    /**
     * Initialize the suggestions manager
     */
    init() {
        this.attachEventListeners();
    }

    /**
     * Create the suggestions container HTML structure
     */
    createSuggestionsContainer() {
        // Remove existing container if it exists
        $('#chat-suggestions-container').remove();

        // Create the suggestions container
        const containerHtml = `
            <div id="chat-suggestions-container" class="suggestions-container shadow-0 w-100" style="display: none;">
                <div class="suggestions-header">
                    <span class="suggestions-title">${window.translations?.suggestions_title || 'Quick responses'}</span>
                    <button class="suggestions-close" aria-label="Close suggestions">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
                <div class="suggestions-list" id="chat-suggestions-list">
                    <!-- Suggestions will be populated here -->
                </div>
            </div>
        `;

        // Append to the end of chat container
        $('#chatContainer').append(containerHtml);
        this.suggestionsContainer = $('#chat-suggestions-container');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close button
        $(document).on('click', '.suggestions-close', () => {
            this.hide();
        });

        // Suggestion click handler
        $(document).on('click', '.suggestion-item', (e) => {
            const suggestion = $(e.currentTarget).data('suggestion');
            if (suggestion) {
                this.selectSuggestion(suggestion);
            }
        });

        // Hide suggestions when user starts typing
        $('#userMessage').on('input', () => {
            if (this.isVisible && $('#userMessage').val().trim().length > 0) {
                this.hide();
            }
        });

        // Hide suggestions when user sends a manual message
        $(document).on('chat:messageSent', () => {
            this.hide();
        });

        // Settings toggle handler
        $(document).on('change', '#suggestions-enable-switch', (e) => {
            this.setEnabled(e.target.checked);
        });

        // Load settings when settings modal opens
        $(document).on('settings:loaded', (e, settings) => {
            this.loadSettings(settings);
        });
    }

    /**
     * Show suggestions after assistant message completion
     * @param {string} userId - User ID
     * @param {string} chatId - Chat ID
     * @param {string} userChatId - User chat ID
     */
    async showSuggestions(userId, chatId, userChatId) {
        try {
            // Don't show if disabled
            if (!this.isEnabled) {
                return;
            }

            // Don't show if user is typing
            if ($('#userMessage').val().trim().length > 0) {
                return;
            }

            // Check subscription status and suggestion limits
            const subscriptionStatus = window.user?.subscriptionStatus === 'active';
            const currentCount = this.suggestionCountPerChat.get(chatId) || 0;
            
            // Limit to 5 suggestions per chat for non-subscribed users
            if (!subscriptionStatus && currentCount >= 5) {
                console.log('[ChatSuggestions] Suggestion limit reached for non-subscribed user');
                return;
            }

            // Request suggestions from API
            const response = await $.ajax({
                url: `${API_URL}/api/chat-suggestions`,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    userId: userId,
                    chatId: chatId,
                    userChatId: userChatId
                })
            });

            if (response.success && response.showSuggestions && response.suggestions?.length > 0) {
                this.currentSuggestions = response.suggestions;
                this.displaySuggestions(response.suggestions);
                this.show();
            }

        } catch (error) {
            console.error('[ChatSuggestions] Error fetching suggestions:', error);
        }
    }

    /**
     * Display suggestions in the UI
     * @param {Array} suggestions - Array of suggestion strings
     */
    displaySuggestions(suggestions) {
        // Ensure container exists before trying to display suggestions
        if (!this.suggestionsContainer || this.suggestionsContainer.length === 0) {
            this.createSuggestionsContainer();
        }

        const suggestionsListHtml = suggestions.map((suggestion, index) => `
            <div class="suggestion-item" data-suggestion="${this.escapeHtml(suggestion)}" tabindex="0">
                <span class="suggestion-text">${this.escapeHtml(suggestion)}</span>
                <div class="suggestion-hover-effect"></div>
            </div>
        `).join('');

        $('#chat-suggestions-list').html(suggestionsListHtml);
    }

    /**
     * Show the suggestions container
     */
    show() {
        if (!this.isVisible && this.currentSuggestions.length > 0) {
            // Create container if it doesn't exist
            if (!this.suggestionsContainer || this.suggestionsContainer.length === 0) {
                this.createSuggestionsContainer();
            }
            
            this.suggestionsContainer.fadeIn(200);
            this.isVisible = true;

            // Auto-hide after 30 seconds
            setTimeout(() => {
                if (this.isVisible) {
                    this.hide();
                }
            }, 60000);
        }
    }

    /**
     * Hide the suggestions container
     */
    hide() {
        if (this.isVisible) {
            this.suggestionsContainer.fadeOut(150, () => {
                // Remove container from DOM after fade out
                $('#chat-suggestions-container').remove();
                this.suggestionsContainer = null;
            });
            this.isVisible = false;
            this.currentSuggestions = [];
        }
    }

    /**
     * Handle suggestion selection
     * @param {string} suggestion - Selected suggestion text
     */
    async selectSuggestion(suggestion) {
        try {
            // Remove container immediately from DOM
            $('#chat-suggestions-container').remove();
            this.suggestionsContainer = null;
            this.isVisible = false;

            // Increment suggestion count for this chat
            const currentChatId = sessionStorage.getItem('chatId') || window.chatId;
            if (currentChatId) {
                const currentCount = this.suggestionCountPerChat.get(currentChatId) || 0;
                this.suggestionCountPerChat.set(currentChatId, currentCount + 1);
            }

            // Fill the message input
            $('#userMessage').val(suggestion);

            // Send the suggested message with suggestion flag
            await this.sendSuggestedMessage(suggestion);

        } catch (error) {
            console.error('[ChatSuggestions] Error selecting suggestion:', error);
        }
    }

    /**
     * Send a suggested message
     * @param {string} message - Message to send
     */
    async sendSuggestedMessage(message) {
        try {
            // Get current chat context
            const userId = window.userId || user._id;
            const currentChatId = sessionStorage.getItem('chatId') || window.chatId;
            const currentUserChatId = sessionStorage.getItem('userChatId') || window.userChatId;

            if (!userId || !currentChatId || !currentUserChatId) {
                console.error('[ChatSuggestions] Missing chat context');
                return;
            }

            // Send the suggestion through the API
            const response = await $.ajax({
                url: `${API_URL}/api/chat-suggestions/send`,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    userId: userId,
                    chatId: currentChatId,
                    userChatId: currentUserChatId,
                    message: message
                })
            });

            if (response.success) {
                // Display the message in chat
                displayMessage('user', message, currentUserChatId);

                // Clear the input
                $('#userMessage').val('');

                // Trigger chat completion
                if (window.generateChatCompletion) {
                    generateChatCompletion();
                }

                // Trigger custom event
                $(document).trigger('chat:suggestionSent', { message: message });
            }

        } catch (error) {
            console.error('[ChatSuggestions] Error sending suggested message:', error);
        }
    }

    /**
     * Update user preferences for suggestions
     * @param {boolean} disabled - Whether to disable suggestions
     * @param {string} chatId - Optional specific chat ID
     */
    async updatePreferences(disabled, chatId = null) {
        try {
            const userId = window.userId || user._id;

            await $.ajax({
                url: `${API_URL}/api/chat-suggestions/preferences`,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    userId: userId,
                    chatId: chatId,
                    disableSuggestions: disabled
                })
            });

        } catch (error) {
            console.error('[ChatSuggestions] Error updating preferences:', error);
        }
    }

    /**
     * Set enabled state and update preferences
     * @param {boolean} enabled - Whether suggestions are enabled
     */
    async setEnabled(enabled) {
        this.isEnabled = enabled;
        
        // Update preferences on server
        await this.updatePreferences(!enabled);
        
        // Hide current suggestions if disabled
        if (!enabled && this.isVisible) {
            this.hide();
        }
    }

    /**
     * Load settings from server/local storage
     * @param {Object} settings - Settings object
     */
    loadSettings(settings) {
        if (settings && typeof settings.disableSuggestions === 'boolean') {
            this.isEnabled = !settings.disableSuggestions;
            $('#suggestions-enable-switch').prop('checked', this.isEnabled);
        }
    }

    /**
     * Check if suggestions are currently visible
     * @returns {boolean} Whether suggestions are visible
     */
    isShowing() {
        return this.isVisible;
    }

    /**
     * Get current suggestions
     * @returns {Array} Current suggestions array
     */
    getCurrentSuggestions() {
        return this.currentSuggestions;
    }

    /**
     * Get current enabled state
     * @returns {boolean} Whether suggestions are enabled
     */
    isEnabledState() {
        return this.isEnabled;
    }

    /**
     * Debug function to show suggestions container with dummy entries
     * Call this from browser console: window.chatSuggestionsManager.debugShowSuggestions()
     */
    debugShowSuggestions() {
        // Create dummy suggestions
        const dummySuggestions = [
            "はい、分かりました (Yes, I understand)",
            "もう少し詳しく教えてください (Please tell me more details)",
            "ありがとうございます (Thank you)",
            "質問があります (I have a question)",
            "それは面白いですね (That's interesting)"
        ];

        // Set current suggestions first
        this.currentSuggestions = dummySuggestions;
        // Display suggestions (this will create container if needed)
        this.displaySuggestions(dummySuggestions);
        // Then show the container
        this.show();
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the suggestions manager
let chatSuggestionsManager;

$(document).ready(function() {
    chatSuggestionsManager = new ChatSuggestionsManager();
    
    // Make it globally accessible
    window.chatSuggestionsManager = chatSuggestionsManager;

    // Settings modal integration
    $(document).on('click', '#settings-save-btn', function() {
        // Trigger settings save event
        $(document).trigger('settings:save');
    });
});

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatSuggestionsManager;
}
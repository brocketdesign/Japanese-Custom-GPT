/**
 * ChatSuggestionsDisplay Module
 * Handles displaying and managing chat suggestions
 * 
 * @module ChatSuggestionsDisplay
 * @requires jQuery
 */

window.ChatSuggestionsDisplay = (function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const config = {
        suggestionsToggleSelector: '#suggestions-toggle',
        suggestionsContainerSelector: '#suggestionsContainer',
        suggestionsListSelector: '#suggestionsList',
        closeSuggestionsSelector: '#close-suggestionsContainer',
        suggestionCardSelector: '.suggestion-card',
        apiEndpoint: '/api/display-suggestions'
    };

    // ==================== PRIVATE STATE ====================
    let usedSuggestions = new Set();

    /**
     * Reset suggestions and hide the suggestions container
     * @private
     */
    function resetSuggestions() {
        usedSuggestions.clear();
        $(config.suggestionsListSelector).empty();
        $(config.suggestionsContainerSelector).slideUp();
        $(config.suggestionCardSelector).removeClass('active');
    }

    /**
     * Display loading state in suggestions container
     * @private
     */
    function showLoadingState() {
        const $container = $(config.suggestionsListSelector);
        const loadingText = (typeof translations !== 'undefined' && translations.loading) ? translations.loading : 'Loading';
        const loadingSuggestionsText = (typeof translations !== 'undefined' && translations.loading_suggestions) ? translations.loading_suggestions : 'Loading suggestions...';
        
        $container.html(`
            <div class="loading-spinner text-center mt-4 d-flex flex-column align-items-center justify-content-center">
                <div class="spinner-border mb-3" role="status">
                    <span class="visually-hidden">${loadingText}</span>
                </div>
                <p class="text-muted">${loadingSuggestionsText}</p>
            </div>
        `);
    }

    /**
     * Fetch suggestions from the server
     * @private
     * @param {string} userChatId - The user chat ID
     * @param {jQuery} $container - The container element
     */
    function fetchNewSuggestions(userChatId, $container) {
        showLoadingState();

        $.ajax({
            url: config.apiEndpoint,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                userChatId: userChatId,
                uniqueId: new Date().getTime(),
                excludeSuggestions: Array.from(usedSuggestions)
            }),
            success: function(response) {
                if (response.success && response.suggestions) {
                    displaySuggestions(response.suggestions, userChatId);
                } else {
                    showEmptySuggestions();
                }
            },
            error: function(xhr, status, error) {
                console.error('Error fetching suggestions:', error);
                showErrorState();
            }
        });
    }

    /**
     * Display suggestions in the container
     * @private
     * @param {Object} suggestions - Suggestions organized by category
     * @param {string} userChatId - The user chat ID
     */
    function displaySuggestions(suggestions, userChatId) {
        if (!suggestions || Object.keys(suggestions).length === 0) {
            showEmptySuggestions();
            return;
        }

        const $container = $(config.suggestionsListSelector);
        const ideasText = (typeof translations !== 'undefined' && translations.toolbar && translations.toolbar.ideas) ? translations.toolbar.ideas : 'Ideas';

        let html = `<h4 class="text-center w-100 mt-2">${ideasText}</h4>`;

        // Category configuration with emojis
        const categoryConfig = {
            chat: {
                emoji: '💬',
                title: (typeof translations !== 'undefined' && translations.suggestions && translations.suggestions.chat) ? translations.suggestions.chat : 'Chat'
            },
            feelings: {
                emoji: '💭',
                title: (typeof translations !== 'undefined' && translations.suggestions && translations.suggestions.feelings) ? translations.suggestions.feelings : 'Feelings'
            },
            image_request: {
                emoji: '🖼️',
                title: (typeof translations !== 'undefined' && translations.suggestions && translations.suggestions.image_request) ? translations.suggestions.image_request : 'Image Requests'
            }
        };

        // Build suggestion cards by category
        Object.keys(categoryConfig).forEach(categoryKey => {
            if (suggestions[categoryKey] && Array.isArray(suggestions[categoryKey]) && suggestions[categoryKey].length > 0) {
                const config = categoryConfig[categoryKey];
                html += `
                    <div class="suggestion-category-header mt-3 mb-2">
                        <h6 class="text-muted text-center">
                            ${config.emoji} ${config.title}
                        </h6>
                    </div>
                `;

                suggestions[categoryKey].forEach((suggestion) => {
                    html += `
                        <div class="suggestion-card w-100" data-suggestion="${escapeHtml(suggestion)}" data-category="${categoryKey}">
                            <div class="d-flex align-items-center">
                                <i class="bi bi-lightbulb suggestion-icon"></i>
                                <p class="suggestion-text flex-grow-1">${escapeHtml(suggestion)}</p>
                            </div>
                        </div>
                    `;
                });
            }
        });

        $container.html(html);
        attachSuggestionClickHandlers(userChatId);
    }

    /**
     * Attach click handlers to suggestion cards
     * @private
     * @param {string} userChatId - The user chat ID
     */
    function attachSuggestionClickHandlers(userChatId) {
        $(config.suggestionCardSelector).on('click', function() {
            const suggestion = $(this).find('.suggestion-text').text().trim();
            const $card = $(this);

            // Track used suggestion
            usedSuggestions.add(suggestion);

            // Send the message
            if (typeof sendMessage === 'function') {
                sendMessage(suggestion);
            }

            // Hide container
            $(config.suggestionsContainerSelector).slideUp();

            // Remove card with animation
            $card.fadeOut(300, function() {
                $card.remove();

                // Check if this was the last suggestion
                const remainingCards = $(config.suggestionsListSelector + ' ' + config.suggestionCardSelector);
                if (remainingCards.length === 0) {
                    fetchNewSuggestions(userChatId, $(config.suggestionsListSelector));
                }
            });
        });
    }

    /**
     * Show empty suggestions state
     * @private
     */
    function showEmptySuggestions() {
        const $container = $(config.suggestionsListSelector);
        const ideasText = (typeof translations !== 'undefined' && translations.toolbar && translations.toolbar.ideas) ? translations.toolbar.ideas : 'Ideas';
        const notFoundText = (typeof translations !== 'undefined' && translations.suggestionsNotFound) ? translations.suggestionsNotFound : 'No suggestions available';

        $container.html(`
            <div class="empty-suggestions">
                <i class="bi bi-lightbulb"></i>
                <h5>${ideasText}</h5>
                <p class="text-muted">${notFoundText}</p>
            </div>
        `);
    }

    /**
     * Show error state
     * @private
     */
    function showErrorState() {
        const $container = $(config.suggestionsListSelector);
        const errorText = (typeof translations !== 'undefined' && translations.error) ? translations.error : 'Error';
        const errorOccurredText = (typeof translations !== 'undefined' && translations.errorOccurred) ? translations.errorOccurred : 'An error occurred';

        $container.html(`
            <div class="empty-suggestions">
                <i class="bi bi-exclamation-triangle"></i>
                <h5>${errorText}</h5>
                <p class="text-muted">${errorOccurredText}</p>
            </div>
        `);
    }

    /**
     * Escape HTML special characters
     * @private
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Attach event listeners for suggestions container
     * @private
     */
    function attachEventListeners() {
        // Toggle suggestions container
        $(config.suggestionsToggleSelector).on('click', function() {
            const $container = $(config.suggestionsContainerSelector);
            $container.slideToggle();

            const $suggestionsList = $(config.suggestionsListSelector);
            if ($suggestionsList.find(config.suggestionCardSelector).length === 0) {
                const userChatId = sessionStorage.getItem('userChatId');
                if (userChatId) {
                    fetchNewSuggestions(userChatId, $suggestionsList);
                } else {
                    showEmptySuggestions();
                }
            }
        });

        // Close suggestions container
        $(config.closeSuggestionsSelector).on('click', function() {
            $(config.suggestionsContainerSelector).slideUp();
        });
    }

    // ==================== PUBLIC API ====================
    return {
        /**
         * Initialize the suggestions display module
         * @function init
         */
        init: function() {
            attachEventListeners();
        },

        /**
         * Reset suggestions and hide container
         * @function reset
         */
        reset: function() {
            resetSuggestions();
        },

        /**
         * Fetch new suggestions
         * @function fetch
         * @param {string} userChatId - The user chat ID
         */
        fetch: function(userChatId) {
            fetchNewSuggestions(userChatId, $(config.suggestionsListSelector));
        },

        /**
         * Display suggestions directly
         * @function display
         * @param {Object} suggestions - Suggestions to display
         * @param {string} userChatId - The user chat ID
         */
        display: function(suggestions, userChatId) {
            displaySuggestions(suggestions, userChatId);
        }
    };
})();

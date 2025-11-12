/**
 * ChatSuggestionsContainer Module
 * Manages the DOM container structure and visual display of suggestions
 * 
 * @module ChatSuggestionsContainer
 * @requires jQuery
 */

window.ChatSuggestionsContainer = (function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const config = {
        containerId: 'chat-suggestions-container',
        listId: 'chat-suggestions-list',
        chatContainerSelector: '#chatContainer',
        suggestionItemSelector: '.suggestion-item',
        suggestionCloseSelector: '.suggestions-close',
        userMessageSelector: '#userMessage'
    };

    // ==================== PRIVATE STATE ====================
    let containerElement = null;

    /**
     * Build HTML for suggestions container
     * @private
     * @returns {string} HTML string for container
     */
    function buildContainerHTML() {
        const title = (typeof window.chatSuggestionsTranslations !== 'undefined' && 
                      window.chatSuggestionsTranslations.suggestions_title) 
                      ? window.chatSuggestionsTranslations.suggestions_title 
                      : 'Quick responses';

        return `
            <div id="${config.containerId}" class="suggestions-container shadow-0" style="display: none;">
                <div class="suggestions-header">
                    <span class="suggestions-title">${escapeHtml(title)}</span>
                    <button class="suggestions-close" aria-label="Close suggestions">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
                <div class="suggestions-list" id="${config.listId}">
                    <!-- Suggestions will be populated here -->
                </div>
            </div>
        `;
    }

    /**
     * Build HTML for a single suggestion item
     * @private
     * @param {string} suggestion - Suggestion text
     * @param {number} index - Index of suggestion
     * @returns {string} HTML string for suggestion item
     */
    function buildSuggestionItemHTML(suggestion, index) {
        return `
            <div class="suggestion-item" data-suggestion="${escapeHtml(suggestion)}" data-index="${index}" tabindex="0">
                <span class="suggestion-text">${escapeHtml(suggestion)}</span>
                <div class="suggestion-hover-effect"></div>
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     * @private
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Create the suggestions container in the DOM
     * @private
     */
    function createContainer() {
        // Remove existing container if it exists
        $(`#${config.containerId}`).remove();

        // Create and append new container
        const html = buildContainerHTML();
        $(config.chatContainerSelector).append(html);
        containerElement = $(`#${config.containerId}`);
    }

    /**
     * Ensure container exists
     * @private
     */
    function ensureContainer() {
        if (!containerElement || containerElement.length === 0) {
            createContainer();
        }
    }

    // ==================== PUBLIC API ====================
    return {
        /**
         * Create and show suggestions container
         * @function create
         */
        create: function() {
            createContainer();
        },

        /**
         * Populate container with suggestions
         * @function populate
         * @param {Array<string>} suggestions - Array of suggestion strings
         */
        populate: function(suggestions) {
            ensureContainer();

            if (!Array.isArray(suggestions) || suggestions.length === 0) {
                $(`.${config.listId}`).html('');
                return;
            }

            const html = suggestions
                .map((suggestion, index) => buildSuggestionItemHTML(suggestion, index))
                .join('');

            $(`#${config.listId}`).html(html);
        },

        /**
         * Show the suggestions container with fade-in animation
         * @function show
         * @param {number} duration - Animation duration in milliseconds (default: 200)
         */
        show: function(duration = 200) {
            ensureContainer();
            containerElement.fadeIn(duration);
        },

        /**
         * Hide the suggestions container with fade-out animation
         * @function hide
         * @param {number} duration - Animation duration in milliseconds (default: 150)
         */
        hide: function(duration = 150) {
            if (containerElement && containerElement.length > 0) {
                containerElement.fadeOut(duration, function() {
                    $(`#${config.containerId}`).remove();
                    containerElement = null;
                });
            }
        },

        /**
         * Check if container is currently visible
         * @function isVisible
         * @returns {boolean} True if visible
         */
        isVisible: function() {
            return containerElement && containerElement.length > 0 && containerElement.is(':visible');
        },

        /**
         * Get the container element
         * @function getElement
         * @returns {jQuery} Container jQuery element
         */
        getElement: function() {
            ensureContainer();
            return containerElement;
        },

        /**
         * Clear all suggestions from container
         * @function clear
         */
        clear: function() {
            if (containerElement && containerElement.length > 0) {
                $(`#${config.listId}`).html('');
            }
        },

        /**
         * Remove the container from DOM completely
         * @function remove
         */
        remove: function() {
            $(`#${config.containerId}`).remove();
            containerElement = null;
        }
    };
})();

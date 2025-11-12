/**
 * ChatToolbarUI Module
 * Handles toolbar UI interactions, emoji tone selection, and text input
 * 
 * @module ChatToolbarUI
 * @requires jQuery
 */

window.ChatToolbarUI = (function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const config = {
        emojiToneBtnSelector: '#emoji-tone-btn',
        textInputToggleSelector: '#text-input-toggle',
        toolbarBackBtnSelector: '.toolbar-back-btn',
        emojiBtnSelector: '.emoji-btn',
        toolbarMainSelector: '#toolbar-main',
        toolbarContentViewSelector: '.toolbar-content-view',
        userMessageSelector: '#userMessage',
        chatContainerSelector: '#chatContainer'
    };

    /**
     * Show a specific toolbar content view with animation
     * @private
     * @param {string} viewId - The ID of the view to show
     */
    function showToolContentView(viewId) {
        const $toolbarMain = $(config.toolbarMainSelector);
        const $view = $('#' + viewId);

        // Hide main toolbar with animation
        $toolbarMain.addClass('animate__fadeOutLeft');
        setTimeout(() => {
            $toolbarMain.hide().removeClass('animate__fadeOutLeft');

            // Show selected view with animation
            $view.addClass('animate__fadeInRight').show();
        }, 200);
    }

    /**
     * Hide a toolbar content view and show main toolbar with animation
     * @private
     * @param {string} viewId - The ID of the view to hide
     */
    function hideToolContentView(viewId) {
        const $toolbarMain = $(config.toolbarMainSelector);
        const $view = $('#' + viewId);

        // Hide view with animation
        $view.addClass('animate__fadeOutLeft');
        setTimeout(() => {
            $view.hide().removeClass('animate__fadeInRight animate__fadeOutLeft');

            // Show main toolbar with animation
            $toolbarMain.addClass('animate__fadeInRight').show();
            setTimeout(() => {
                $toolbarMain.removeClass('animate__fadeInRight');
            }, 500);
        }, 200);
    }

    /**
     * Attach event listeners for toolbar interactions
     * @private
     */
    function attachToolbarEventListeners() {
        // Emoji tone button
        $(config.emojiToneBtnSelector).on('click', function() {
            showToolContentView('toolbar-emoji-tone');
        });

        // Text input toggle
        $(config.textInputToggleSelector).on('click', function() {
            showToolContentView('toolbar-text-input');
        });

        // Back buttons for all toolbar views
        $(config.toolbarBackBtnSelector).on('click', function() {
            const viewId = $(this).closest(config.toolbarContentViewSelector).attr('id');
            hideToolContentView(viewId);
        });

        // Emoji selection
        $(config.emojiBtnSelector).on('click', function() {
            const emoji = $(this).text();
            if (typeof sendMessage === 'function') {
                sendMessage(emoji);
            }
        });
    }

    /**
     * Attach scroll event to chat input
     * @private
     */
    function attachChatInputScroll() {
        $(config.userMessageSelector).on('focus', function() {
            const $chatContainer = $(config.chatContainerSelector);
            $chatContainer[0].scrollTo({
                top: $chatContainer[0].scrollHeight,
                behavior: 'smooth'
            });
        });
    }

    // ==================== PUBLIC API ====================
    return {
        /**
         * Initialize the toolbar UI module
         * @function init
         */
        init: function() {
            attachToolbarEventListeners();
            attachChatInputScroll();
        },

        /**
         * Show a toolbar content view
         * @function showToolContentView
         * @param {string} viewId - The ID of the view to show
         */
        showToolContentView: function(viewId) {
            showToolContentView(viewId);
        },

        /**
         * Hide a toolbar content view
         * @function hideToolContentView
         * @param {string} viewId - The ID of the view to hide
         */
        hideToolContentView: function(viewId) {
            hideToolContentView(viewId);
        }
    };
})();

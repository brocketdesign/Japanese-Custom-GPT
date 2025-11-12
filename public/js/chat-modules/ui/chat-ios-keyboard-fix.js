/**
 * ChatIOSKeyboardFix Module
 * Handles iOS Safari keyboard visibility and positioning issues
 * 
 * @module ChatIOSKeyboardFix
 * @requires jQuery
 */

window.ChatIOSKeyboardFix = (function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const config = {
        userMessageSelector: '#userMessage',
        chatInputSelector: '#chatInput',
        bodySelector: 'body',
        headSelector: 'head',
        keyboardOpenClass: 'keyboard-open'
    };

    // ==================== PRIVATE STATE ====================
    let viewportHeight = window.innerHeight;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    /**
     * Add CSS styles for iOS keyboard handling
     * @private
     */
    function addKeyboardStyles() {
        const styles = `
            body.${config.keyboardOpenClass} {
                height: 100vh;
                position: fixed;
                width: 100%;
                overflow: hidden;
            }
            
            body.${config.keyboardOpenClass} #chatInput {
                position: fixed;
                bottom: auto;
                top: 50%;
                z-index: 1050;
                background-color: rgba(252, 250, 255, 0.95);
                border-radius: 20px;
                padding: 10px;
                box-shadow: 0 -5px 15px rgba(0, 0, 0, 0.1);
                margin: 0 auto;
            }
        `;

        $(config.headSelector).append(`<style>${styles}</style>`);
    }

    /**
     * Reset chat input styling
     * @private
     */
    function resetChatInputStyles() {
        $(config.chatInputSelector).css({
            'position': '',
            'top': '',
            'bottom': '',
            'z-index': '',
            'background-color': '',
            'border-radius': '',
            'padding': '',
            'box-shadow': '',
            'margin': ''
        });
    }

    /**
     * Handle input focus (keyboard appears)
     * @private
     */
    function handleInputFocus() {
        $(config.bodySelector).addClass(config.keyboardOpenClass);
        viewportHeight = window.innerHeight;
    }

    /**
     * Handle input blur (keyboard disappears)
     * @private
     */
    function handleInputBlur() {
        $(config.bodySelector).removeClass(config.keyboardOpenClass);
        resetChatInputStyles();

        // Force viewport recalculation
        setTimeout(() => {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
        }, 100);
    }

    /**
     * Handle window resize and keyboard detection
     * @private
     */
    function handleWindowResize() {
        // If height is smaller, keyboard is likely visible
        if (window.innerHeight < viewportHeight && $(config.bodySelector).hasClass(config.keyboardOpenClass)) {
            // Calculate approximate keyboard height
            const keyboardHeight = viewportHeight - window.innerHeight;
            // Position the input above the keyboard with padding
            $(config.chatInputSelector).css({
                'top': `calc(100% - ${keyboardHeight + 120}px)`
            });
        } else if (window.innerHeight >= viewportHeight && !$(config.bodySelector).hasClass(config.keyboardOpenClass)) {
            // Keyboard disappeared, reset everything
            viewportHeight = window.innerHeight;
            resetChatInputStyles();
        }
    }

    /**
     * Attach iOS-specific event listeners
     * @private
     */
    function attachIOSEventListeners() {
        $(config.userMessageSelector).on('focus', handleInputFocus);
        $(config.userMessageSelector).on('blur', handleInputBlur);
        window.addEventListener('resize', handleWindowResize);
    }

    // ==================== PUBLIC API ====================
    return {
        /**
         * Initialize the iOS keyboard fix module
         * @function init
         */
        init: function() {
            if (!isIOS) {
                return;
            }

            addKeyboardStyles();
            attachIOSEventListeners();
        },

        /**
         * Check if running on iOS
         * @function isIOS
         * @returns {boolean} True if running on iOS
         */
        isIOS: function() {
            return isIOS;
        }
    };
})();

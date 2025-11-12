/**
 * ChatFooterInit Module
 * Orchestrates initialization of all footer-related modules
 * 
 * @module ChatFooterInit
 * @requires ChatAudio
 * @requires ChatSuggestionsDisplay
 * @requires ChatToolbarTranslator
 * @requires ChatToolbarUI
 * @requires ChatIOSKeyboardFix
 */

window.ChatFooterInit = (function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const config = {
        moduleInitTimeout: 100 // milliseconds between module initializations
    };

    // ==================== PRIVATE STATE ====================
    let isInitialized = false;
    const requiredModules = [
        'ChatAudio',
        'ChatSuggestionsDisplay',
        'ChatToolbarTranslator',
        'ChatToolbarUI',
        'ChatIOSKeyboardFix'
    ];

    /**
     * Verify all required modules are loaded
     * @private
     * @returns {boolean} True if all modules are available
     */
    function verifyModulesLoaded() {
        const missingModules = [];

        requiredModules.forEach(moduleName => {
            if (typeof window[moduleName] === 'undefined') {
                missingModules.push(moduleName);
            }
        });

        if (missingModules.length > 0) {
            console.error('ChatFooterInit: Missing required modules:', missingModules.join(', '));
            return false;
        }

        return true;
    }

    /**
     * Initialize all footer modules
     * @private
     */
    function initializeAllModules() {
        if (!verifyModulesLoaded()) {
            console.warn('ChatFooterInit: Waiting for modules to load...');
            setTimeout(initializeAllModules, 500);
            return;
        }

        try {
            // Initialize audio module
            if (typeof ChatAudio !== 'undefined' && ChatAudio.init) {
                ChatAudio.init();
                console.log('ChatFooterInit: ChatAudio initialized');
            }

            // Initialize suggestions display module
            if (typeof ChatSuggestionsDisplay !== 'undefined' && ChatSuggestionsDisplay.init) {
                ChatSuggestionsDisplay.init();
                console.log('ChatFooterInit: ChatSuggestionsDisplay initialized');
            }

            // Initialize toolbar translator module
            if (typeof ChatToolbarTranslator !== 'undefined' && ChatToolbarTranslator.init) {
                ChatToolbarTranslator.init();
                console.log('ChatFooterInit: ChatToolbarTranslator initialized');
            }

            // Initialize toolbar UI module
            if (typeof ChatToolbarUI !== 'undefined' && ChatToolbarUI.init) {
                ChatToolbarUI.init();
                console.log('ChatFooterInit: ChatToolbarUI initialized');
            }

            // Initialize iOS keyboard fix module
            if (typeof ChatIOSKeyboardFix !== 'undefined' && ChatIOSKeyboardFix.init) {
                ChatIOSKeyboardFix.init();
                console.log('ChatFooterInit: ChatIOSKeyboardFix initialized');
            }

            isInitialized = true;
            console.log('ChatFooterInit: All footer modules initialized successfully');
        } catch (error) {
            console.error('ChatFooterInit: Error initializing modules:', error);
        }
    }

    /**
     * Initialize on document ready
     * @private
     */
    function initializeOnReady() {
        if (typeof $ !== 'undefined') {
            $(document).ready(function() {
                initializeAllModules();
            });
        } else {
            // Fallback for non-jQuery environments
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initializeAllModules);
            } else {
                initializeAllModules();
            }
        }
    }

    // ==================== INITIALIZATION ====================
    // Auto-initialize when DOM is ready
    initializeOnReady();

    // ==================== PUBLIC API ====================
    return {
        /**
         * Get initialization status
         * @function isInitialized
         * @returns {boolean} True if all modules are initialized
         */
        isInitialized: function() {
            return isInitialized;
        },

        /**
         * Manually initialize all modules
         * @function init
         */
        init: function() {
            if (!isInitialized) {
                initializeAllModules();
            }
        },

        /**
         * Get list of required modules
         * @function getRequiredModules
         * @returns {Array} Array of module names
         */
        getRequiredModules: function() {
            return requiredModules;
        },

        /**
         * Reinitialize all modules (useful for reinitializing after dynamic content)
         * @function reinitialize
         */
        reinitialize: function() {
            isInitialized = false;
            initializeAllModules();
        },

        /**
         * Get initialization report
         * @function getStatus
         * @returns {Object} Status information about all modules
         */
        getStatus: function() {
            const status = {
                initialized: isInitialized,
                modules: {}
            };

            requiredModules.forEach(moduleName => {
                status.modules[moduleName] = {
                    loaded: typeof window[moduleName] !== 'undefined',
                    hasInit: typeof window[moduleName] !== 'undefined' && typeof window[moduleName].init === 'function'
                };
            });

            return status;
        }
    };
})();

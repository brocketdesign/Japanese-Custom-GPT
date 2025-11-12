/**
 * ChatSuggestionsInit Module
 * Orchestrates initialization of all suggestions-related modules
 * 
 * @module ChatSuggestionsInit
 * @requires ChatSuggestionsContainer
 * @requires ChatSuggestionsAPI
 * @requires ChatSuggestionsManager
 */

window.ChatSuggestionsInit = (function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const config = {
        moduleInitTimeout: 100
    };

    // ==================== PRIVATE STATE ====================
    let isInitialized = false;
    const requiredModules = [
        'ChatSuggestionsContainer',
        'ChatSuggestionsAPI',
        'ChatSuggestionsManager'
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
            console.error('[ChatSuggestionsInit] Missing required modules:', missingModules.join(', '));
            return false;
        }

        return true;
    }

    /**
     * Initialize all suggestions modules
     * @private
     */
    function initializeAllModules() {
        if (!verifyModulesLoaded()) {
            console.warn('[ChatSuggestionsInit] Waiting for modules to load...');
            setTimeout(initializeAllModules, 500);
            return;
        }

        try {
            // Initialize container
            if (typeof ChatSuggestionsContainer !== 'undefined' && ChatSuggestionsContainer.create) {
                ChatSuggestionsContainer.create();
                console.log('[ChatSuggestionsInit] ChatSuggestionsContainer initialized');
            }

            // Initialize manager (which attaches event listeners)
            if (typeof ChatSuggestionsManager !== 'undefined' && ChatSuggestionsManager.init) {
                ChatSuggestionsManager.init();
                console.log('[ChatSuggestionsInit] ChatSuggestionsManager initialized');
            }

            // Make manager globally accessible for legacy code
            window.chatSuggestionsManager = ChatSuggestionsManager;

            isInitialized = true;
            console.log('[ChatSuggestionsInit] All suggestions modules initialized successfully');

        } catch (error) {
            console.error('[ChatSuggestionsInit] Error initializing modules:', error);
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
         * @returns {Array<string>} Array of module names
         */
        getRequiredModules: function() {
            return requiredModules;
        },

        /**
         * Reinitialize all modules
         * @function reinitialize
         */
        reinitialize: function() {
            isInitialized = false;
            initializeAllModules();
        },

        /**
         * Get initialization status report
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
                    hasInit: typeof window[moduleName] !== 'undefined' && 
                            typeof window[moduleName].init === 'function'
                };
            });

            return status;
        }
    };
})();

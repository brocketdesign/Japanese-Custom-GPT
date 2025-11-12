/**
 * chat-core.js
 * Main orchestrator for the modular chat system
 * Coordinates module loading, initialization sequence, and provides unified API
 * 
 * @version 1.0.0
 * @date November 12, 2025
 */

(function(window) {
    'use strict';

    /**
     * ChatCore - Main application orchestrator
     * Entry point for the modular chat system
     */
    const ChatCore = {
        // Module registry
        modules: {},
        
        // Initialization flag
        initialized: false,

        /**
         * Initialize the core application
         * Verifies all modules are loaded and starts initialization sequence
         */
        init: function() {
            console.log('[ChatCore] Initializing core application...');

            try {
                // Step 1: Verify all required core modules are loaded
                this.verifyRequiredModules();

                // Step 2: Register all available modules
                this.registerModules();

                // Step 3: Initialize Phase 4 (API & Integration) modules
                this.initializePhase4Modules();

                // Step 4: Setup module integrations
                if (window.ChatInitializer) {
                    window.ChatInitializer.setupModuleIntegrations();
                }

                // Step 5: Start initialization
                if (window.ChatInitializer) {
                    window.ChatInitializer.init();
                }

                this.initialized = true;
                console.log('[ChatCore] Core initialization complete');
                $(document).trigger('chatcore:ready');

            } catch (error) {
                console.error('[ChatCore] Error during initialization:', error);
                this.handleInitializationError(error);
            }
        },

        /**
         * Initialize Phase 4 modules (API & Integration)
         * @private
         */
        initializePhase4Modules: function() {
            console.log('[ChatCore] Initializing Phase 4 modules...');

            // Initialize event manager
            if (window.ChatEventManager && typeof window.ChatEventManager.init === 'function') {
                try {
                    window.ChatEventManager.init();
                    console.log('[ChatCore] ChatEventManager initialized');
                } catch (error) {
                    console.error('[ChatCore] Error initializing ChatEventManager:', error);
                }
            }

            // Initialize integration module
            if (window.ChatIntegration && typeof window.ChatIntegration.init === 'function') {
                try {
                    window.ChatIntegration.init();
                    console.log('[ChatCore] ChatIntegration initialized');
                } catch (error) {
                    console.error('[ChatCore] Error initializing ChatIntegration:', error);
                }
            }

            console.log('[ChatCore] Phase 4 module initialization complete');
        },

        /**
         * Verify that all required modules are loaded
         * @throws {Error} If required modules are missing
         */
        verifyRequiredModules: function() {
            const required = ['ChatState', 'ChatRouter', 'ChatInitializer'];
            const missing = required.filter(mod => !window[mod]);

            if (missing.length > 0) {
                const error = `Missing required modules: ${missing.join(', ')}`;
                console.error('[ChatCore] ' + error);
                throw new Error(error);
            }

            console.log('[ChatCore] All required modules verified');
        },

        /**
         * Register all available modules for easy access
         */
        registerModules: function() {
            // Core modules
            if (window.ChatState) this.modules.state = window.ChatState;
            if (window.ChatRouter) this.modules.router = window.ChatRouter;
            if (window.ChatInitializer) this.modules.initializer = window.ChatInitializer;
            if (window.ChatEventManager) this.modules.events = window.ChatEventManager;

            // Message system modules
            if (window.ChatMessageDisplay) this.modules.messageDisplay = window.ChatMessageDisplay;
            if (window.ChatMessageStream) this.modules.messageStream = window.ChatMessageStream;
            if (window.ChatMessageFormatter) this.modules.messageFormatter = window.ChatMessageFormatter;
            if (window.ChatMessageHistory) this.modules.messageHistory = window.ChatMessageHistory;
            if (window.ChatMessageTools) this.modules.messageTools = window.ChatMessageTools;

            // Media system modules
            if (window.ChatImageHandler) this.modules.imageHandler = window.ChatImageHandler;
            if (window.ChatVideoHandler) this.modules.videoHandler = window.ChatVideoHandler;
            if (window.ChatImageUpscale) this.modules.imageUpscale = window.ChatImageUpscale;
            if (window.ChatMergeFace) this.modules.mergeFace = window.ChatMergeFace;

            // API modules
            if (window.ChatAPI) this.modules.api = window.ChatAPI;
            if (window.ChatAPIFetch) this.modules.apiFetch = window.ChatAPIFetch;
            if (window.ChatAPICompletion) this.modules.apiCompletion = window.ChatAPICompletion;

            // UI modules
            if (window.ChatInputHandler) this.modules.inputHandler = window.ChatInputHandler;
            if (window.ChatNavigation) this.modules.navigation = window.ChatNavigation;
            if (window.ChatSharing) this.modules.sharing = window.ChatSharing;
            if (window.ChatDropdown) this.modules.dropdown = window.ChatDropdown;

            // Integration module
            if (window.ChatIntegration) this.modules.integration = window.ChatIntegration;

            console.log('[ChatCore] Registered modules:', Object.keys(this.modules));
        },

        /**
         * Get a specific module
         * @param {string} moduleName - Name of the module to retrieve
         * @returns {Object|null} - Module object or null if not found
         */
        getModule: function(moduleName) {
            if (moduleName in this.modules) {
                return this.modules[moduleName];
            }
            console.warn(`[ChatCore] Module not found: ${moduleName}`);
            return null;
        },

        /**
         * Check if a module is available
         * @param {string} moduleName - Name of the module to check
         * @returns {boolean}
         */
        hasModule: function(moduleName) {
            return moduleName in this.modules;
        },

        /**
         * Handle initialization errors gracefully
         * @param {Error} error - Error object
         */
        handleInitializationError: function(error) {
            console.error('[ChatCore] Initialization error:', error);
            
            // Show user-friendly error if possible
            const errorMessage = error.message || 'An error occurred during initialization';
            console.error('[ChatCore] Please check that all modules are loaded correctly');
            
            // Trigger error event
            $(document).trigger('chatcore:error', { error: error });
        },

        /**
         * Get the current state
         * @returns {Object} - Current application state
         */
        getState: function() {
            return window.ChatState ? window.ChatState.getState() : null;
        },

        /**
         * Reinitialize the application
         * Useful for resetting state and starting fresh
         */
        reinit: function() {
            console.log('[ChatCore] Reinitializing application...');
            
            // Reset state
            if (window.ChatState) {
                window.ChatState.reset();
            }

            // Start initialization again
            this.init();
        }
    };

    // Expose to global scope
    window.ChatCore = ChatCore;

    // Initialize on document ready, but only if this is run after all module scripts
    $(document).ready(function() {
        // Add a small delay to ensure all module scripts are loaded
        setTimeout(() => {
            if (!window.ChatCoreInitialized) {
                try {
                    ChatCore.init();
                    window.ChatCoreInitialized = true;
                } catch (error) {
                    console.error('[ChatCore] Failed to initialize:', error);
                }
            }
        }, 100);
    });

    console.log('[ChatCore] Module loaded successfully');

})(window);

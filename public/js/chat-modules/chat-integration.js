/**
 * chat-integration.js
 * Integration bridge between chat system and external modules
 * Coordinates with Persona, Scenario, Prompt Manager, and other systems
 * 
 * @version 1.0.0
 * @date November 12, 2025
 * @module ChatIntegration
 */

(function(window) {
    'use strict';

    /**
     * ChatIntegration - Bridge between chat system and external modules
     * Ensures compatibility with existing systems and provides integration points
     */
    const ChatIntegration = {
        // Module availability tracking
        modules: {
            personaModule: false,
            scenarioModule: false,
            promptManager: false,
            giftManager: false,
            suggestionsManager: false
        },

        // Module fallbacks and compatibility wrappers
        fallbacks: new Map(),

        /**
         * Initialize all external module integrations
         */
        init: function() {
            console.log('[ChatIntegration] Initializing external module integrations');

            try {
                // Check and integrate with PersonaModule
                this.integratePersonaModule();

                // Check and integrate with ChatScenarioModule
                this.integrateScenarioModule();

                // Check and integrate with PromptManager
                this.integratePromptManager();

                // Check and integrate with GiftManager
                this.integrateGiftManager();

                // Check and integrate with ChatSuggestionsManager
                this.integrateSuggestionsManager();

                // Setup cross-module communication
                this.setupCrossModuleCommunication();

                console.log('[ChatIntegration] Integration initialization complete');
                console.log('[ChatIntegration] Available modules:', this.modules);

                // Trigger integration complete event
                $(document).trigger('chatintegration:ready', { modules: this.modules });

            } catch (error) {
                console.error('[ChatIntegration] Error during integration initialization:', error);
                throw error;
            }
        },

        /**
         * Integrate with PersonaModule if available
         * @private
         */
        integratePersonaModule: function() {
            console.log('[ChatIntegration] Checking PersonaModule availability');

            if (typeof PersonaModule !== 'undefined' && PersonaModule.onPersonaAdded) {
                console.log('[ChatIntegration] PersonaModule detected and integrated');
                this.modules.personaModule = true;

                // Setup event listener for persona added
                const originalOnPersonaAdded = PersonaModule.onPersonaAdded;
                PersonaModule.onPersonaAdded = (personaObj) => {
                    console.log('[ChatIntegration] Persona added via PersonaModule:', personaObj);
                    
                    // Update chat state with persona data
                    if (window.ChatState) {
                        window.ChatState.setState({
                            persona: personaObj,
                            character: personaObj
                        });
                    }

                    // Trigger custom event
                    if (window.ChatEventManager) {
                        window.ChatEventManager.triggerChatEvent('persona:added', personaObj);
                    }

                    // Call original handler
                    if (typeof originalOnPersonaAdded === 'function') {
                        return originalOnPersonaAdded(personaObj);
                    }
                };
            } else {
                console.warn('[ChatIntegration] PersonaModule not available');
                this.modules.personaModule = false;
                this.setupPersonaModuleFallback();
            }
        },

        /**
         * Integrate with ChatScenarioModule if available
         * @private
         */
        integrateScenarioModule: function() {
            console.log('[ChatIntegration] Checking ChatScenarioModule availability');

            if (typeof ChatScenarioModule !== 'undefined') {
                console.log('[ChatIntegration] ChatScenarioModule detected and integrated');
                this.modules.scenarioModule = true;

                // Setup event listener for scenario changes
                const originalSetScenario = ChatScenarioModule.setScenario;
                if (typeof originalSetScenario === 'function') {
                    ChatScenarioModule.setScenario = (scenarioId, scenarioData) => {
                        console.log('[ChatIntegration] Scenario changed:', scenarioId);

                        // Update chat state
                        if (window.ChatState) {
                            window.ChatState.setState({
                                currentScenario: scenarioId,
                                scenarioData: scenarioData
                            });
                        }

                        // Trigger custom event
                        if (window.ChatEventManager) {
                            window.ChatEventManager.triggerChatEvent('scenario:changed', {
                                scenarioId,
                                scenarioData
                            });
                        }

                        return originalSetScenario.call(ChatScenarioModule, scenarioId, scenarioData);
                    };
                }
            } else {
                console.warn('[ChatIntegration] ChatScenarioModule not available');
                this.modules.scenarioModule = false;
            }
        },

        /**
         * Integrate with PromptManager if available
         * @private
         */
        integratePromptManager: function() {
            console.log('[ChatIntegration] Checking PromptManager availability');

            if (typeof PromptManager !== 'undefined' && PromptManager.getPrompt) {
                console.log('[ChatIntegration] PromptManager detected and integrated');
                this.modules.promptManager = true;

                // Setup fallback wrapper
                const originalGetPrompt = PromptManager.getPrompt;
                PromptManager.getPrompt = (promptId, context) => {
                    console.log('[ChatIntegration] PromptManager.getPrompt called:', promptId);

                    try {
                        return originalGetPrompt.call(PromptManager, promptId, context);
                    } catch (error) {
                        console.error('[ChatIntegration] Error in PromptManager.getPrompt:', error);
                        return null;
                    }
                };
            } else {
                console.warn('[ChatIntegration] PromptManager not available');
                this.modules.promptManager = false;
                this.setupPromptManagerFallback();
            }
        },

        /**
         * Integrate with GiftManager if available
         * @private
         */
        integrateGiftManager: function() {
            console.log('[ChatIntegration] Checking GiftManager availability');

            if (typeof GiftManager !== 'undefined' && GiftManager.openGiftPanel) {
                console.log('[ChatIntegration] GiftManager detected and integrated');
                this.modules.giftManager = true;

                // Setup event listener for gift interactions
                const originalOpenGiftPanel = GiftManager.openGiftPanel;
                GiftManager.openGiftPanel = (giftData) => {
                    console.log('[ChatIntegration] Gift panel opened:', giftData);

                    if (window.ChatEventManager) {
                        window.ChatEventManager.triggerChatEvent('gift:opened', giftData);
                    }

                    return originalOpenGiftPanel.call(GiftManager, giftData);
                };
            } else {
                console.warn('[ChatIntegration] GiftManager not available');
                this.modules.giftManager = false;
            }
        },

        /**
         * Integrate with ChatSuggestionsManager if available
         * @private
         */
        integrateSuggestionsManager: function() {
            console.log('[ChatIntegration] Checking ChatSuggestionsManager availability');

            if (typeof ChatSuggestionsManager !== 'undefined' && ChatSuggestionsManager.getSuggestions) {
                console.log('[ChatIntegration] ChatSuggestionsManager detected and integrated');
                this.modules.suggestionsManager = true;

                // Setup wrapper
                const originalGetSuggestions = ChatSuggestionsManager.getSuggestions;
                ChatSuggestionsManager.getSuggestions = (context, callback) => {
                    console.log('[ChatIntegration] ChatSuggestionsManager.getSuggestions called');

                    try {
                        return originalGetSuggestions.call(ChatSuggestionsManager, context, callback);
                    } catch (error) {
                        console.error('[ChatIntegration] Error in ChatSuggestionsManager.getSuggestions:', error);
                        return null;
                    }
                };
            } else {
                console.warn('[ChatIntegration] ChatSuggestionsManager not available');
                this.modules.suggestionsManager = false;
            }
        },

        /**
         * Setup cross-module communication via events
         * @private
         */
        setupCrossModuleCommunication: function() {
            console.log('[ChatIntegration] Setting up cross-module communication');

            // When a message is sent, notify external modules
            $(document).on('chat:message-sent', (e, data) => {
                console.log('[ChatIntegration] Message sent, notifying external modules');

                // Notify PersonaModule if available
                if (this.modules.personaModule && window.PersonaModule && window.PersonaModule.onMessageSent) {
                    try {
                        window.PersonaModule.onMessageSent(data);
                    } catch (error) {
                        console.error('[ChatIntegration] Error notifying PersonaModule:', error);
                    }
                }

                // Notify ChatScenarioModule if available
                if (this.modules.scenarioModule && window.ChatScenarioModule && window.ChatScenarioModule.onMessageSent) {
                    try {
                        window.ChatScenarioModule.onMessageSent(data);
                    } catch (error) {
                        console.error('[ChatIntegration] Error notifying ChatScenarioModule:', error);
                    }
                }
            });

            // When a message is received, notify external modules
            $(document).on('chat:message-received', (e, data) => {
                console.log('[ChatIntegration] Message received, notifying external modules');

                // Update streak counters, achievements, etc.
                if (window.GiftManager && window.GiftManager.onMessageReceived) {
                    try {
                        window.GiftManager.onMessageReceived(data);
                    } catch (error) {
                        console.error('[ChatIntegration] Error notifying GiftManager:', error);
                    }
                }
            });

            console.log('[ChatIntegration] Cross-module communication setup complete');
        },

        /**
         * Setup PersonaModule fallback/mock
         * @private
         */
        setupPersonaModuleFallback: function() {
            console.log('[ChatIntegration] Setting up PersonaModule fallback');

            if (typeof window.PersonaModule === 'undefined') {
                window.PersonaModule = {
                    onPersonaAdded: function(personaObj) {
                        console.warn('[ChatIntegration] PersonaModule fallback: onPersonaAdded called');
                        $(document).trigger('persona:added', personaObj);
                    }
                };
            }
        },

        /**
         * Setup PromptManager fallback/mock
         * @private
         */
        setupPromptManagerFallback: function() {
            console.log('[ChatIntegration] Setting up PromptManager fallback');

            if (typeof window.PromptManager === 'undefined') {
                window.PromptManager = {
                    getPrompt: function(promptId, context) {
                        console.warn('[ChatIntegration] PromptManager fallback: getPrompt called for', promptId);
                        return { id: promptId, content: '', context: context };
                    },
                    savePrompt: function(promptId, promptData) {
                        console.warn('[ChatIntegration] PromptManager fallback: savePrompt called for', promptId);
                        return true;
                    }
                };
            }
        },

        /**
         * Get integration status
         * @returns {Object} Status of all integrations
         */
        getStatus: function() {
            return {
                timestamp: new Date().toISOString(),
                modules: this.modules,
                summary: Object.values(this.modules).filter(Boolean).length + ' of 5 modules integrated'
            };
        },

        /**
         * Check if a specific module is integrated
         * @param {string} moduleName - The module name
         * @returns {boolean} Whether the module is integrated
         */
        isModuleAvailable: function(moduleName) {
            return this.modules[moduleName] === true;
        },

        /**
         * Get all integrated modules
         * @returns {Array} Array of integrated module names
         */
        getIntegratedModules: function() {
            return Object.keys(this.modules).filter(key => this.modules[key]);
        },

        /**
         * Handle module unavailable scenario with fallback
         * @param {string} moduleName - The module name that's unavailable
         * @param {Function} fallbackHandler - Fallback handler to use
         */
        handleModuleUnavailable: function(moduleName, fallbackHandler) {
            console.warn(`[ChatIntegration] Module ${moduleName} is unavailable, using fallback`);

            if (typeof fallbackHandler === 'function') {
                this.fallbacks.set(moduleName, fallbackHandler);
            }
        },

        /**
         * Get integration statistics
         * @returns {Object} Statistics
         */
        getStats: function() {
            return {
                totalModules: Object.keys(this.modules).length,
                integratedModules: this.getIntegratedModules().length,
                fallbacksRegistered: this.fallbacks.size
            };
        }
    };

    // Export to global scope
    window.ChatIntegration = ChatIntegration;

    console.log('[ChatIntegration] Module loaded successfully');

})(window);

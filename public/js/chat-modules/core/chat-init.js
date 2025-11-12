/**
 * chat-init.js
 * Application initialization and setup for the chat system
 * Handles document ready, initial state setup, language initialization, and first-time chat load
 * 
 * @version 1.0.0
 * @date November 12, 2025
 */

(function(window) {
    'use strict';

    /**
     * ChatInitializer - Core initialization logic
     */
    const ChatInitializer = {
        /**
         * Main initialization function
         * Called once on document ready
         */
        init: async function() {
            console.log('[ChatInitializer] Starting initialization...');

            try {
                // Step 1: Extract user data from global scope
                if (typeof user === 'undefined') {
                    console.error('[ChatInitializer] User data not found');
                    return;
                }

                // Step 2: Initialize language
                this.setupLanguage();

                // Step 3: Initialize state
                this.setupState();

                // Step 4: Setup event listeners
                this.setupEventListeners();

                // Step 5: Initialize current chat or show discovery
                this.initializeCurrentChat();

                console.log('[ChatInitializer] Initialization complete');
            } catch (error) {
                console.error('[ChatInitializer] Error during initialization:', error);
            }
        },

        /**
         * Setup language preferences
         */
        setupLanguage: function() {
            try {
                const languageName = window.getLanguageName ? 
                    (window.getLanguageName(user.lang) || window.getLanguageName(lang) || window.getLanguageName('ja')) :
                    'ja';
                
                ChatState.language = languageName;
                $('#language').val(languageName);
                
                console.log('[ChatInitializer] Language set to:', languageName);
            } catch (error) {
                console.warn('[ChatInitializer] Language setup error (non-critical):', error);
            }
        },

        /**
         * Setup initial state
         */
        setupState: function() {
            // Get current chat ID from multiple sources
            const chatId = window.ChatRouter.getCurrentChatId();

            // Initialize state
            ChatState.init({
                userId: user._id,
                chatId: chatId,
                userChatId: window.ChatRouter.getUserChatId(),
                isTemporary: !!user.isTemporary,
                subscriptionStatus: user.subscriptionStatus === 'active',
                language: ChatState.language
            });

            // Set body attributes for styling
            $('body').attr('data-temporary-user', ChatState.isTemporary);

            console.log('[ChatInitializer] State initialized:', ChatState.getState());
        },

        /**
         * Setup core event listeners
         */
        setupEventListeners: function() {
            // Textarea auto-expand
            $('textarea').each(function() {
                $(this).on('input change keypress', function(e) {
                    $(this).css('height', 'auto');
                    $(this).css('height', (this.scrollHeight) + 'px');
                });
            });

            // Message input handlers
            $('#sendMessage').on('click', () => {
                if (window.ChatInputHandler && typeof window.ChatInputHandler.sendMessage === 'function') {
                    window.ChatInputHandler.sendMessage();
                } else if (typeof window.sendMessage === 'function') {
                    // Fallback to old function
                    window.sendMessage();
                }
            });

            // Enter key handler
            $('#userMessage').on('keypress', (event) => {
                if (event.which === 13 && !event.shiftKey) {
                    event.preventDefault();
                    if (window.ChatInputHandler && typeof window.ChatInputHandler.sendMessage === 'function') {
                        window.ChatInputHandler.sendMessage();
                    } else if (typeof window.sendMessage === 'function') {
                        window.sendMessage();
                    }
                }
            });

            // Image message handler
            $('#sendImageMessage').on('click', () => {
                if (window.ChatInputHandler && typeof window.ChatInputHandler.sendImageMessage === 'function') {
                    window.ChatInputHandler.sendImageMessage();
                } else if (typeof window.sendImageMessage === 'function') {
                    // Fallback to old function
                    window.sendImageMessage();
                }
            });

            console.log('[ChatInitializer] Event listeners setup complete');
        },

        /**
         * Initialize current chat or show discovery
         */
        initializeCurrentChat: function() {
            if (ChatState.chatId) {
                console.log('[ChatInitializer] Loading chat:', ChatState.chatId);
                
                // Call fetch chat data
                if (typeof window.fetchChatData === 'function') {
                    window.fetchChatData(ChatState.chatId, ChatState.userId);
                } else if (typeof window.ChatAPIFetch !== 'undefined' && window.ChatAPIFetch.fetchChatData) {
                    window.ChatAPIFetch.fetchChatData(ChatState.chatId, ChatState.userId);
                }
            } else {
                console.log('[ChatInitializer] No chat ID found, showing discovery');
                
                // Show discovery interface
                if (typeof window.showDiscovery === 'function') {
                    window.showDiscovery();
                } else if (typeof window.ChatNavigation !== 'undefined' && window.ChatNavigation.showDiscovery) {
                    window.ChatNavigation.showDiscovery();
                }
            }
        },

        /**
         * Setup module integrations
         * Called after all modules are loaded
         */
        setupModuleIntegrations: function() {
            console.log('[ChatInitializer] Setting up module integrations...');

            // Setup persona module integration
            if (typeof window.onPersonaAdded === 'undefined') {
                window.onPersonaAdded = function(personaObj) {
                    ChatState.persona = {
                        name: personaObj.name,
                        id: personaObj.id,
                        chatImageUrl: personaObj.chatImageUrl
                    };
                    
                    console.log('[ChatInitializer] Persona updated:', ChatState.persona);
                };
            }

            if (typeof window.onPersonaModuleClose === 'undefined') {
                window.onPersonaModuleClose = function() {
                    if (ChatState.isNew) {
                        if (typeof window.generateChatCompletion === 'function') {
                            window.generateChatCompletion();
                        }
                        ChatState.isNew = false;
                    }
                };
            }

            console.log('[ChatInitializer] Module integrations setup complete');
        }
    };

    // Expose to global scope
    window.ChatInitializer = ChatInitializer;

    // Auto-initialize on document ready
    $(document).ready(function() {
        // Ensure all prerequisite modules are loaded before initializing
        const requiredModules = [
            'ChatState',
            'ChatRouter'
        ];

        const missingModules = requiredModules.filter(mod => !window[mod]);
        
        if (missingModules.length > 0) {
            console.warn('[ChatInitializer] Missing required modules:', missingModules);
            console.warn('[ChatInitializer] Waiting for modules to load...');
            
            // Retry after delay
            setTimeout(() => {
                if (!window.ChatAppInitialized) {
                    ChatInitializer.init();
                    window.ChatAppInitialized = true;
                }
            }, 1000);
        } else {
            ChatInitializer.init();
            window.ChatAppInitialized = true;
        }
    });

    console.log('[ChatInitializer] Module loaded successfully');

})(window);

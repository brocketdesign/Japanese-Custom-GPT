/**
 * Chat Navigation Module
 * 
 * Handles chat display toggling and navigation
 * - Show/hide chat window
 * - Navigation between chats
 * - Back button functionality
 * - Navigation state management
 * 
 * @module ChatNavigation
 * @requires ChatState, ChatRouter
 */

window.ChatNavigation = (function() {
    'use strict';

    // Private state
    const navigationState = {
        isChatVisible: true,
        previousChat: null,
        navigationHistory: []
    };

    // Configuration
    const config = {
        chatContainerId: 'chatContainer',
        showAnimationDuration: 300,
        hideAnimationDuration: 300
    };

    /**
     * Initialize navigation
     * @param {object} options - Configuration options
     */
    function init(options = {}) {
        try {
            Object.assign(config, options);
            setupNavigationListeners();
            console.log('[ChatNavigation] Initialized');
        } catch (error) {
            console.error('[ChatNavigation] Initialization error:', error);
        }
    }

    /**
     * Setup navigation event listeners
     */
    function setupNavigationListeners() {
        // Back button
        const backButton = getBackButton();
        if (backButton) {
            backButton.addEventListener('click', goBack);
        }

        // Hide chat button
        const hideButton = getHideChatButton();
        if (hideButton) {
            hideButton.addEventListener('click', hideChat);
        }

        // Show chat button
        const showButton = getShowChatButton();
        if (showButton) {
            showButton.addEventListener('click', showChat);
        }

        // History change
        window.addEventListener('popstate', handleHistoryChange);
    }

    /**
     * Get back button element
     * @returns {HTMLElement}
     */
    function getBackButton() {
        return document.querySelector('[data-nav-action="back"]') ||
               document.querySelector('.chat-back-btn') ||
               document.querySelector('.back-button');
    }

    /**
     * Get hide chat button
     * @returns {HTMLElement}
     */
    function getHideChatButton() {
        return document.querySelector('[data-nav-action="hide-chat"]') ||
               document.querySelector('.hide-chat-btn');
    }

    /**
     * Get show chat button
     * @returns {HTMLElement}
     */
    function getShowChatButton() {
        return document.querySelector('[data-nav-action="show-chat"]') ||
               document.querySelector('.show-chat-btn');
    }

    /**
     * Get chat container
     * @returns {HTMLElement}
     */
    function getChatContainer() {
        return document.getElementById(config.chatContainerId) ||
               document.querySelector('.chat-container') ||
               document.querySelector('[data-component="chat"]');
    }

    /**
     * Show chat window
     * @param {object} options - Animation options
     * @returns {Promise<void>}
     */
    function showChat(options = {}) {
        return new Promise((resolve) => {
            try {
                const container = getChatContainer();
                if (!container) {
                    resolve();
                    return;
                }

                if (navigationState.isChatVisible) {
                    resolve();
                    return;
                }

                const duration = options.duration || config.showAnimationDuration;

                // Start animation
                container.style.display = 'block';
                container.style.opacity = '0';
                container.style.transition = `opacity ${duration}ms ease-in-out`;

                // Trigger animation
                requestAnimationFrame(() => {
                    container.style.opacity = '1';
                });

                // End animation
                setTimeout(() => {
                    navigationState.isChatVisible = true;
                    container.style.transition = '';
                    
                    // Emit event
                    window.dispatchEvent(new CustomEvent('chatVisibilityChange', {
                        detail: { visible: true }
                    }));
                    
                    resolve();
                }, duration);

            } catch (error) {
                console.error('[ChatNavigation] Error showing chat:', error);
                resolve();
            }
        });
    }

    /**
     * Hide chat window
     * @param {object} options - Animation options
     * @returns {Promise<void>}
     */
    function hideChat(options = {}) {
        return new Promise((resolve) => {
            try {
                const container = getChatContainer();
                if (!container) {
                    resolve();
                    return;
                }

                if (!navigationState.isChatVisible) {
                    resolve();
                    return;
                }

                const duration = options.duration || config.hideAnimationDuration;

                // Start animation
                container.style.opacity = '1';
                container.style.transition = `opacity ${duration}ms ease-in-out`;

                // Trigger animation
                requestAnimationFrame(() => {
                    container.style.opacity = '0';
                });

                // End animation
                setTimeout(() => {
                    container.style.display = 'none';
                    navigationState.isChatVisible = false;
                    container.style.transition = '';
                    
                    // Emit event
                    window.dispatchEvent(new CustomEvent('chatVisibilityChange', {
                        detail: { visible: false }
                    }));
                    
                    resolve();
                }, duration);

            } catch (error) {
                console.error('[ChatNavigation] Error hiding chat:', error);
                resolve();
            }
        });
    }

    /**
     * Toggle chat visibility
     * @returns {Promise<void>}
     */
    async function toggleChatVisibility() {
        if (navigationState.isChatVisible) {
            await hideChat();
        } else {
            await showChat();
        }
    }

    /**
     * Navigate to chat
     * @param {string} chatId - Chat identifier
     * @param {object} options - Navigation options
     */
    function navigateToChat(chatId, options = {}) {
        try {
            if (!chatId) {
                console.warn('[ChatNavigation] Chat ID is required');
                return;
            }

            // Store current chat
            const state = window.ChatState ? window.ChatState.getState() : {};
            if (state.chatId) {
                navigationState.previousChat = state.chatId;
                navigationState.navigationHistory.push(state.chatId);
            }

            // Update URL
            if (window.ChatRouter && typeof window.ChatRouter.updateUrl === 'function') {
                window.ChatRouter.updateUrl(chatId);
            } else {
                window.history.pushState(
                    { chatId: chatId },
                    `Chat: ${chatId}`,
                    `/chat/${chatId}`
                );
            }

            // Update state
            if (window.ChatState) {
                window.ChatState.setState({ chatId: chatId });
            }

            // Emit event
            window.dispatchEvent(new CustomEvent('chatNavigation', {
                detail: { chatId: chatId, options: options }
            }));

        } catch (error) {
            console.error('[ChatNavigation] Error navigating to chat:', error);
        }
    }

    /**
     * Go back to previous chat
     */
    function goBack() {
        try {
            if (navigationState.previousChat) {
                navigateToChat(navigationState.previousChat);
            } else {
                // Go back in browser history
                window.history.back();
            }
        } catch (error) {
            console.error('[ChatNavigation] Error going back:', error);
        }
    }

    /**
     * Go to home/dashboard
     */
    function goHome() {
        try {
            window.location.href = '/';
        } catch (error) {
            console.error('[ChatNavigation] Error going home:', error);
        }
    }

    /**
     * Handle browser back button
     */
    function handleHistoryChange(event) {
        try {
            if (event.state && event.state.chatId) {
                navigateToChat(event.state.chatId);
            }
        } catch (error) {
            console.error('[ChatNavigation] Error handling history change:', error);
        }
    }

    /**
     * Clear navigation history
     */
    function clearNavigationHistory() {
        navigationState.navigationHistory = [];
        navigationState.previousChat = null;
    }

    /**
     * Get current navigation state
     * @returns {object} Navigation state
     */
    function getNavigationState() {
        return {
            isChatVisible: navigationState.isChatVisible,
            previousChat: navigationState.previousChat,
            historyLength: navigationState.navigationHistory.length
        };
    }

    /**
     * Get navigation history
     * @returns {Array} Navigation history
     */
    function getNavigationHistory() {
        return [...navigationState.navigationHistory];
    }

    /**
     * Enable/disable back button
     * @param {boolean} enabled - Enable state
     */
    function setBackButtonEnabled(enabled) {
        const backButton = getBackButton();
        if (backButton) {
            backButton.disabled = !enabled;
            backButton.classList.toggle('disabled', !enabled);
        }
    }

    /**
     * Update navigation buttons state
     */
    function updateNavigationButtonsState() {
        // Update back button
        const canGoBack = navigationState.previousChat || navigationState.navigationHistory.length > 0;
        setBackButtonEnabled(canGoBack);

        // Update show/hide buttons
        const hideButton = getHideChatButton();
        const showButton = getShowChatButton();

        if (hideButton) {
            hideButton.style.display = navigationState.isChatVisible ? 'block' : 'none';
        }

        if (showButton) {
            showButton.style.display = navigationState.isChatVisible ? 'none' : 'block';
        }
    }

    // Public API
    return {
        init,
        showChat,
        hideChat,
        toggleChatVisibility,
        navigateToChat,
        goBack,
        goHome,
        clearNavigationHistory,
        getNavigationState,
        getNavigationHistory,
        setBackButtonEnabled,
        updateNavigationButtonsState,
        getChatContainer,
        // Debugging
        logNavigationState: () => {
            console.log('[ChatNavigation] State:', {
                isChatVisible: navigationState.isChatVisible,
                previousChat: navigationState.previousChat,
                historyLength: navigationState.navigationHistory.length,
                history: navigationState.navigationHistory
            });
        }
    };
})();

// Module registration
if (window.ChatCore && typeof window.ChatCore.registerModule === 'function') {
    window.ChatCore.registerModule('ChatNavigation', window.ChatNavigation);
}

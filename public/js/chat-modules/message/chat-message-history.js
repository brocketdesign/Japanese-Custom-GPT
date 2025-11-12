/**
 * Chat Message History Module
 * Handles loading and managing chat message history
 * 
 * @module chat-message-history
 * @requires ChatState
 * @requires ChatMessageDisplay
 */

const ChatMessageHistory = (function() {
    'use strict';

    // ============================================================================
    // Private Variables
    // ============================================================================

    const historyCache = new Map(); // Cache for loaded histories: chatId -> { messages, count, isComplete }
    const loadingState = new Map(); // Track which chats are currently loading
    const DEFAULT_LIMIT = 50; // Default number of messages to load
    const API_URL = window.API_URL || '/api';

    // ============================================================================
    // History Loading Functions
    // ============================================================================

    /**
     * Load chat message history for a specific chat
     * @param {string} chatId - The chat ID
     * @param {Object} options - Loading options
     * @param {number} options.offset - Number of messages to skip (default: 0)
     * @param {number} options.limit - Number of messages to load (default: 50)
     * @param {boolean} options.useCache - Use cached data if available (default: true)
     * @returns {Promise<Array>} Array of message objects
     */
    function loadChatHistory(chatId, options = {}) {
        return new Promise((resolve, reject) => {
            if (!chatId) {
                console.warn('[ChatMessageHistory] No chatId provided');
                reject(new Error('chatId is required'));
                return;
            }

            const { offset = 0, limit = DEFAULT_LIMIT, useCache = true } = options;

            // Check cache first
            if (useCache && historyCache.has(chatId)) {
                const cached = historyCache.get(chatId);
                console.log(`[ChatMessageHistory] Using cached history for ${chatId}`);
                resolve(cached.messages);
                return;
            }

            // Prevent duplicate requests
            if (loadingState.get(chatId)) {
                console.log(`[ChatMessageHistory] History already loading for ${chatId}, waiting...`);
                // Wait a bit and try cache again
                setTimeout(() => {
                    if (historyCache.has(chatId)) {
                        resolve(historyCache.get(chatId).messages);
                    } else {
                        reject(new Error('Failed to load history'));
                    }
                }, 500);
                return;
            }

            // Mark as loading
            loadingState.set(chatId, true);

            // Fetch from API
            $.ajax({
                url: `${API_URL}/user-chat/${chatId}`,
                method: 'GET',
                contentType: 'application/json',
                data: { offset, limit },
                success: function(response) {
                    try {
                        if (response.success && Array.isArray(response.data)) {
                            const messages = response.data;

                            // Cache the result
                            const cacheData = historyCache.get(chatId) || { count: response.count || messages.length, isComplete: false };
                            cacheData.messages = messages;
                            historyCache.set(chatId, cacheData);

                            console.log(`[ChatMessageHistory] Loaded ${messages.length} messages for ${chatId}`);
                            resolve(messages);
                        } else {
                            reject(new Error('Invalid response format'));
                        }
                    } catch (error) {
                        console.error('[ChatMessageHistory] Error processing response:', error);
                        reject(error);
                    } finally {
                        loadingState.delete(chatId);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('[ChatMessageHistory] Error loading history:', error);
                    loadingState.delete(chatId);
                    reject(new Error(`Failed to load history: ${error}`));
                }
            });
        });
    }

    /**
     * Load more messages from the history with pagination
     * @param {string} chatId - The chat ID
     * @param {number} offset - Number of messages to skip
     * @param {number} limit - Number of messages to load
     * @returns {Promise<Array>} Array of additional message objects
     */
    function loadMoreMessages(chatId, offset = 0, limit = DEFAULT_LIMIT) {
        return new Promise((resolve, reject) => {
            if (!chatId) {
                reject(new Error('chatId is required'));
                return;
            }

            console.log(`[ChatMessageHistory] Loading more messages: offset=${offset}, limit=${limit}`);

            $.ajax({
                url: `${API_URL}/user-chat/${chatId}`,
                method: 'GET',
                data: { offset, limit },
                success: function(response) {
                    try {
                        if (response.success && Array.isArray(response.data)) {
                            const messages = response.data;

                            // Merge with existing cache
                            if (historyCache.has(chatId)) {
                                const cacheData = historyCache.get(chatId);
                                cacheData.messages = [...cacheData.messages, ...messages];
                            } else {
                                historyCache.set(chatId, { messages, count: response.count || 0, isComplete: false });
                            }

                            resolve(messages);
                        } else {
                            reject(new Error('Invalid response format'));
                        }
                    } catch (error) {
                        console.error('[ChatMessageHistory] Error processing paginated response:', error);
                        reject(error);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('[ChatMessageHistory] Error loading more messages:', error);
                    reject(new Error(`Failed to load more messages: ${error}`));
                }
            });
        });
    }

    /**
     * Pre-load history for a chat (useful for performance)
     * @param {string} chatId - The chat ID
     * @returns {Promise<void>}
     */
    function preloadHistory(chatId) {
        return new Promise((resolve, reject) => {
            if (!chatId) {
                reject(new Error('chatId is required'));
                return;
            }

            console.log(`[ChatMessageHistory] Pre-loading history for ${chatId}`);

            loadChatHistory(chatId, { limit: 100, useCache: false })
                .then(() => {
                    console.log(`[ChatMessageHistory] Pre-load complete for ${chatId}`);
                    resolve();
                })
                .catch(reject);
        });
    }

    // ============================================================================
    // History State Functions
    // ============================================================================

    /**
     * Get the count of messages in a chat
     * @param {string} chatId - The chat ID
     * @returns {number} Number of messages or 0 if not cached
     */
    function getHistoryCount(chatId) {
        if (historyCache.has(chatId)) {
            return historyCache.get(chatId).count || 0;
        }
        return 0;
    }

    /**
     * Check if full history is loaded for a chat
     * @param {string} chatId - The chat ID
     * @returns {boolean} True if all messages are loaded
     */
    function isFullHistoryLoaded(chatId) {
        if (historyCache.has(chatId)) {
            const cacheData = historyCache.get(chatId);
            return cacheData.isComplete === true;
        }
        return false;
    }

    /**
     * Check if a specific chat is currently loading
     * @param {string} chatId - The chat ID
     * @returns {boolean} True if currently loading
     */
    function isLoading(chatId) {
        return loadingState.has(chatId) && loadingState.get(chatId) === true;
    }

    // ============================================================================
    // Cache Management Functions
    // ============================================================================

    /**
     * Get cached history for a chat
     * @param {string} chatId - The chat ID
     * @returns {Array|null} Cached messages or null if not cached
     */
    function getCachedHistory(chatId) {
        if (historyCache.has(chatId)) {
            return historyCache.get(chatId).messages || null;
        }
        return null;
    }

    /**
     * Clear history cache for a specific chat
     * @param {string} chatId - The chat ID to clear (optional, clears all if not provided)
     */
    function clearHistoryCache(chatId) {
        if (chatId) {
            if (historyCache.has(chatId)) {
                historyCache.delete(chatId);
                console.log(`[ChatMessageHistory] Cleared cache for ${chatId}`);
            }
        } else {
            historyCache.clear();
            loadingState.clear();
            console.log('[ChatMessageHistory] Cleared all caches');
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    function getCacheStats() {
        const stats = {
            cachedChats: historyCache.size,
            loadingChats: loadingState.size,
            totalCachedMessages: 0,
            chats: {}
        };

        historyCache.forEach((data, chatId) => {
            const messageCount = (data.messages || []).length;
            stats.totalCachedMessages += messageCount;
            stats.chats[chatId] = {
                messages: messageCount,
                count: data.count,
                isComplete: data.isComplete
            };
        });

        return stats;
    }

    // ============================================================================
    // Display Functions
    // ============================================================================

    /**
     * Format a historical message for display
     * @param {Object} message - The message object
     * @returns {Object} Formatted message
     */
    function formatHistoricalMessage(message) {
        if (!message) return null;

        return {
            id: message._id || message.id,
            role: message.role || message.sender,
            content: message.content || message.message,
            timestamp: message.timestamp || message.createdAt,
            imageId: message.imageId,
            videoId: message.videoId,
            mergeId: message.mergeId,
            hidden: message.hidden === true,
            name: message.name
        };
    }

    /**
     * Display loaded history in chat
     * @param {string} chatId - The chat ID
     * @param {Object} persona - User persona
     * @returns {Promise<void>}
     */
    function displayHistory(chatId, persona) {
        return new Promise((resolve, reject) => {
            const messages = getCachedHistory(chatId);

            if (!messages) {
                console.warn('[ChatMessageHistory] No cached history to display');
                reject(new Error('No cached history'));
                return;
            }

            try {
                // Format messages
                const formattedMessages = messages.map(msg => formatHistoricalMessage(msg));

                // Display using ChatMessageDisplay if available
                if (window.ChatMessageDisplay && typeof window.ChatMessageDisplay.displayExistingChat === 'function') {
                    window.ChatMessageDisplay.displayExistingChat(formattedMessages, persona, () => {
                        console.log('[ChatMessageHistory] History displayed successfully');
                        resolve();
                    });
                } else {
                    console.warn('[ChatMessageHistory] ChatMessageDisplay not available');
                    resolve();
                }
            } catch (error) {
                console.error('[ChatMessageHistory] Error displaying history:', error);
                reject(error);
            }
        });
    }

    // ============================================================================
    // Utility Functions
    // ============================================================================

    /**
     * Refresh history for a chat (clear cache and reload)
     * @param {string} chatId - The chat ID
     * @returns {Promise<Array>} Fresh message data
     */
    function refreshHistory(chatId) {
        clearHistoryCache(chatId);
        return loadChatHistory(chatId, { useCache: false });
    }

    /**
     * Get statistics about message history
     * @param {string} chatId - The chat ID
     * @returns {Object} Statistics object
     */
    function getHistoryStats(chatId) {
        const cached = getCachedHistory(chatId);
        if (!cached) {
            return {
                messageCount: 0,
                userMessages: 0,
                botMessages: 0,
                isLoaded: false
            };
        }

        const userMessages = cached.filter(m => m.role === 'user').length;
        const botMessages = cached.filter(m => m.role === 'assistant').length;

        return {
            messageCount: cached.length,
            userMessages,
            botMessages,
            isLoaded: true,
            isCached: historyCache.has(chatId)
        };
    }

    // ============================================================================
    // Public API
    // ============================================================================

    return {
        // History loading
        loadChatHistory,
        loadMoreMessages,
        preloadHistory,

        // State checking
        getHistoryCount,
        isFullHistoryLoaded,
        isLoading,

        // Cache management
        getCachedHistory,
        clearHistoryCache,
        getCacheStats,
        refreshHistory,

        // Display
        formatHistoricalMessage,
        displayHistory,

        // Statistics
        getHistoryStats
    };
})();

// Make it available globally
window.ChatMessageHistory = ChatMessageHistory;

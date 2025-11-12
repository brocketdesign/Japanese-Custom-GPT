/**
 * Chat Merge Face Module
 * 
 * Handles merge face feature rendering and display
 * - Merge face URL retrieval by ID
 * - Merge face placeholder management
 * - Async merge result fetching
 * - Tools integration
 * 
 * @module ChatMergeFace
 * @requires ChatState
 */

window.ChatMergeFace = (function() {
    'use strict';

    // Private storage for merge face state
    const mergeFaceState = {
        loadedMergeFaces: new Set(),
        failedMergeFaces: new Set(),
        mergeFaceData: new Map()
    };

    /**
     * Get merge face URL by ID from current chat state
     * @param {string} mergeId - Merge face identifier
     * @param {number} designStep - Design step number
     * @param {string} thumbnail - Thumbnail URL
     * @returns {string} Merge face URL or placeholder
     */
    function getMergeFaceUrlById(mergeId, designStep, thumbnail) {
        try {
            if (!mergeId) return '';

            const state = window.ChatState ? window.ChatState.getState() : {};
            const chatData = state.chatData || {};
            
            // Handle different merge face sources
            if (chatData.mergeFaces && chatData.mergeFaces[mergeId]) {
                const mergeFace = chatData.mergeFaces[mergeId];
                
                if (thumbnail && mergeFace.thumbnail) {
                    return mergeFace.thumbnail;
                }
                
                return mergeFace.url || mergeFace.src || '';
            }

            // Check in merge result data
            const mergeData = mergeFaceState.mergeFaceData.get(mergeId);
            if (mergeData) {
                return mergeData.url || '';
            }

            return '';
        } catch (error) {
            console.error('[ChatMergeFace] Error getting merge face URL:', error);
            return '';
        }
    }

    /**
     * Display merge face asynchronously with loading state
     * @param {string} mergeId - Merge face identifier
     * @param {HTMLElement} targetElement - Target container
     * @returns {Promise<void>}
     */
    function displayMergeFaceAsync(mergeId, targetElement) {
        return new Promise((resolve, reject) => {
            if (!targetElement) {
                reject(new Error('Target element is required'));
                return;
            }

            try {
                // Show loading state
                showMergeFaceLoading(targetElement, mergeId);

                const mergeUrl = getMergeFaceUrlById(mergeId);
                
                if (!mergeUrl) {
                    // Try to fetch merge result from API
                    fetchMergeFaceResult(mergeId)
                        .then(url => {
                            displayMergeFaceResult(url, mergeId, targetElement);
                            mergeFaceState.loadedMergeFaces.add(mergeId);
                            resolve();
                        })
                        .catch(error => {
                            mergeFaceState.failedMergeFaces.add(mergeId);
                            reject(error);
                        });
                    return;
                }

                // Display merge face result
                displayMergeFaceResult(mergeUrl, mergeId, targetElement);
                mergeFaceState.loadedMergeFaces.add(mergeId);
                resolve();

            } catch (error) {
                mergeFaceState.failedMergeFaces.add(mergeId);
                reject(error);
            }
        });
    }

    /**
     * Display merge face result in container
     * @param {string} imageUrl - Merge face image URL
     * @param {string} mergeId - Merge face identifier
     * @param {HTMLElement} targetElement - Target container
     */
    function displayMergeFaceResult(imageUrl, mergeId, targetElement) {
        try {
            // Create image element
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = `Merge Face Result ${mergeId}`;
            img.className = 'chat-message-merge-face';
            img.loading = 'lazy';
            img.dataset.mergeId = mergeId;

            // Handle load
            img.onload = () => {
                // Hide loading state
                hideMergeFaceLoading(targetElement);
            };

            // Handle error
            img.onerror = () => {
                console.error(`[ChatMergeFace] Failed to load merge face ${mergeId}`);
                hideMergeFaceLoading(targetElement);
                targetElement.innerHTML = '<div class="merge-face-error">Failed to load merge face result</div>';
            };

            // Clear target and add image
            targetElement.innerHTML = '';
            targetElement.appendChild(img);

            // Add tools
            const tools = generateMergeFaceTools({
                id: mergeId,
                url: imageUrl
            });
            targetElement.appendChild(tools);

        } catch (error) {
            console.error('[ChatMergeFace] Error displaying merge face:', error);
        }
    }

    /**
     * Fetch merge face result from API
     * @param {string} mergeId - Merge face identifier
     * @returns {Promise<string>} Merge face result URL
     */
    function fetchMergeFaceResult(mergeId) {
        return new Promise(async (resolve, reject) => {
            try {
                const response = await fetch(`/api/merge-face-result/${mergeId}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.statusText}`);
                }

                const data = await response.json();

                if (data.error) {
                    throw new Error(data.error);
                }

                if (!data.url && !data.image) {
                    throw new Error('No merge face URL in response');
                }

                const mergeUrl = data.url || data.image;
                
                // Cache the result
                mergeFaceState.mergeFaceData.set(mergeId, {
                    url: mergeUrl,
                    timestamp: Date.now()
                });

                resolve(mergeUrl);

            } catch (error) {
                console.error('[ChatMergeFace] Error fetching merge face result:', error);
                reject(error);
            }
        });
    }

    /**
     * Generate merge face tools (download, share, etc.)
     * @param {object} mergeData - Merge face metadata
     * @returns {HTMLElement} Tools container
     */
    function generateMergeFaceTools(mergeData) {
        const toolsContainer = document.createElement('div');
        toolsContainer.className = 'merge-face-tools';
        toolsContainer.dataset.mergeId = mergeData.id || '';

        const tools = [
            {
                id: 'download',
                icon: '⬇️',
                title: 'Download',
                handler: 'downloadMergeFace'
            },
            {
                id: 'preview',
                icon: '👁️',
                title: 'Preview',
                handler: 'previewMergeFace'
            },
            {
                id: 'share',
                icon: '📤',
                title: 'Share',
                handler: 'shareMergeFace'
            }
        ];

        tools.forEach(tool => {
            const button = document.createElement('button');
            button.className = `merge-face-tool-btn ${tool.id}-btn`;
            button.innerHTML = tool.icon;
            button.title = tool.title;
            button.dataset.action = tool.handler;
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Trigger handler - can be overridden by parent
                toolsContainer.dispatchEvent(new CustomEvent('mergeFaceTool', {
                    detail: { action: tool.handler, mergeData: mergeData }
                }));
            });
            toolsContainer.appendChild(button);
        });

        return toolsContainer;
    }

    /**
     * Show loading state for merge face
     * @param {HTMLElement} targetElement - Target container
     * @param {string} mergeId - Merge face identifier
     */
    function showMergeFaceLoading(targetElement, mergeId) {
        const loader = document.createElement('div');
        loader.className = 'merge-face-loader';
        loader.dataset.mergeId = mergeId;
        loader.innerHTML = `
            <div class="spinner"></div>
            <p>Loading merge face result...</p>
        `;
        targetElement.innerHTML = '';
        targetElement.appendChild(loader);
    }

    /**
     * Hide loading state for merge face
     * @param {HTMLElement} targetElement - Target container
     */
    function hideMergeFaceLoading(targetElement) {
        const loader = targetElement.querySelector('.merge-face-loader');
        if (loader) {
            loader.remove();
        }
    }

    /**
     * Update merge face display with new URL
     * @param {string} mergeId - Merge face identifier
     * @param {string} imageUrl - New image URL
     */
    function updateMergeFaceDisplay(mergeId, imageUrl) {
        try {
            // Update state cache
            const state = window.ChatState ? window.ChatState.getState() : {};
            if (state.chatData && state.chatData.mergeFaces) {
                if (!state.chatData.mergeFaces[mergeId]) {
                    state.chatData.mergeFaces[mergeId] = {};
                }
                state.chatData.mergeFaces[mergeId].url = imageUrl;
            }

            // Update local cache
            mergeFaceState.mergeFaceData.set(mergeId, {
                url: imageUrl,
                timestamp: Date.now()
            });

            // Update all instances in DOM
            const elements = document.querySelectorAll(`[data-merge-id="${mergeId}"]`);
            elements.forEach(el => {
                const img = el.querySelector('img');
                if (img) {
                    img.src = imageUrl;
                }
            });

        } catch (error) {
            console.error('[ChatMergeFace] Error updating merge face display:', error);
        }
    }

    /**
     * Check if merge face is loaded
     * @param {string} mergeId - Merge face identifier
     * @returns {boolean}
     */
    function isMergeFaceLoaded(mergeId) {
        return mergeFaceState.loadedMergeFaces.has(mergeId);
    }

    /**
     * Check if merge face failed to load
     * @param {string} mergeId - Merge face identifier
     * @returns {boolean}
     */
    function isMergeFaceFailed(mergeId) {
        return mergeFaceState.failedMergeFaces.has(mergeId);
    }

    /**
     * Get cached merge face data
     * @param {string} mergeId - Merge face identifier
     * @returns {object} Merge face data or null
     */
    function getCachedMergeFaceData(mergeId) {
        return mergeFaceState.mergeFaceData.get(mergeId) || null;
    }

    /**
     * Clear merge face cache
     * @param {string} mergeId - Specific merge face ID (optional)
     */
    function clearMergeFaceCache(mergeId) {
        if (mergeId) {
            mergeFaceState.mergeFaceData.delete(mergeId);
        } else {
            mergeFaceState.mergeFaceData.clear();
        }
    }

    /**
     * Clear all merge face state
     */
    function clearMergeFaceState() {
        mergeFaceState.loadedMergeFaces.clear();
        mergeFaceState.failedMergeFaces.clear();
        mergeFaceState.mergeFaceData.clear();
    }

    /**
     * Get merge face statistics
     * @returns {object} Merge face state statistics
     */
    function getMergeFaceStats() {
        return {
            loaded: mergeFaceState.loadedMergeFaces.size,
            failed: mergeFaceState.failedMergeFaces.size,
            cached: mergeFaceState.mergeFaceData.size,
            total: mergeFaceState.loadedMergeFaces.size + mergeFaceState.failedMergeFaces.size
        };
    }

    // Public API
    return {
        getMergeFaceUrlById,
        displayMergeFaceAsync,
        displayMergeFaceResult,
        generateMergeFaceTools,
        updateMergeFaceDisplay,
        isMergeFaceLoaded,
        isMergeFaceFailed,
        getCachedMergeFaceData,
        clearMergeFaceCache,
        clearMergeFaceState,
        getMergeFaceStats,
        // Debugging
        logMergeFaceState: () => {
            console.log('[ChatMergeFace] State:', {
                loaded: Array.from(mergeFaceState.loadedMergeFaces),
                failed: Array.from(mergeFaceState.failedMergeFaces),
                cached: Array.from(mergeFaceState.mergeFaceData.entries())
            });
        }
    };
})();

// Module registration
if (window.ChatCore && typeof window.ChatCore.registerModule === 'function') {
    window.ChatCore.registerModule('ChatMergeFace', window.ChatMergeFace);
}

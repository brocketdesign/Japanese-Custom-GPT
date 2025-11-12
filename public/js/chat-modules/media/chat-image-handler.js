/**
 * Chat Image Handler Module
 * 
 * Handles all image rendering and display functionality
 * - Image URL retrieval by ID
 * - Image placeholder management
 * - NSFW blur effect handling
 * - Image tools integration
 * - Async image loading
 * 
 * @module ChatImageHandler
 * @requires ChatState
 */

window.ChatImageHandler = (function() {
    'use strict';

    // Private storage for image state
    const imageState = {
        loadedImages: new Set(),
        nsfwImages: new Map(),
        failedImages: new Set()
    };

    /**
     * Get image URL by ID from current chat state
     * @param {string} imageId - Image identifier
     * @param {number} designStep - Design step number
     * @param {boolean} thumbnail - Whether to fetch thumbnail
     * @param {array} actions - Action tools for image
     * @returns {string} Image URL or placeholder
     */
    function getImageUrlById(imageId, designStep, thumbnail, actions) {
        try {
            if (!imageId) return '';

            const state = window.ChatState ? window.ChatState.getState() : {};
            const chatData = state.chatData || {};
            
            // Handle different image sources
            if (chatData.images && chatData.images[imageId]) {
                const image = chatData.images[imageId];
                
                if (thumbnail && image.thumbnail) {
                    return image.thumbnail;
                }
                
                return image.url || image.src || '';
            }

            // Fallback for inline image URLs
            if (typeof imageId === 'string' && imageId.startsWith('http')) {
                return imageId;
            }

            return '';
        } catch (error) {
            console.error('[ChatImageHandler] Error getting image URL:', error);
            return '';
        }
    }

    /**
     * Display image asynchronously with loading state
     * @param {string} imageId - Image identifier
     * @param {HTMLElement} targetElement - Target container
     * @returns {Promise<void>}
     */
    function displayImageAsync(imageId, targetElement) {
        return new Promise((resolve, reject) => {
            if (!targetElement) {
                reject(new Error('Target element is required'));
                return;
            }

            try {
                const imageUrl = getImageUrlById(imageId);
                
                if (!imageUrl) {
                    reject(new Error('No image URL found'));
                    return;
                }

                // Create image element
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = `Image ${imageId}`;
                img.className = 'chat-message-image';
                img.loading = 'lazy';

                // Handle load
                img.onload = () => {
                    imageState.loadedImages.add(imageId);
                    
                    // Apply NSFW blur if needed
                    const state = window.ChatState ? window.ChatState.getState() : {};
                    if (imageState.nsfwImages.get(imageId)) {
                        applyBlurEffect(img);
                    }

                    targetElement.innerHTML = '';
                    targetElement.appendChild(img);
                    
                    resolve();
                };

                // Handle error
                img.onerror = () => {
                    imageState.failedImages.add(imageId);
                    reject(new Error(`Failed to load image ${imageId}`));
                };

                // Timeout for slow connections
                const timeout = setTimeout(() => {
                    reject(new Error(`Image load timeout: ${imageId}`));
                }, 30000);

                img.onload = (() => {
                    clearTimeout(timeout);
                    return img.onload;
                })();

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handle NSFW image with blur effect
     * @param {HTMLElement} imageElement - Image element
     * @param {boolean} shouldBlur - Whether to apply blur
     */
    function handleNsfwImage(imageElement, shouldBlur) {
        if (!imageElement) return;

        if (shouldBlur) {
            applyBlurEffect(imageElement);
            imageElement.dataset.nsfw = 'true';
            
            // Add click-to-reveal functionality
            imageElement.style.cursor = 'pointer';
            imageElement.addEventListener('click', function(e) {
                e.preventDefault();
                removeBlurEffect(imageElement);
                imageElement.dataset.nsfw = 'false';
            });
        }
    }

    /**
     * Apply blur CSS effect to image
     * @param {HTMLElement} imageElement - Image element
     */
    function applyBlurEffect(imageElement) {
        if (!imageElement) return;
        
        imageElement.style.filter = 'blur(20px)';
        imageElement.style.transition = 'filter 0.3s ease';
        imageElement.classList.add('nsfw-blurred');
        
        // Add tooltip
        imageElement.title = 'Click to reveal NSFW content';
    }

    /**
     * Remove blur effect from image
     * @param {HTMLElement} imageElement - Image element
     */
    function removeBlurEffect(imageElement) {
        if (!imageElement) return;
        
        imageElement.style.filter = 'none';
        imageElement.classList.remove('nsfw-blurred');
        imageElement.title = '';
    }

    /**
     * Generate image tools (download, upscale, share, etc.)
     * @param {object} imageData - Image metadata
     * @returns {HTMLElement} Tools container
     */
    function generateImageTools(imageData) {
        const toolsContainer = document.createElement('div');
        toolsContainer.className = 'image-tools';
        toolsContainer.dataset.imageId = imageData.id || '';

        const tools = [
            {
                id: 'download',
                icon: '⬇️',
                title: 'Download',
                handler: 'downloadImage'
            },
            {
                id: 'upscale',
                icon: '🔍',
                title: 'Upscale',
                handler: 'upscaleImage'
            },
            {
                id: 'share',
                icon: '📤',
                title: 'Share',
                handler: 'shareImage'
            }
        ];

        tools.forEach(tool => {
            const button = document.createElement('button');
            button.className = `image-tool-btn ${tool.id}-btn`;
            button.innerHTML = tool.icon;
            button.title = tool.title;
            button.dataset.action = tool.handler;
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Trigger handler - can be overridden by parent
                toolsContainer.dispatchEvent(new CustomEvent('imageTool', {
                    detail: { action: tool.handler, imageData: imageData }
                }));
            });
            toolsContainer.appendChild(button);
        });

        return toolsContainer;
    }

    /**
     * Update image display with new URL
     * @param {string} imageId - Image identifier
     * @param {string} imageUrl - New image URL
     */
    function updateImageDisplay(imageId, imageUrl) {
        try {
            const state = window.ChatState ? window.ChatState.getState() : {};
            if (state.chatData && state.chatData.images) {
                state.chatData.images[imageId] = {
                    ...state.chatData.images[imageId],
                    url: imageUrl
                };
            }

            // Update all instances of this image in DOM
            const elements = document.querySelectorAll(`[data-image-id="${imageId}"]`);
            elements.forEach(el => {
                const img = el.querySelector('img');
                if (img) {
                    img.src = imageUrl;
                }
            });

        } catch (error) {
            console.error('[ChatImageHandler] Error updating image display:', error);
        }
    }

    /**
     * Check if image is loaded
     * @param {string} imageId - Image identifier
     * @returns {boolean}
     */
    function isImageLoaded(imageId) {
        return imageState.loadedImages.has(imageId);
    }

    /**
     * Check if image failed to load
     * @param {string} imageId - Image identifier
     * @returns {boolean}
     */
    function isImageFailed(imageId) {
        return imageState.failedImages.has(imageId);
    }

    /**
     * Mark image as NSFW
     * @param {string} imageId - Image identifier
     * @param {boolean} isNsfw - NSFW status
     */
    function setNsfwStatus(imageId, isNsfw) {
        imageState.nsfwImages.set(imageId, isNsfw);
    }

    /**
     * Clear all image state
     */
    function clearImageState() {
        imageState.loadedImages.clear();
        imageState.nsfwImages.clear();
        imageState.failedImages.clear();
    }

    /**
     * Get image statistics
     * @returns {object} Image state statistics
     */
    function getImageStats() {
        return {
            loaded: imageState.loadedImages.size,
            failed: imageState.failedImages.size,
            nsfw: imageState.nsfwImages.size,
            total: imageState.loadedImages.size + imageState.failedImages.size
        };
    }

    // Public API
    return {
        getImageUrlById,
        displayImageAsync,
        handleNsfwImage,
        applyBlurEffect,
        removeBlurEffect,
        generateImageTools,
        updateImageDisplay,
        isImageLoaded,
        isImageFailed,
        setNsfwStatus,
        clearImageState,
        getImageStats,
        // Debugging
        logImageState: () => {
            console.log('[ChatImageHandler] State:', {
                loaded: Array.from(imageState.loadedImages),
                failed: Array.from(imageState.failedImages),
                nsfw: Array.from(imageState.nsfwImages.entries())
            });
        }
    };
})();

// Module registration
if (window.ChatCore && typeof window.ChatCore.registerModule === 'function') {
    window.ChatCore.registerModule('ChatImageHandler', window.ChatImageHandler);
}

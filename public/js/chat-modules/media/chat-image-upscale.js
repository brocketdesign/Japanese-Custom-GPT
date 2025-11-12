/**
 * Chat Image Upscale Module
 * 
 * Handles image upscaling functionality
 * - Image upscaling API integration
 * - Upscale progress tracking
 * - Success/error handling
 * - UI state management
 * 
 * @module ChatImageUpscale
 * @requires ChatState
 */

window.ChatImageUpscale = (function() {
    'use strict';

    // Private storage for upscale state
    const upscaleState = {
        upscalingImages: new Set(),
        upscaledImages: new Map(),
        upscaleProgress: new Map(),
        upscaleErrors: new Map()
    };

    /**
     * Start image upscaling process
     * @param {string} imageId - Image identifier
     * @param {string} imageUrl - Image URL
     * @param {string} chatId - Chat identifier
     * @param {string} userChatId - User chat identifier
     * @returns {Promise<object>} Upscale result
     */
    function upscaleImage(imageId, imageUrl, chatId, userChatId) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!imageId || !imageUrl) {
                    reject(new Error('Image ID and URL are required'));
                    return;
                }

                // Check if already upscaling
                if (upscaleState.upscalingImages.has(imageId)) {
                    reject(new Error('Already upscaling this image'));
                    return;
                }

                // Mark as upscaling
                upscaleState.upscalingImages.add(imageId);
                setUpscaleProgress(imageId, 0);

                // Show upscaling UI
                showUpscalingUI(imageId);

                // Prepare upscale request
                const upscaleData = {
                    imageId: imageId,
                    imageUrl: imageUrl,
                    chatId: chatId,
                    userChatId: userChatId
                };

                // Make API call
                const response = await fetch('/api/upscale-image', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(upscaleData)
                });

                if (!response.ok) {
                    throw new Error(`Upscale API error: ${response.statusText}`);
                }

                const result = await response.json();

                if (result.error) {
                    throw new Error(result.error);
                }

                // Mark as successfully upscaled
                handleUpscaleSuccess(imageId, result.upscaledUrl || result.url);
                
                // Hide upscaling UI
                hideUpscalingUI(imageId);

                resolve({
                    success: true,
                    imageId: imageId,
                    upscaledUrl: result.upscaledUrl || result.url
                });

            } catch (error) {
                console.error('[ChatImageUpscale] Error upscaling image:', error);
                handleUpscaleError(imageId, error.message);
                
                // Hide upscaling UI
                hideUpscalingUI(imageId);
                
                reject(error);
            } finally {
                upscaleState.upscalingImages.delete(imageId);
            }
        });
    }

    /**
     * Handle successful upscale
     * @param {string} imageId - Image identifier
     * @param {string} newUrl - New upscaled image URL
     */
    function handleUpscaleSuccess(imageId, newUrl) {
        try {
            upscaleState.upscaledImages.set(imageId, newUrl);
            upscaleState.upscaleProgress.delete(imageId);
            upscaleState.upscaleErrors.delete(imageId);

            // Update chat state
            const state = window.ChatState ? window.ChatState.getState() : {};
            if (state.chatData && state.chatData.images && state.chatData.images[imageId]) {
                state.chatData.images[imageId].upscaledUrl = newUrl;
                state.chatData.images[imageId].isUpscaled = true;
            }

            // Update DOM
            updateImageInDOM(imageId, newUrl);

            // Emit success event
            window.dispatchEvent(new CustomEvent('imageUpscaleSuccess', {
                detail: { imageId: imageId, upscaledUrl: newUrl }
            }));

        } catch (error) {
            console.error('[ChatImageUpscale] Error handling upscale success:', error);
        }
    }

    /**
     * Handle upscale error
     * @param {string} imageId - Image identifier
     * @param {string} errorMessage - Error message
     */
    function handleUpscaleError(imageId, errorMessage) {
        try {
            upscaleState.upscaleErrors.set(imageId, errorMessage);
            upscaleState.upscaleProgress.delete(imageId);

            // Emit error event
            window.dispatchEvent(new CustomEvent('imageUpscaleError', {
                detail: { imageId: imageId, error: errorMessage }
            }));

            // Show error notification
            showErrorNotification(`Failed to upscale image: ${errorMessage}`);

        } catch (error) {
            console.error('[ChatImageUpscale] Error handling upscale error:', error);
        }
    }

    /**
     * Check if image is currently upscaling
     * @param {string} imageId - Image identifier
     * @returns {boolean}
     */
    function isUpscaling(imageId) {
        return upscaleState.upscalingImages.has(imageId);
    }

    /**
     * Check if image has been upscaled
     * @param {string} imageId - Image identifier
     * @returns {boolean}
     */
    function isImageUpscaled(imageId) {
        return upscaleState.upscaledImages.has(imageId);
    }

    /**
     * Get upscaled image URL
     * @param {string} imageId - Image identifier
     * @returns {string} Upscaled URL or empty string
     */
    function getUpscaledUrl(imageId) {
        return upscaleState.upscaledImages.get(imageId) || '';
    }

    /**
     * Mark image as upscaled
     * @param {string} imageId - Image identifier
     * @param {string} upscaledUrl - Upscaled image URL
     */
    function markImageAsUpscaled(imageId, upscaledUrl) {
        upscaleState.upscaledImages.set(imageId, upscaledUrl);
    }

    /**
     * Set upscale progress
     * @param {string} imageId - Image identifier
     * @param {number} progress - Progress percentage (0-100)
     */
    function setUpscaleProgress(imageId, progress) {
        upscaleState.upscaleProgress.set(imageId, Math.min(100, Math.max(0, progress)));
        updateProgressUI(imageId, progress);
    }

    /**
     * Get upscale progress
     * @param {string} imageId - Image identifier
     * @returns {number} Progress percentage
     */
    function getUpscaleProgress(imageId) {
        return upscaleState.upscaleProgress.get(imageId) || 0;
    }

    /**
     * Update image in DOM with new URL
     * @param {string} imageId - Image identifier
     * @param {string} newUrl - New image URL
     */
    function updateImageInDOM(imageId, newUrl) {
        const imageElements = document.querySelectorAll(`[data-image-id="${imageId}"] img`);
        imageElements.forEach(img => {
            img.src = newUrl;
            img.dataset.upscaled = 'true';
        });
    }

    /**
     * Show upscaling UI (loader, progress bar)
     * @param {string} imageId - Image identifier
     */
    function showUpscalingUI(imageId) {
        const imageElements = document.querySelectorAll(`[data-image-id="${imageId}"]`);
        imageElements.forEach(el => {
            // Create and add loader
            const loader = document.createElement('div');
            loader.className = 'upscale-loader';
            loader.dataset.imageId = imageId;
            loader.innerHTML = '<div class="spinner"></div><p>Upscaling...</p>';
            el.appendChild(loader);
        });
    }

    /**
     * Hide upscaling UI
     * @param {string} imageId - Image identifier
     */
    function hideUpscalingUI(imageId) {
        const loaders = document.querySelectorAll(`.upscale-loader[data-image-id="${imageId}"]`);
        loaders.forEach(loader => {
            loader.remove();
        });
    }

    /**
     * Update progress bar UI
     * @param {string} imageId - Image identifier
     * @param {number} progress - Progress percentage
     */
    function updateProgressUI(imageId, progress) {
        const progressBar = document.querySelector(
            `.upscale-progress[data-image-id="${imageId}"]`
        );
        if (progressBar) {
            const bar = progressBar.querySelector('.progress-fill');
            if (bar) {
                bar.style.width = `${progress}%`;
            }
        }
    }

    /**
     * Show error notification
     * @param {string} message - Error message
     */
    function showErrorNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'upscale-error-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    /**
     * Cancel upscaling operation
     * @param {string} imageId - Image identifier
     */
    function cancelUpscaling(imageId) {
        upscaleState.upscalingImages.delete(imageId);
        upscaleState.upscaleProgress.delete(imageId);
        hideUpscalingUI(imageId);
    }

    /**
     * Clear all upscale state
     */
    function clearUpscaleState() {
        upscaleState.upscalingImages.clear();
        upscaleState.upscaledImages.clear();
        upscaleState.upscaleProgress.clear();
        upscaleState.upscaleErrors.clear();
    }

    /**
     * Get upscale statistics
     * @returns {object} Upscale state statistics
     */
    function getUpscaleStats() {
        return {
            upscaling: upscaleState.upscalingImages.size,
            upscaled: upscaleState.upscaledImages.size,
            errors: upscaleState.upscaleErrors.size,
            total: upscaleState.upscalingImages.size + upscaleState.upscaledImages.size
        };
    }

    // Public API
    return {
        upscaleImage,
        isUpscaling,
        isImageUpscaled,
        getUpscaledUrl,
        markImageAsUpscaled,
        handleUpscaleSuccess,
        handleUpscaleError,
        cancelUpscaling,
        clearUpscaleState,
        getUpscaleStats,
        setUpscaleProgress,
        getUpscaleProgress,
        // Debugging
        logUpscaleState: () => {
            console.log('[ChatImageUpscale] State:', {
                upscaling: Array.from(upscaleState.upscalingImages),
                upscaled: Array.from(upscaleState.upscaledImages.entries()),
                errors: Array.from(upscaleState.upscaleErrors.entries())
            });
        }
    };
})();

// Module registration
if (window.ChatCore && typeof window.ChatCore.registerModule === 'function') {
    window.ChatCore.registerModule('ChatImageUpscale', window.ChatImageUpscale);
}

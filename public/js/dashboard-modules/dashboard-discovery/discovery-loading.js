/**
 * Discovery Loading Module - Phase 5
 * Handles skeleton screens, shimmer animations, progressive image loading
 * Features: Blur-up technique, skeleton screens, smooth transitions
 * 
 * @requires DashboardImageLoader
 */

const DashboardDiscoveryLoading = (() => {
    const STATE = {
        loadingStates: new Map(), // id -> loading state
        shimmers: []
    };

    /**
     * Show skeleton screen for grid
     * @param {string} gridId - Grid ID
     * @param {number} count - Number of skeleton items
     * @param {string} aspectRatio - Aspect ratio (default: '1 / 1')
     */
    function showSkeletons(gridId, count = 12, aspectRatio = '1 / 1') {
        const grid = document.querySelector(`[data-grid-id="${gridId}"]`);
        if (!grid) {
            console.warn('[DashboardDiscoveryLoading] Grid not found:', gridId);
            return;
        }

        grid.innerHTML = '';

        for (let i = 0; i < count; i++) {
            const skeleton = createSkeletonItem(aspectRatio);
            grid.appendChild(skeleton);
        }

        console.log(`[DashboardDiscoveryLoading] Showed ${count} skeletons for grid: ${gridId}`);
    }

    /**
     * Create single skeleton item
     * @param {string} aspectRatio - Aspect ratio
     * @returns {Element}
     */
    function createSkeletonItem(aspectRatio = '1 / 1') {
        const item = document.createElement('div');
        item.className = 'skeleton-item';
        item.style.aspectRatio = aspectRatio;
        item.style.borderRadius = 'var(--radius-lg, 0.75rem)';
        item.style.background = 'var(--skeleton-bg, #f0f0f0)';
        item.style.position = 'relative';
        item.style.overflow = 'hidden';

        // Shimmer effect
        item.innerHTML = `
            <div class="skeleton-shimmer"></div>
        `;

        return item;
    }

    /**
     * Show loading state for carousel
     * @param {string} carouselId - Carousel ID
     * @param {number} count - Number of skeleton slides
     */
    function showCarouselSkeletons(carouselId, count = 5) {
        const carousel = document.querySelector(`[data-carousel-id="${carouselId}"]`);
        if (!carousel) {
            console.warn('[DashboardDiscoveryLoading] Carousel not found:', carouselId);
            return;
        }

        const wrapper = carousel.querySelector('.swiper-wrapper');
        if (!wrapper) return;

        wrapper.innerHTML = '';

        for (let i = 0; i < count; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'swiper-slide skeleton-slide';
            skeleton.innerHTML = `
                <div class="skeleton-item" style="height: 250px; width: 100%; aspect-ratio: auto;">
                    <div class="skeleton-shimmer"></div>
                </div>
            `;
            wrapper.appendChild(skeleton);
        }

        console.log(`[DashboardDiscoveryLoading] Showed ${count} skeleton slides for carousel: ${carouselId}`);
    }

    /**
     * Hide skeleton screen
     * @param {string} gridId - Grid ID
     */
    function hideSkeletons(gridId) {
        const grid = document.querySelector(`[data-grid-id="${gridId}"]`);
        if (!grid) return;

        const skeletons = grid.querySelectorAll('.skeleton-item');
        skeletons.forEach(skeleton => {
            skeleton.style.opacity = '0';
            skeleton.style.transition = 'opacity 0.3s ease-out';
            
            setTimeout(() => {
                skeleton.remove();
            }, 300);
        });

        console.log(`[DashboardDiscoveryLoading] Hid skeletons for grid: ${gridId}`);
    }

    /**
     * Progressive image loading with blur-up effect
     * @param {Element} imgElement - Image element
     * @param {string} src - Full resolution image URL
     * @param {string} blurUrl - Blur/placeholder image URL
     */
    function progressiveLoad(imgElement, src, blurUrl) {
        return new Promise((resolve, reject) => {
            if (!imgElement) {
                reject(new Error('Image element is required'));
                return;
            }

            // Set blur placeholder
            if (blurUrl) {
                imgElement.style.backgroundImage = `url(${blurUrl})`;
                imgElement.style.backgroundSize = 'cover';
                imgElement.style.backgroundPosition = 'center';
                imgElement.style.filter = 'blur(10px)';
            }

            // Load full resolution image
            const img = new Image();
            img.onload = () => {
                imgElement.src = src;
                imgElement.style.filter = 'blur(0px)';
                imgElement.style.transition = 'filter 0.3s ease-out';
                setTimeout(() => {
                    imgElement.style.backgroundImage = 'none';
                }, 300);
                resolve(imgElement);
            };

            img.onerror = () => {
                reject(new Error(`Failed to load image: ${src}`));
            };

            // Start loading in background
            img.src = src;
        });
    }

    /**
     * Batch progressive load multiple images
     * @param {Array<Element>} images - Image elements
     * @param {Object} urlMap - Map of image element to { src, blur }
     */
    function progressiveLoadBatch(images, urlMap) {
        const promises = images.map(img => {
            const urls = urlMap.get(img) || {};
            return progressiveLoad(img, urls.src, urls.blur).catch(err => {
                console.warn('[DashboardDiscoveryLoading] Error loading image:', err);
            });
        });

        return Promise.all(promises);
    }

    /**
     * Create shimmer animation CSS
     * @returns {string}
     */
    function getShimmerCSS() {
        return `
            @keyframes shimmer {
                0% {
                    background-position: -1000px 0;
                }
                100% {
                    background-position: 1000px 0;
                }
            }

            .skeleton-shimmer {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(
                    90deg,
                    transparent,
                    rgba(255, 255, 255, 0.2),
                    transparent
                );
                background-size: 1000px 100%;
                animation: shimmer 2s infinite;
            }
        `;
    }

    /**
     * Initialize shimmer animation styles
     */
    function initShimmers() {
        // Check if shimmer styles already added
        if (document.querySelector('style[data-shimmer-styles]')) {
            return;
        }

        const style = document.createElement('style');
        style.setAttribute('data-shimmer-styles', 'true');
        style.textContent = getShimmerCSS();
        document.head.appendChild(style);

        STATE.shimmers.push(style);
        console.log('[DashboardDiscoveryLoading] Initialized shimmer animations');
    }

    /**
     * Show loading indicator
     * @param {Element} container - Container element
     * @param {Object} options - Configuration options
     */
    function showLoadingIndicator(container, options = {}) {
        const {
            type = 'spinner', // 'spinner', 'dots', 'pulse'
            message = 'Loading...'
        } = options;

        const loader = document.createElement('div');
        loader.className = 'discovery-loader';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="loader-${type}"></div>
                <p class="loader-message">${escapeHtml(message)}</p>
            </div>
        `;

        container.innerHTML = '';
        container.appendChild(loader);

        return loader;
    }

    /**
     * Hide loading indicator
     * @param {Element} container - Container element
     */
    function hideLoadingIndicator(container) {
        const loader = container.querySelector('.discovery-loader');
        if (loader) {
            loader.style.opacity = '0';
            loader.style.transition = 'opacity 0.3s ease-out';
            
            setTimeout(() => {
                loader.remove();
            }, 300);
        }
    }

    /**
     * Show transition animation between content
     * @param {Element} element - Element to animate
     */
    function showTransition(element) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(10px)';
        element.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';

        // Trigger reflow to apply initial styles
        void element.offsetHeight;

        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
    }

    /**
     * Fade out element
     * @param {Element} element - Element to fade out
     * @returns {Promise}
     */
    function fadeOut(element) {
        return new Promise((resolve) => {
            element.style.opacity = '0';
            element.style.transition = 'opacity 0.3s ease-out';

            setTimeout(() => {
                resolve();
            }, 300);
        });
    }

    /**
     * Fade in element
     * @param {Element} element - Element to fade in
     * @returns {Promise}
     */
    function fadeIn(element) {
        return new Promise((resolve) => {
            element.style.opacity = '0';
            
            // Trigger reflow
            void element.offsetHeight;
            
            element.style.opacity = '1';
            element.style.transition = 'opacity 0.3s ease-in';

            setTimeout(() => {
                element.style.transition = '';
                resolve();
            }, 300);
        });
    }

    /**
     * Clean up loading states
     * @param {string} id - Optional ID to clean specific state
     */
    function cleanup(id) {
        if (id) {
            STATE.loadingStates.delete(id);
        } else {
            STATE.loadingStates.clear();
        }
    }

    /**
     * Destroy all loading elements
     */
    function destroy() {
        STATE.shimmers.forEach(style => style.remove());
        STATE.shimmers = [];
        STATE.loadingStates.clear();
        console.log('[DashboardDiscoveryLoading] Destroyed');
    }

    // ==================== Helper Functions ====================

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // ==================== Public API ====================

    return {
        showSkeletons,
        hideSkeletons,
        showCarouselSkeletons,
        progressiveLoad,
        progressiveLoadBatch,
        initShimmers,
        showLoadingIndicator,
        hideLoadingIndicator,
        showTransition,
        fadeOut,
        fadeIn,
        cleanup,
        destroy
    };
})();

// Export for use
if (typeof window !== 'undefined') {
    window.DashboardDiscoveryLoading = DashboardDiscoveryLoading;
}

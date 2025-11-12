/**
 * Image Loader Module - Phase 4
 * 
 * Handles lazy loading and progressive image loading for the dashboard galleries.
 * Implements caching and efficient image preloading strategies.
 * 
 * Public API:
 * - lazyLoadImages(selector) - Initialize lazy loading for elements
 * - preloadImages(urls) - Preload images into memory
 * - loadImage(url) - Load a single image
 * - clearImageCache() - Clear the image cache
 */

if (typeof DashboardImageLoader === 'undefined') {
    window.DashboardImageLoader = {
        // Configuration
        config: {
            observerThreshold: 0.1,
            observerRootMargin: '50px',
            imageLoadingClass: 'image-loading',
            imageLoadedClass: 'image-loaded',
            imageErrorClass: 'image-error',
            retryCount: 3,
            retryDelay: 1000 // milliseconds
        },

        // Cache for loaded images
        imageCache: new Map(),
        loadingPromises: new Map(),
        
        // Intersection Observer instance
        observer: null,

        /**
         * Initialize the image loader (one-time setup)
         */
        init: function() {
            if (this.observer) return; // Already initialized

            const self = this;
            this.observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            self._loadImageElement(entry.target);
                        }
                    });
                },
                {
                    threshold: this.config.observerThreshold,
                    rootMargin: this.config.observerRootMargin
                }
            );

            console.log('[ImageLoader] Initialized with observer');
        },

        /**
         * Setup lazy loading for images with data-src attribute
         * @param {string} selector - CSS selector for image elements
         * @returns {void}
         */
        lazyLoadImages: function(selector) {
            if (!this.observer) {
                this.init();
            }

            const images = document.querySelectorAll(selector);
            images.forEach((img) => {
                if (img.dataset.src && !img.classList.contains(this.config.imageLoadedClass)) {
                    this.observer.observe(img);
                    img.classList.add(this.config.imageLoadingClass);
                }
            });

            console.log(`[ImageLoader] Set up lazy loading for ${images.length} images`);
        },

        /**
         * Load a single image element
         * @private
         */
        _loadImageElement: function(imgElement) {
            const src = imgElement.dataset.src;
            if (!src) return;

            this.observer.unobserve(imgElement);
            imgElement.classList.add(this.config.imageLoadingClass);

            this.loadImage(src)
                .then((blob) => {
                    this._renderImage(imgElement, blob);
                    imgElement.classList.remove(this.config.imageLoadingClass);
                    imgElement.classList.add(this.config.imageLoadedClass);
                })
                .catch((error) => {
                    console.error('[ImageLoader] Failed to load image:', src, error);
                    imgElement.classList.remove(this.config.imageLoadingClass);
                    imgElement.classList.add(this.config.imageErrorClass);
                    this._handleImageError(imgElement);
                });
        },

        /**
         * Load an image URL with caching and retry logic
         * @param {string} url - The image URL to load
         * @param {number} attempt - Current retry attempt
         * @returns {Promise<Blob>} Resolves with image blob
         */
        loadImage: function(url, attempt = 1) {
            // Return cached promise if already loading
            if (this.loadingPromises.has(url)) {
                return this.loadingPromises.get(url);
            }

            // Return cached blob if already loaded
            if (this.imageCache.has(url)) {
                return Promise.resolve(this.imageCache.get(url));
            }

            const promise = this._fetchImage(url)
                .then((blob) => {
                    this.imageCache.set(url, blob);
                    this.loadingPromises.delete(url);
                    return blob;
                })
                .catch((error) => {
                    this.loadingPromises.delete(url);

                    // Retry logic
                    if (attempt < this.config.retryCount) {
                        console.warn(`[ImageLoader] Retry attempt ${attempt + 1}/${this.config.retryCount} for ${url}`);
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                this.loadImage(url, attempt + 1).then(resolve);
                            }, this.config.retryDelay);
                        });
                    }

                    throw error;
                });

            this.loadingPromises.set(url, promise);
            return promise;
        },

        /**
         * Fetch image from network
         * @private
         */
        _fetchImage: function(url) {
            return fetch(url, {
                credentials: 'include'
            })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`HTTP Error: ${response.status}`);
                    }
                    return response.blob();
                });
        },

        /**
         * Render image blob to element
         * @private
         */
        _renderImage: function(imgElement, blob) {
            const objectUrl = URL.createObjectURL(blob);
            imgElement.src = objectUrl;
            imgElement.dataset.loaded = 'true';
        },

        /**
         * Handle image load error
         * @private
         */
        _handleImageError: function(imgElement) {
            const fallbackSrc = imgElement.dataset.fallback || '/img/image-placeholder.png';
            imgElement.src = fallbackSrc;
        },

        /**
         * Preload multiple images
         * @param {Array<string>} urls - Array of image URLs to preload
         * @returns {Promise<void>} Resolves when all images are loaded
         */
        preloadImages: function(urls) {
            if (!Array.isArray(urls)) {
                console.warn('[ImageLoader] preloadImages expects an array');
                return Promise.resolve();
            }

            const promises = urls.map((url) => {
                return this.loadImage(url).catch((err) => {
                    console.warn('[ImageLoader] Failed to preload:', url, err);
                    return null;
                });
            });

            return Promise.all(promises);
        },

        /**
         * Get image cache statistics
         */
        getCacheStats: function() {
            return {
                cachedImages: this.imageCache.size,
                loadingPromises: this.loadingPromises.size,
                cacheMemoryEstimate: `${(this.imageCache.size * 500)} KB (estimated)`
            };
        },

        /**
         * Clear the image cache
         * @param {string} url - Optional specific URL to clear, or clears all
         */
        clearImageCache: function(url) {
            if (url) {
                this.imageCache.delete(url);
                console.log('[ImageLoader] Cleared cache for:', url);
            } else {
                this.imageCache.clear();
                console.log('[ImageLoader] Cleared entire image cache');
            }
        },

        /**
         * Cleanup and destroy the observer
         */
        destroy: function() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            this.imageCache.clear();
            this.loadingPromises.clear();
            console.log('[ImageLoader] Destroyed');
        }
    };

    // Global wrapper functions for backward compatibility
    window.lazyLoadImages = function(selector) {
        window.DashboardImageLoader.lazyLoadImages(selector);
    };

    window.preloadImages = function(urls) {
        return window.DashboardImageLoader.preloadImages(urls);
    };
}

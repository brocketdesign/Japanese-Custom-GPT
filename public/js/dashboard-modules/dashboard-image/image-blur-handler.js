/**
 * Image Blur Handler Module - Phase 4
 * 
 * Handles image blurring and overlay creation for NSFW content in the dashboard.
 * Centralizes blur logic scattered across dashboard.js and dashboard-infinite-scroll.js
 * 
 * Public API:
 * - blurImage(imgElement) - Apply blur to image element
 * - createImageOverlay(imgElement, imageUrl) - Create NSFW overlay
 * - shouldBlurNSFW(item, subscriptionStatus) - Determine if item should be blurred
 * - getBlurredImageUrl(imageUrl) - Fetch blurred version of image
 */

if (typeof DashboardImageBlurHandler === 'undefined') {
    window.DashboardImageBlurHandler = {
        // Configuration
        config: {
            blurAmount: '8px',
            blurFilter: 'filter: blur(8px);',
            galleryBlurFilter: 'filter: blur(15px);',
            overlayOpacity: '0.6',
            blurEndpoint: '/blur-image',
            nsfw_placeholder: '/img/nsfw-blurred-2.png'
        },

        // Cache for blurred images to avoid redundant API calls
        blurredImageCache: new Map(),
        blurredImageCacheTTL: 60 * 60 * 1000, // 1 hour

        /**
         * Determine if an item should be blurred based on NSFW flag and user subscription
         * @param {Object} item - The media item with nsfw property
         * @param {boolean} subscriptionStatus - User's subscription status
         * @returns {boolean} true if item should be blurred
         */
        shouldBlurNSFW: function(item, subscriptionStatus) {
            if (!item) return false;
            const isNSFW = !!item.nsfw;
            const isTemporary = !!window.user?.isTemporary;
            
            // Blur if NSFW AND user is temporary OR not subscribed
            return isNSFW && (isTemporary || !subscriptionStatus);
        },

        /**
         * Apply blur effect to an image element
         * @param {HTMLElement} imgElement - The image element to blur
         * @returns {void}
         */
        blurImage: function(imgElement) {
            if (!imgElement || $(imgElement).data('processed') === 'true') return;
            
            const $img = $(imgElement);
            const imageUrl = $img.data('src') || $img.attr('src');
            
            if (!imageUrl) {
                console.warn('[ImageBlurHandler] No image URL found');
                return;
            }

            this.fetchBlurredImage(imgElement, imageUrl);
        },

        /**
         * Fetch blurred version of an image from server
         * @param {HTMLElement} imgElement - The image element
         * @param {string} imageUrl - The image URL to blur
         * @returns {void}
         */
        fetchBlurredImage: function(imgElement, imageUrl) {
            const self = this;
            const $img = $(imgElement);

            // Check cache first
            if (this.blurredImageCache.has(imageUrl)) {
                const cached = this.blurredImageCache.get(imageUrl);
                if (Date.now() - cached.timestamp < this.blurredImageCacheTTL) {
                    this._handleImageSuccess(imgElement, cached.blob, imageUrl);
                    return;
                } else {
                    this.blurredImageCache.delete(imageUrl);
                }
            }

            $.ajax({
                url: `${this.config.blurEndpoint}?url=${encodeURIComponent(imageUrl)}`,
                method: 'GET',
                xhrFields: {
                    withCredentials: true,
                    responseType: 'blob'
                },
                success: function(blob) {
                    // Cache the result
                    self.blurredImageCache.set(imageUrl, {
                        blob: blob,
                        timestamp: Date.now()
                    });
                    self._handleImageSuccess(imgElement, blob, imageUrl);
                },
                error: function() {
                    console.error('[ImageBlurHandler] Failed to load blurred image:', imageUrl);
                    // Fallback: use placeholder image
                    $img.attr('src', self.config.nsfw_placeholder).data('processed', 'true');
                }
            });
        },

        /**
         * Handle successful blur image fetch
         * @private
         */
        _handleImageSuccess: function(imgElement, blob, imageUrl) {
            const $img = $(imgElement);
            let objectUrl = URL.createObjectURL(blob);
            
            $img.attr('src', objectUrl)
                .data('processed', 'true')
                .removeAttr('data-original-src')
                .removeAttr('data-src')
                .removeAttr('srcset');

            // Create overlay for NSFW content
            this.createImageOverlay(imgElement, imageUrl);
        },

        /**
         * Create overlay for NSFW content with unlock/subscribe button
         * @param {HTMLElement} imgElement - The image element
         * @param {string} imageUrl - Original image URL (for showing in modal)
         * @returns {void}
         */
        createImageOverlay: function(imgElement, imageUrl) {
            const $img = $(imgElement);
            const isTemporary = !!window.user?.isTemporary;
            const subscriptionStatus = window.user?.subscriptionStatus === 'active';
            const showNSFW = sessionStorage.getItem('showNSFW') === 'true';

            // Check if overlay already exists
            if ($img.next('.gallery-nsfw-overlay').length) {
                $img.next('.gallery-nsfw-overlay').remove();
            }

            // Don't create overlay if NSFW is enabled in settings
            if (showNSFW) {
                return;
            }

            // Create overlay HTML
            const overlayHTML = this._createOverlayHTML(isTemporary, subscriptionStatus, imageUrl);
            
            // Insert overlay after image
            $img.after(overlayHTML);

            // Attach event listeners
            const $overlay = $img.next('.gallery-nsfw-overlay');
            this._attachOverlayEvents($overlay, imgElement);
        },

        /**
         * Generate overlay HTML
         * @private
         */
        _createOverlayHTML: function(isTemporary, subscriptionStatus, imageUrl) {
            const canUnlock = !isTemporary && subscriptionStatus;
            const unlockButton = canUnlock 
                ? `<button class="btn btn-light btn-sm unlock-image-btn" data-url="${imageUrl}">
                        <i class="bi bi-unlock"></i> ${window.translations?.actions?.unlock || 'Unlock'}
                    </button>`
                : `<button class="btn btn-light btn-sm" onclick="window.showPremiumPopup && window.showPremiumPopup()">
                        <i class="bi bi-star"></i> ${window.translations?.premium?.required || 'Premium Required'}
                    </button>`;

            return `
                <div class="gallery-nsfw-overlay position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
                     style="background-color: rgba(0,0,0,${this.config.overlayOpacity}); z-index: 10; border-radius: inherit;">
                    <div class="text-center text-white">
                        <i class="bi bi-exclamation-triangle-fill" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                        <p style="margin-bottom: 1rem;">${window.translations?.content?.nsfw || 'NSFW Content'}</p>
                        ${unlockButton}
                    </div>
                </div>
            `;
        },

        /**
         * Attach event listeners to overlay buttons
         * @private
         */
        _attachOverlayEvents: function($overlay, imgElement) {
            const self = this;

            // Unlock button handler
            $overlay.find('.unlock-image-btn').on('click', function(e) {
                e.stopPropagation();
                const imageUrl = $(this).data('url');
                if (typeof window.handleUnlockImage === 'function') {
                    window.handleUnlockImage(imgElement, 'image', imageUrl);
                }
            });

            // Prevent click propagation to gallery click handler
            $overlay.on('click', function(e) {
                if (e.target.closest('button')) {
                    e.stopPropagation();
                }
            });
        },

        /**
         * Clear blur cache (useful for cleanup)
         */
        clearCache: function() {
            this.blurredImageCache.clear();
        },

        /**
         * Get cache statistics for debugging
         */
        getCacheStats: function() {
            return {
                size: this.blurredImageCache.size,
                items: Array.from(this.blurredImageCache.keys())
            };
        }
    };

    // Global wrapper functions for backward compatibility
    window.blurImage = function(imgElement) {
        window.DashboardImageBlurHandler.blurImage(imgElement);
    };

    window.shouldBlurNSFW = function(item, subscriptionStatus) {
        return window.DashboardImageBlurHandler.shouldBlurNSFW(item, subscriptionStatus);
    };

    window.createOverlay = function(imgElement, imageUrl) {
        window.DashboardImageBlurHandler.createImageOverlay(imgElement, imageUrl);
    };

    window.fetchBlurredImage = function(imgElement, imageUrl) {
        window.DashboardImageBlurHandler.fetchBlurredImage(imgElement, imageUrl);
    };
}

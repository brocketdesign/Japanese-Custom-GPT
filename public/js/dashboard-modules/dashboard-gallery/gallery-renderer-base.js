/**
 * Gallery Renderer Base Module
 * 
 * Shared gallery rendering logic and templates for all gallery types.
 * Provides base functionality used by all specific gallery implementations.
 * 
 * @author Dashboard Refactor Phase 2
 * @date November 12, 2025
 */

'use strict';

if (typeof GalleryRendererBase === 'undefined') {
    window.GalleryRendererBase = (() => {
        /**
         * Generate base card HTML template
         * 
         * @param {Object} item - Gallery item (chat, post, video)
         * @param {Object} options - Rendering options
         * @returns {string} HTML string
         */
        const generateCardTemplate = (item, options = {}) => {
            try {
                const {
                    type = 'chat',
                    showNSFW = false,
                    isAdmin = false,
                    isTemporary = false,
                    onClickHandler = 'null'
                } = options;

                const cardId = `gallery-card-${item._id || item.id}`;
                const isBlurred = !showNSFW && item.nsfw;
                const placeholder = '/img/nsfw-blurred-2.png';

                // Determine avatar
                const avatar = item.avatar || item.image || '/img/default-avatar.png';

                // Determine title
                const title = item.name || item.title || 'Unknown';

                // Create blur overlay HTML if needed
                const blurOverlay = isBlurred ? generateNSFWOverlay(true, item.userId || item.owner_id) : '';

                // Build card HTML
                return `
                    <div class="gallery-card" id="${cardId}" data-item-id="${item._id || item.id}" data-type="${type}">
                        <div class="card-image-container">
                            <img 
                                class="card-image lazy-load" 
                                src="${placeholder}" 
                                data-src="${isBlurred ? placeholder : avatar}"
                                alt="${title}"
                                loading="lazy"
                            />
                            ${blurOverlay}
                        </div>
                        <div class="card-content">
                            <h3 class="card-title" title="${title}">${title}</h3>
                            ${generateCardMetadata(item, options)}
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('[GalleryRendererBase] Card template generation error:', error);
                return '';
            }
        };

        /**
         * Generate metadata section for card
         * Includes likes, followers, dates, etc.
         * 
         * @param {Object} item - Gallery item
         * @param {Object} options - Rendering options
         * @returns {string} HTML metadata
         */
        const generateCardMetadata = (item, options = {}) => {
            try {
                const { type = 'chat' } = options;
                let metadata = '<div class="card-metadata">';

                if (type === 'chat') {
                    // Chat-specific metadata
                    if (item.followers) {
                        metadata += `<span class="meta-item"><i class="fas fa-users"></i> ${item.followers}</span>`;
                    }
                    if (item.created_at) {
                        const date = new Date(item.created_at);
                        metadata += `<span class="meta-item"><i class="far fa-calendar"></i> ${date.toLocaleDateString()}</span>`;
                    }
                } else if (type === 'video') {
                    // Video-specific metadata
                    if (item.duration) {
                        metadata += `<span class="meta-item"><i class="fas fa-play"></i> ${formatDuration(item.duration)}</span>`;
                    }
                    if (item.views) {
                        metadata += `<span class="meta-item"><i class="fas fa-eye"></i> ${formatNumber(item.views)}</span>`;
                    }
                } else if (type === 'post') {
                    // Post-specific metadata
                    if (item.likes) {
                        metadata += `<span class="meta-item"><i class="fas fa-heart"></i> ${item.likes}</span>`;
                    }
                    if (item.created_at) {
                        const date = new Date(item.created_at);
                        metadata += `<span class="meta-item"><i class="far fa-calendar"></i> ${date.toLocaleDateString()}</span>`;
                    }
                }

                metadata += '</div>';
                return metadata;
            } catch (error) {
                console.error('[GalleryRendererBase] Metadata generation error:', error);
                return '';
            }
        };

        /**
         * Generate NSFW content overlay
         * 
         * @param {boolean} isNSFW - Whether content is NSFW
         * @param {string} userId - User ID for unlock functionality
         * @returns {string} HTML overlay
         */
        const generateNSFWOverlay = (isNSFW, userId) => {
            if (!isNSFW) return '';

            try {
                return `
                    <div class="nsfw-overlay">
                        <div class="nsfw-badge">
                            <i class="fas fa-eye-slash"></i>
                            <span>NSFW Content</span>
                        </div>
                        ${window.user && window.user.isAdmin ? `
                            <div class="admin-controls">
                                <button 
                                    class="btn btn-sm btn-secondary" 
                                    onclick="window.toggleImageNSFW(this)"
                                    data-user-id="${userId}"
                                    title="Toggle NSFW"
                                >
                                    <i class="fas fa-edit"></i>
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `;
            } catch (error) {
                console.error('[GalleryRendererBase] NSFW overlay generation error:', error);
                return '';
            }
        };

        /**
         * Apply lazy loading to container images
         * 
         * @param {string|HTMLElement} container - Container selector or element
         */
        const applyLazyLoading = (container) => {
            try {
                const containerEl = typeof container === 'string' 
                    ? document.querySelector(container)
                    : container;

                if (!containerEl) return;

                const images = containerEl.querySelectorAll('img.lazy-load');

                if ('IntersectionObserver' in window) {
                    const imageObserver = new IntersectionObserver((entries, observer) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                const img = entry.target;
                                img.src = img.dataset.src;
                                img.classList.remove('lazy-load');
                                observer.unobserve(img);
                            }
                        });
                    });

                    images.forEach(img => imageObserver.observe(img));
                } else {
                    // Fallback for browsers without IntersectionObserver
                    images.forEach(img => {
                        img.src = img.dataset.src;
                        img.classList.remove('lazy-load');
                    });
                }

                console.debug('[GalleryRendererBase] Lazy loading applied to', images.length, 'images');
            } catch (error) {
                console.error('[GalleryRendererBase] Lazy loading error:', error);
            }
        };

        /**
         * Apply consistent grid layout to gallery
         * 
         * @param {string} selector - Gallery container selector
         * @param {number} gridSize - Number of columns (2, 3, or 4)
         */
        const applyGridLayout = (selector = '.gallery-container', gridSize = 2) => {
            try {
                const container = document.querySelector(selector);
                if (!container) return;

                const validGridSizes = [2, 3, 4];
                const size = validGridSizes.includes(gridSize) ? gridSize : 2;

                container.style.display = 'grid';
                container.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
                container.style.gap = '1rem';

                console.debug('[GalleryRendererBase] Grid layout applied:', size, 'columns');
            } catch (error) {
                console.error('[GalleryRendererBase] Grid layout error:', error);
            }
        };

        /**
         * Create image card HTML (legacy compatibility)
         * 
         * @param {Object} item - Gallery item
         * @param {boolean} isBlur - Whether to blur
         * @param {boolean} isLiked - Whether item is liked
         * @param {boolean} isAdmin - Whether user is admin
         * @param {boolean} isTemporary - Whether user is temporary
         * @param {number} loadedIndex - Index in loaded items
         * @param {string} id - Container ID
         * @param {string} type - Gallery type
         * @returns {string} HTML
         */
        const createImageCard = (item, isBlur, isLiked, isAdmin, isTemporary, loadedIndex, id, type, onChatPage = false) => {
            try {
                const placeholder = '/img/nsfw-blurred-2.png';
                const imageSrc = isBlur ? placeholder : item.image;
                const itemId = item._id || item.id;

                return `
                    <div class="image-card" data-index="${loadedIndex}" data-item-id="${itemId}">
                        <div class="image-wrapper">
                            <img 
                                class="gallery-image lazy-load"
                                src="${placeholder}"
                                data-src="${imageSrc}"
                                alt="${item.title || 'Image'}"
                                loading="lazy"
                            />
                            ${isBlur ? generateNSFWOverlay(true, item.userId) : ''}
                            <div class="image-overlay">
                                ${!isTemporary && !onChatPage ? `
                                    <button 
                                        class="btn-icon favorite-btn ${isLiked ? 'liked' : ''}"
                                        onclick="window.toggleImageFavorite(this)"
                                        data-item-id="${itemId}"
                                        title="${isLiked ? 'Remove from favorites' : 'Add to favorites'}"
                                    >
                                        <i class="fas fa-heart"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        <div class="image-info">
                            <h4>${item.title || 'Untitled'}</h4>
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('[GalleryRendererBase] Image card creation error:', error);
                return '';
            }
        };

        /**
         * Create video card HTML (legacy compatibility)
         * 
         * @param {Object} video - Video item
         * @param {boolean} isBlur - Whether to blur
         * @param {boolean} isTemporary - Whether user is temporary
         * @returns {string} HTML
         */
        const createVideoCard = (video, isBlur, isTemporary) => {
            try {
                const placeholder = '/img/nsfw-blurred-2.png';
                const videoId = video._id || video.id;
                const duration = formatDuration(video.duration || 0);

                return `
                    <div class="video-card" data-video-id="${videoId}">
                        <div class="video-wrapper">
                            <img 
                                class="video-thumbnail lazy-load"
                                src="${placeholder}"
                                data-src="${isBlur ? placeholder : (video.thumbnail || video.image)}"
                                alt="${video.title || 'Video'}"
                                loading="lazy"
                            />
                            ${isBlur ? generateNSFWOverlay(true, video.userId) : ''}
                            <div class="play-button">
                                <i class="fas fa-play"></i>
                            </div>
                            <div class="video-duration">${duration}</div>
                            ${!isTemporary ? `
                                <div class="video-overlay">
                                    <button 
                                        class="btn-icon favorite-btn"
                                        onclick="window.toggleVideoNSFW(this)"
                                        data-video-id="${videoId}"
                                        title="Toggle NSFW"
                                    >
                                        <i class="fas fa-eye-slash"></i>
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                        <div class="video-info">
                            <h4>${video.title || 'Untitled Video'}</h4>
                            <p class="video-meta">${formatNumber(video.views || 0)} views</p>
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('[GalleryRendererBase] Video card creation error:', error);
                return '';
            }
        };

        /**
         * Format duration in seconds to HH:MM:SS
         * 
         * @param {number} seconds - Duration in seconds
         * @returns {string} Formatted duration
         */
        const formatDuration = (seconds) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);

            if (hours > 0) {
                return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            }
            return `${minutes}:${String(secs).padStart(2, '0')}`;
        };

        /**
         * Format large numbers (e.g., 1000 -> 1K)
         * 
         * @param {number} num - Number to format
         * @returns {string} Formatted number
         */
        const formatNumber = (num) => {
            if (num >= 1000000) {
                return (num / 1000000).toFixed(1) + 'M';
            }
            if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'K';
            }
            return num.toString();
        };

        /**
         * Clear all items from gallery
         * 
         * @param {string} selector - Gallery container selector
         */
        const clearGallery = (selector = '.gallery-container') => {
            try {
                const container = document.querySelector(selector);
                if (container) {
                    container.innerHTML = '';
                    console.debug('[GalleryRendererBase] Gallery cleared:', selector);
                }
            } catch (error) {
                console.error('[GalleryRendererBase] Clear gallery error:', error);
            }
        };

        /**
         * Get diagnostic information
         * 
         * @returns {Object} Diagnostic info
         */
        const getDiagnostics = () => {
            return {
                module: 'GalleryRendererBase',
                methods: [
                    'generateCardTemplate',
                    'generateNSFWOverlay',
                    'applyLazyLoading',
                    'applyGridLayout',
                    'createImageCard',
                    'createVideoCard',
                    'clearGallery'
                ],
                status: 'ready'
            };
        };

        // Public API
        return {
            generateCardTemplate,
            generateNSFWOverlay,
            applyLazyLoading,
            applyGridLayout,
            createImageCard,
            createVideoCard,
            clearGallery,
            getDiagnostics
        };
    })();

    // Auto-register with Phase 1 system if available
    if (typeof DashboardApp !== 'undefined') {
        DashboardApp.registerModule('GalleryRendererBase', GalleryRendererBase);
    }
}

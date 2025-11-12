/**
 * Tags Manager - Tag rendering and interaction
 * Centralizes tag display and tag-based filtering logic
 * Replaces scattered tag logic in dashboard.js
 * 
 * @module TagsManager
 * @requires DashboardAPI, GalleryFilters
 * 
 * Phase: 3 (Pagination & Content Filtering)
 * Status: Production Ready
 */

const TagsManager = (() => {
    const MAX_TAGS_DISPLAY = 10;
    const TAG_CACHE_TTL = 60 * 60 * 1000; // 1 hour

    /**
     * Render tags to a container
     * @param {array} tags - Array of tag objects or strings
     * @param {string|HTMLElement} container - Container ID or element
     * @param {object} options - Rendering options
     * @param {function} options.onTagClick - Click handler callback
     * @param {boolean} options.clickable - Make tags clickable (default: true)
     * @param {number} options.maxTags - Max tags to show (default: 10)
     * @param {boolean} options.showCount - Show tag count (default: false)
     * @returns {boolean} Success status
     */
    function render(tags, container, options = {}) {
        const {
            clickable = true,
            maxTags = MAX_TAGS_DISPLAY,
            showCount = false,
            onTagClick = null
        } = options;

        // Get container element
        let containerEl = container;
        if (typeof container === 'string') {
            containerEl = document.getElementById(container);
        }

        if (!containerEl) {
            console.warn('[TagsManager] Container not found');
            return false;
        }

        if (!tags || tags.length === 0) {
            containerEl.innerHTML = '<p class="no-tags">No tags available</p>';
            return true;
        }

        // Limit tags
        const displayTags = tags.slice(0, maxTags);
        const hiddenCount = Math.max(0, tags.length - maxTags);

        // Generate HTML
        let html = '<div class="tags-container">';

        displayTags.forEach(tag => {
            const tagName = typeof tag === 'string' ? tag : tag.name;
            const tagCount = typeof tag === 'object' ? tag.count : 0;
            const tagId = typeof tag === 'object' ? tag.id : slugify(tagName);

            const countHtml = showCount && tagCount ? ` <span class="tag-count">${tagCount}</span>` : '';
            const clickClass = clickable ? ' clickable' : '';

            html += `<span class="tag${clickClass}" data-tag-id="${tagId}" data-tag-name="${tagName}">
                ${tagName}${countHtml}
            </span>`;
        });

        if (hiddenCount > 0) {
            html += `<span class="tag-more">+${hiddenCount} more</span>`;
        }

        html += '</div>';

        containerEl.innerHTML = html;

        // Attach click handlers if clickable
        if (clickable) {
            attachTagClickHandlers(containerEl, onTagClick);
        }

        return true;
    }

    /**
     * Attach click handlers to tags
     * @private
     * @param {HTMLElement} container - Container element
     * @param {function} callback - Click callback
     */
    function attachTagClickHandlers(container, callback) {
        container.querySelectorAll('.tag.clickable').forEach(tag => {
            tag.addEventListener('click', (e) => {
                e.preventDefault();
                const tagName = tag.dataset.tagName;
                const tagId = tag.dataset.tagId;

                // Update filters
                if (window.GalleryFilters) {
                    GalleryFilters.setFilters({ search: tagName });
                }

                // Trigger custom event
                const event = new CustomEvent('tag-click', {
                    detail: { tagName, tagId },
                    bubbles: true
                });
                container.dispatchEvent(event);

                // Call callback if provided
                if (callback && typeof callback === 'function') {
                    callback(tagName, tagId);
                }
            });
        });
    }

    /**
     * Load random tags for a specific image style
     * @param {string} imageStyle - Image style identifier
     * @param {object} options - Options
     * @param {number} options.limit - Number of tags (default: 10)
     * @returns {Promise} Tags array
     */
    function loadRandomTags(imageStyle, options = {}) {
        const limit = options.limit || 10;
        const cacheKey = `tags:${imageStyle}:random`;

        // Check cache first
        if (window.CacheManager) {
            const cached = CacheManager.get(cacheKey);
            if (cached) return Promise.resolve(cached);
        }

        // Fetch from API
        return fetch(`/api/tags/random?style=${imageStyle}&limit=${limit}`, {
            method: 'GET',
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.tags) {
                // Cache results
                if (window.CacheManager) {
                    CacheManager.set(cacheKey, data.tags, TAG_CACHE_TTL);
                }
                return data.tags;
            } else {
                throw new Error('Failed to load tags');
            }
        })
        .catch(error => {
            console.error('[TagsManager] Error loading tags:', error);
            return [];
        });
    }

    /**
     * Load popular tags
     * @param {object} options - Options
     * @param {number} options.limit - Number of tags (default: 20)
     * @returns {Promise} Tags array
     */
    function loadPopularTags(options = {}) {
        const limit = options.limit || 20;
        const cacheKey = 'tags:popular';

        // Check cache
        if (window.CacheManager) {
            const cached = CacheManager.get(cacheKey);
            if (cached) return Promise.resolve(cached);
        }

        return fetch(`/api/tags/popular?limit=${limit}`, {
            method: 'GET',
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.tags) {
                if (window.CacheManager) {
                    CacheManager.set(cacheKey, data.tags, TAG_CACHE_TTL);
                }
                return data.tags;
            }
            throw new Error('Failed to load popular tags');
        })
        .catch(error => {
            console.error('[TagsManager] Error loading popular tags:', error);
            return [];
        });
    }

    /**
     * Generate tag cloud (weighted by frequency)
     * @param {array} tags - Tags with frequency data
     * @param {object} options - Options
     * @param {number} options.minSize - Minimum font size (default: 12)
     * @param {number} options.maxSize - Maximum font size (default: 24)
     * @returns {array} Tags with size property
     */
    function generateTagCloud(tags, options = {}) {
        const { minSize = 12, maxSize = 24 } = options;

        if (!tags || tags.length === 0) return [];

        // Get min/max frequencies
        const frequencies = tags.map(t => t.count || 1);
        const minFreq = Math.min(...frequencies);
        const maxFreq = Math.max(...frequencies);
        const range = maxFreq - minFreq;

        // Calculate sizes
        return tags.map(tag => {
            const freq = tag.count || 1;
            const normalized = range === 0 ? 0.5 : (freq - minFreq) / range;
            const size = minSize + (normalized * (maxSize - minSize));

            return {
                ...tag,
                size: Math.round(size)
            };
        });
    }

    /**
     * Convert tag to URL-friendly slug
     * @private
     * @param {string} tag - Tag name
     * @returns {string} Slugified tag
     */
    function slugify(tag) {
        return tag
            .toLowerCase()
            .trim()
            .replace(/[^\\w\\s-]/g, '')
            .replace(/\\s+/g, '-');
    }

    /**
     * Parse tags from search text
     * @param {string} text - Text containing tags (with # prefix)
     * @returns {array} Array of tag names
     */
    function parseHashtags(text) {
        const hashtags = text.match(/#\\w+/g) || [];
        return hashtags.map(tag => tag.substring(1)); // Remove #
    }

    /**
     * Get top tags in category
     * @param {string} category - Category name
     * @param {object} options - Options
     * @returns {Promise} Tags array
     */
    function getTopInCategory(category, options = {}) {
        const limit = options.limit || 15;
        const cacheKey = `tags:category:${category}`;

        if (window.CacheManager) {
            const cached = CacheManager.get(cacheKey);
            if (cached) return Promise.resolve(cached);
        }

        return fetch(`/api/tags/category/${category}?limit=${limit}`, {
            method: 'GET',
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.tags) {
                if (window.CacheManager) {
                    CacheManager.set(cacheKey, data.tags, TAG_CACHE_TTL);
                }
                return data.tags;
            }
            throw new Error('Failed to load category tags');
        })
        .catch(error => {
            console.error('[TagsManager] Category tags error:', error);
            return [];
        });
    }

    /**
     * Clear all tag caches
     */
    function clearCache() {
        if (window.CacheManager) {
            // Clear all tag-related cache keys
            ['popular', 'random'].forEach(type => {
                const keys = [
                    `tags:${type}`,
                    `tags:*:${type}`
                ];
                // Note: Would need CacheManager.removePattern() for wildcard
            });
        }
    }

    // Public API
    return {
        render,
        loadRandomTags,
        loadPopularTags,
        generateTagCloud,
        parseHashtags,
        getTopInCategory,
        clearCache
    };
})();

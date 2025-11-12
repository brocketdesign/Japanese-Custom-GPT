/**
 * Gallery Filters - Apply filters to gallery content
 * Combines search with filter criteria
 * Centralizes filter logic from dashboard.js
 * 
 * @module GalleryFilters
 * @requires GallerySearch
 * 
 * Phase: 3 (Pagination & Content Filtering)
 * Status: Production Ready
 */

const GalleryFilters = (() => {
    // Private state
    let activeFilters = {
        search: '',
        type: null,
        category: null,
        status: null,
        sortBy: 'popular',
        nsfw: 'all' // 'all', 'nsfw-only', 'safe'
    };

    const VALID_SORT_OPTIONS = ['popular', 'latest', 'trending', 'most-liked', 'random'];
    const VALID_NSFW_OPTIONS = ['all', 'nsfw-only', 'safe'];

    /**
     * Apply filters to gallery results
     * @param {array} items - Items to filter
     * @param {object} filters - Filter criteria
     * @param {string} filters.search - Search query
     * @param {string} filters.type - Content type filter
     * @param {string} filters.category - Category filter
     * @param {string} filters.status - Status filter (active, inactive, etc.)
     * @param {string} filters.sortBy - Sort option
     * @param {string} filters.nsfw - NSFW content filter
     * @param {object} userContext - User context (subscription, preferences)
     * @returns {array} Filtered items
     */
    function apply(items, filters, userContext = {}) {
        if (!items || items.length === 0) return [];

        let filtered = [...items];

        // Apply search filter
        if (filters.search && filters.search.trim()) {
            const query = filters.search.toLowerCase();
            filtered = filtered.filter(item => {
                const searchableText = [
                    item.name || '',
                    item.title || '',
                    item.description || '',
                    item.tags ? item.tags.join(' ') : ''
                ].join(' ').toLowerCase();

                return searchableText.includes(query);
            });
        }

        // Apply type filter
        if (filters.type) {
            filtered = filtered.filter(item => item.type === filters.type);
        }

        // Apply category filter
        if (filters.category) {
            filtered = filtered.filter(item => item.category === filters.category);
        }

        // Apply status filter
        if (filters.status) {
            filtered = filtered.filter(item => item.status === filters.status);
        }

        // Apply NSFW filter
        if (filters.nsfw && filters.nsfw !== 'all') {
            filtered = filtered.filter(item => {
                if (filters.nsfw === 'nsfw-only') {
                    return item.nsfw === true;
                } else if (filters.nsfw === 'safe') {
                    // Show safe content, and nsfw content if user has access
                    return item.nsfw !== true || userContext.hasNSFWAccess;
                }
                return true;
            });
        }

        // Apply sorting
        filtered = applySorting(filtered, filters.sortBy || 'popular');

        return filtered;
    }

    /**
     * Apply sorting to items
     * @private
     * @param {array} items - Items to sort
     * @param {string} sortBy - Sort option
     * @returns {array} Sorted items
     */
    function applySorting(items, sortBy) {
        const sorted = [...items];

        switch (sortBy) {
            case 'latest':
                sorted.sort((a, b) => {
                    const dateA = new Date(a.createdAt || 0);
                    const dateB = new Date(b.createdAt || 0);
                    return dateB - dateA;
                });
                break;

            case 'trending':
                sorted.sort((a, b) => {
                    const scoreA = (a.views || 0) + (a.likes || 0) * 2;
                    const scoreB = (b.views || 0) + (b.likes || 0) * 2;
                    return scoreB - scoreA;
                });
                break;

            case 'most-liked':
                sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
                break;

            case 'random':
                for (let i = sorted.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
                }
                break;

            case 'popular':
            default:
                sorted.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
                break;
        }

        return sorted;
    }

    /**
     * Update active filters
     * @param {object} newFilters - Partial filter object
     * @returns {object} Updated filters
     */
    function setFilters(newFilters) {
        // Validate and merge
        const validated = { ...activeFilters };

        if (newFilters.search !== undefined) {
            validated.search = newFilters.search;
        }
        if (newFilters.type !== undefined) {
            validated.type = newFilters.type;
        }
        if (newFilters.category !== undefined) {
            validated.category = newFilters.category;
        }
        if (newFilters.status !== undefined) {
            validated.status = newFilters.status;
        }
        if (newFilters.sortBy !== undefined && VALID_SORT_OPTIONS.includes(newFilters.sortBy)) {
            validated.sortBy = newFilters.sortBy;
        }
        if (newFilters.nsfw !== undefined && VALID_NSFW_OPTIONS.includes(newFilters.nsfw)) {
            validated.nsfw = newFilters.nsfw;
        }

        activeFilters = validated;
        return activeFilters;
    }

    /**
     * Get current active filters
     * @returns {object} Active filters
     */
    function getActive() {
        return { ...activeFilters };
    }

    /**
     * Reset all filters to default
     * @returns {object} Reset filters
     */
    function reset() {
        activeFilters = {
            search: '',
            type: null,
            category: null,
            status: null,
            sortBy: 'popular',
            nsfw: 'all'
        };
        return activeFilters;
    }

    /**
     * Combine search and filters for API request
     * @param {string} searchQuery - Search query
     * @param {object} filters - Additional filters
     * @returns {object} Combined query object
     */
    function combineSearchFilters(searchQuery, filters = {}) {
        return {
            q: searchQuery,
            type: filters.type || null,
            category: filters.category || null,
            status: filters.status || null,
            sortBy: filters.sortBy || 'popular',
            nsfw: filters.nsfw || 'all'
        };
    }

    /**
     * Check if any filter is active
     * @returns {boolean} True if filters are active
     */
    function isActive() {
        return activeFilters.search !== '' ||
               activeFilters.type !== null ||
               activeFilters.category !== null ||
               activeFilters.status !== null ||
               activeFilters.sortBy !== 'popular' ||
               activeFilters.nsfw !== 'all';
    }

    /**
     * Get filter summary for display
     * @returns {string} Human-readable filter summary
     */
    function getSummary() {
        const parts = [];

        if (activeFilters.search) parts.push(`Search: "${activeFilters.search}"`);
        if (activeFilters.type) parts.push(`Type: ${activeFilters.type}`);
        if (activeFilters.category) parts.push(`Category: ${activeFilters.category}`);
        if (activeFilters.status) parts.push(`Status: ${activeFilters.status}`);
        if (activeFilters.sortBy !== 'popular') parts.push(`Sort: ${activeFilters.sortBy}`);
        if (activeFilters.nsfw !== 'all') parts.push(`Content: ${activeFilters.nsfw}`);

        return parts.join(' | ') || 'No filters applied';
    }

    /**
     * Export filters for URL query string
     * @returns {object} URL-serializable filters
     */
    function toQueryParams() {
        const params = {};
        Object.entries(activeFilters).forEach(([key, value]) => {
            if (value) {
                params[`f_${key}`] = value;
            }
        });
        return params;
    }

    /**
     * Import filters from URL query params
     * @param {object} params - Query parameters
     */
    function fromQueryParams(params) {
        const filters = {};
        Object.entries(params).forEach(([key, value]) => {
            if (key.startsWith('f_')) {
                const filterName = key.substring(2);
                filters[filterName] = value;
            }
        });
        return setFilters(filters);
    }

    // Public API
    return {
        apply,
        setFilters,
        getActive,
        reset,
        combineSearchFilters,
        isActive,
        getSummary,
        toQueryParams,
        fromQueryParams
    };
})();

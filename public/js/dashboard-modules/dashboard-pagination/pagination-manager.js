/**
 * Pagination Manager - Unified pagination logic
 * Replaces 7+ redundant pagination functions in dashboard.js
 * Provides abstract pagination management for all gallery types
 * 
 * @module PaginationManager
 * @requires DashboardState
 * 
 * Phase: 3 (Pagination & Content Filtering)
 * Status: Production Ready
 */

const PaginationManager = (() => {
    // Private state
    const paginationState = {};
    const DEFAULT_PAGE_SIZE = 12;

    /**
     * Initialize pagination for a gallery type
     * @param {string} galleryType - Unique identifier for gallery (e.g., 'popular-chats', 'video-chats')
     * @param {object} config - Configuration object
     * @param {number} config.pageSize - Items per page (default: 12)
     * @param {number} config.startPage - Initial page number (default: 1)
     * @returns {object} Pagination instance
     */
    function create(galleryType, config = {}) {
        const pageSize = config.pageSize || DEFAULT_PAGE_SIZE;
        const startPage = config.startPage || 1;

        paginationState[galleryType] = {
            currentPage: startPage,
            pageSize: pageSize,
            totalItems: 0,
            totalPages: 0,
            isLoading: false,
            hasMore: true,
            lastPage: null,
            createdAt: Date.now()
        };

        // Store in dashboard state
        if (window.DashboardState) {
            DashboardState.setState(`pagination.${galleryType}`, paginationState[galleryType]);
        }

        return paginationState[galleryType];
    }

    /**
     * Get pagination instance for gallery type
     * @param {string} galleryType - Gallery type identifier
     * @returns {object} Pagination state object
     */
    function getInstance(galleryType) {
        if (!paginationState[galleryType]) {
            create(galleryType);
        }
        return paginationState[galleryType];
    }

    /**
     * Go to specific page
     * @param {string} galleryType - Gallery type identifier
     * @param {number} page - Target page number
     * @returns {boolean} Success status
     */
    function goToPage(galleryType, page) {
        const state = getInstance(galleryType);
        
        if (page < 1) return false;
        if (page > state.totalPages && state.totalPages > 0) return false;

        state.currentPage = page;
        state.lastPage = page;

        // Update dashboard state
        if (window.DashboardState) {
            DashboardState.setState(`pagination.${galleryType}.currentPage`, page);
        }

        return true;
    }

    /**
     * Go to next page
     * @param {string} galleryType - Gallery type identifier
     * @returns {boolean} Success status
     */
    function nextPage(galleryType) {
        const state = getInstance(galleryType);
        return goToPage(galleryType, state.currentPage + 1);
    }

    /**
     * Go to previous page
     * @param {string} galleryType - Gallery type identifier
     * @returns {boolean} Success status
     */
    function previousPage(galleryType) {
        const state = getInstance(galleryType);
        return goToPage(galleryType, state.currentPage - 1);
    }

    /**
     * Check if on first page
     * @param {string} galleryType - Gallery type identifier
     * @returns {boolean} True if current page is 1
     */
    function isFirstPage(galleryType) {
        const state = getInstance(galleryType);
        return state.currentPage === 1;
    }

    /**
     * Check if on last page
     * @param {string} galleryType - Gallery type identifier
     * @returns {boolean} True if current page is last
     */
    function isLastPage(galleryType) {
        const state = getInstance(galleryType);
        return state.totalPages > 0 && state.currentPage >= state.totalPages;
    }

    /**
     * Check if there are more pages available
     * @param {string} galleryType - Gallery type identifier
     * @returns {boolean} True if pages remain
     */
    function hasMore(galleryType) {
        const state = getInstance(galleryType);
        return state.hasMore;
    }

    /**
     * Update total item count
     * @param {string} galleryType - Gallery type identifier
     * @param {number} totalItems - Total number of items available
     */
    function setTotalItems(galleryType, totalItems) {
        const state = getInstance(galleryType);
        state.totalItems = totalItems;
        state.totalPages = Math.ceil(totalItems / state.pageSize);

        // Update state
        if (window.DashboardState) {
            DashboardState.setState(`pagination.${galleryType}`, state);
        }
    }

    /**
     * Calculate offset for API calls
     * @param {string} galleryType - Gallery type identifier
     * @returns {number} Offset value
     */
    function getOffset(galleryType) {
        const state = getInstance(galleryType);
        return (state.currentPage - 1) * state.pageSize;
    }

    /**
     * Get current pagination info
     * @param {string} galleryType - Gallery type identifier
     * @returns {object} Current pagination state
     */
    function getInfo(galleryType) {
        const state = getInstance(galleryType);
        return {
            currentPage: state.currentPage,
            pageSize: state.pageSize,
            totalItems: state.totalItems,
            totalPages: state.totalPages,
            offset: getOffset(galleryType),
            isFirstPage: isFirstPage(galleryType),
            isLastPage: isLastPage(galleryType),
            hasMore: hasMore(galleryType)
        };
    }

    /**
     * Set loading state
     * @param {string} galleryType - Gallery type identifier
     * @param {boolean} isLoading - Loading state
     */
    function setLoading(galleryType, isLoading) {
        const state = getInstance(galleryType);
        state.isLoading = isLoading;

        if (window.DashboardState) {
            DashboardState.setState(`pagination.${galleryType}.isLoading`, isLoading);
        }
    }

    /**
     * Reset pagination to initial state
     * @param {string} galleryType - Gallery type identifier
     */
    function reset(galleryType) {
        if (paginationState[galleryType]) {
            const pageSize = paginationState[galleryType].pageSize;
            create(galleryType, { pageSize, startPage: 1 });
        }
    }

    /**
     * Clear all pagination data
     */
    function clear() {
        Object.keys(paginationState).forEach(key => {
            delete paginationState[key];
        });
    }

    /**
     * Get pagination statistics
     * @returns {object} Statistics about all galleries
     */
    function getStats() {
        const stats = {};
        Object.keys(paginationState).forEach(gallery => {
            const state = paginationState[gallery];
            stats[gallery] = {
                page: state.currentPage,
                of: state.totalPages,
                items: state.totalItems,
                loading: state.isLoading
            };
        });
        return stats;
    }

    // Public API
    return {
        create,
        getInstance,
        goToPage,
        nextPage,
        previousPage,
        isFirstPage,
        isLastPage,
        hasMore,
        setTotalItems,
        getOffset,
        getInfo,
        setLoading,
        reset,
        clear,
        getStats
    };
})();

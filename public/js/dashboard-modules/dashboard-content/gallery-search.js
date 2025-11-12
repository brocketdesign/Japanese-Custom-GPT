/**
 * Gallery Search - Search functionality across galleries
 * Handles search API calls, caching, and debouncing
 * Replaces scattered search logic in dashboard.js
 * 
 * @module GallerySearch
 * @requires CacheManager, DashboardAPI
 * 
 * Phase: 3 (Pagination & Content Filtering)
 * Status: Production Ready
 */

const GallerySearch = (() => {
    const SEARCH_DEBOUNCE_DELAY = 300; // ms
    const SEARCH_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
    
    let debounceTimer = null;
    let currentQuery = '';
    let activeSearch = null;

    /**
     * Perform search with debouncing
     * @param {string} query - Search query
     * @param {object} options - Search options
     * @param {string} options.type - Content type to search (optional)
     * @param {number} options.page - Page number (default: 1)
     * @param {number} options.limit - Results per page (default: 12)
     * @param {function} options.callback - Callback function for results
     * @returns {Promise} Search promise
     */
    function search(query, options = {}) {
        return new Promise((resolve, reject) => {
            // Clear previous debounce timer
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }

            // Validate query
            const trimmedQuery = query.trim();
            if (!trimmedQuery) {
                currentQuery = '';
                activeSearch = null;
                resolve({ results: [], query: '' });
                return;
            }

            currentQuery = trimmedQuery;

            // Set debounce timer
            debounceTimer = setTimeout(() => {
                // Check cache first
                const cacheKey = `search:${trimmedQuery}:${options.type || 'all'}`;
                let cachedResults = null;

                if (window.CacheManager) {
                    cachedResults = CacheManager.get(cacheKey);
                }

                if (cachedResults) {
                    resolve(cachedResults);
                    if (options.callback) options.callback(cachedResults);
                    return;
                }

                // Perform actual search via API
                performSearch(trimmedQuery, options)
                    .then(results => {
                        // Cache results
                        if (window.CacheManager) {
                            CacheManager.set(cacheKey, results, SEARCH_CACHE_TTL);
                        }

                        resolve(results);
                        if (options.callback) options.callback(results);
                    })
                    .catch(reject);
            }, SEARCH_DEBOUNCE_DELAY);
        });
    }

    /**
     * Perform actual search API call
     * @private
     * @param {string} query - Search query
     * @param {object} options - Options
     * @returns {Promise} Search results
     */
    function performSearch(query, options) {
        const page = options.page || 1;
        const limit = options.limit || 12;
        const type = options.type || 'all';

        // Build search URL
        const params = new URLSearchParams({
            q: query,
            page: page,
            limit: limit,
            type: type
        });

        return fetch(`/api/search?${params}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) throw new Error('Search request failed');
            return response.json();
        })
        .then(data => {
            if (data.success) {
                return {
                    results: data.results || [],
                    query: query,
                    total: data.total || 0,
                    page: page
                };
            } else {
                throw new Error(data.error || 'Search failed');
            }
        })
        .catch(error => {
            console.error('[GallerySearch] Error:', error);
            return { results: [], query: query, error: error.message };
        });
    }

    /**
     * Get search suggestions for autocomplete
     * @param {string} query - Partial query
     * @param {object} options - Options
     * @returns {Promise} Suggestions array
     */
    function getSuggestions(query, options = {}) {
        const trimmedQuery = query.trim();
        if (trimmedQuery.length < 2) return Promise.resolve([]);

        const cacheKey = `suggestions:${trimmedQuery}`;
        let cached = null;

        if (window.CacheManager) {
            cached = CacheManager.get(cacheKey);
        }

        if (cached) return Promise.resolve(cached);

        const params = new URLSearchParams({
            q: trimmedQuery,
            type: options.type || 'all',
            limit: options.limit || 10
        });

        return fetch(`/api/search/suggestions?${params}`, {
            method: 'GET',
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            const suggestions = data.suggestions || [];
            if (window.CacheManager) {
                CacheManager.set(cacheKey, suggestions, 5 * 60 * 1000); // 5 min cache
            }
            return suggestions;
        })
        .catch(error => {
            console.error('[GallerySearch] Suggestions error:', error);
            return [];
        });
    }

    /**
     * Clear current search
     * @returns {object} Empty search state
     */
    function clearSearch() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }

        currentQuery = '';
        activeSearch = null;

        return {
            results: [],
            query: '',
            cleared: true
        };
    }

    /**
     * Get currently active query
     * @returns {string} Active search query
     */
    function getActiveQuery() {
        return currentQuery;
    }

    /**
     * Check if search is active
     * @returns {boolean} True if search is active
     */
    function isActive() {
        return currentQuery.length > 0;
    }

    /**
     * Get search history from localStorage
     * @param {number} limit - Max history items to return
     * @returns {array} Search history
     */
    function getHistory(limit = 10) {
        try {
            const history = JSON.parse(localStorage.getItem('search-history') || '[]');
            return history.slice(0, limit);
        } catch (e) {
            return [];
        }
    }

    /**
     * Add to search history
     * @param {string} query - Query to add
     */
    function addToHistory(query) {
        try {
            let history = JSON.parse(localStorage.getItem('search-history') || '[]');
            history = history.filter(item => item !== query); // Remove duplicates
            history.unshift(query); // Add to front
            history = history.slice(0, 20); // Keep last 20
            localStorage.setItem('search-history', JSON.stringify(history));
        } catch (e) {
            console.warn('[GallerySearch] Could not save history:', e);
        }
    }

    /**
     * Clear search history
     */
    function clearHistory() {
        try {
            localStorage.removeItem('search-history');
        } catch (e) {
            console.warn('[GallerySearch] Could not clear history:', e);
        }
    }

    // Public API
    return {
        search,
        getSuggestions,
        clearSearch,
        getActiveQuery,
        isActive,
        getHistory,
        addToHistory,
        clearHistory
    };
})();

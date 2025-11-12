/**
 * Cache Strategy Definitions
 * 
 * Defines TTL and storage strategy for different content types.
 * Used by CacheManager to apply consistent caching policies.
 * 
 * @author Dashboard Refactor Phase 1
 * @date November 12, 2025
 */

'use strict';

if (typeof CacheStrategies === 'undefined') {
    window.CacheStrategies = {
        /**
         * Video chats - frequently changing, high traffic
         * TTL: 1 hour
         * Storage: sessionStorage (user session specific)
         */
        VIDEO_CHATS: {
            ttl: 1 * 60 * 60 * 1000,        // 1 hour in milliseconds
            storage: 'session',
            description: 'Latest video chats feed'
        },

        /**
         * Popular chats - slower to change, trending content
         * TTL: 2 hours
         * Storage: sessionStorage
         */
        POPULAR_CHATS: {
            ttl: 2 * 60 * 60 * 1000,        // 2 hours
            storage: 'session',
            description: 'Popular/trending chats'
        },

        /**
         * Latest chats - moderately changing, recent content
         * TTL: 1.5 hours
         * Storage: sessionStorage
         */
        LATEST_CHATS: {
            ttl: 1.5 * 60 * 60 * 1000,      // 1.5 hours
            storage: 'session',
            description: 'Recently created chats'
        },

        /**
         * User posts - user-generated content, changes frequently
         * TTL: 30 minutes
         * Storage: sessionStorage
         */
        USER_POSTS: {
            ttl: 30 * 60 * 1000,            // 30 minutes
            storage: 'session',
            description: 'User-generated posts'
        },

        /**
         * Search results - highly query-dependent, can change frequently
         * TTL: 15 minutes
         * Storage: sessionStorage
         */
        SEARCH_RESULTS: {
            ttl: 15 * 60 * 1000,            // 15 minutes
            storage: 'session',
            description: 'Search result cache'
        },

        /**
         * Gallery images - static content, rarely changes
         * TTL: 4 hours
         * Storage: sessionStorage
         */
        GALLERY_IMAGES: {
            ttl: 4 * 60 * 60 * 1000,        // 4 hours
            storage: 'session',
            description: 'Gallery image listings'
        },

        /**
         * Pagination state - session specific
         * TTL: Duration of session (keep until browser closes)
         * Storage: sessionStorage
         */
        PAGINATION_STATE: {
            ttl: 24 * 60 * 60 * 1000,       // 24 hours (session will close before)
            storage: 'session',
            description: 'Pagination state for recovery'
        },

        /**
         * Character tags - slower to change
         * TTL: 3 hours
         * Storage: sessionStorage
         */
        CHARACTER_TAGS: {
            ttl: 3 * 60 * 60 * 1000,        // 3 hours
            storage: 'session',
            description: 'Character tag listings'
        },

        /**
         * User profile data - relatively stable
         * TTL: 2 hours
         * Storage: sessionStorage
         */
        USER_PROFILE: {
            ttl: 2 * 60 * 60 * 1000,        // 2 hours
            storage: 'session',
            description: 'User profile information'
        },

        /**
         * Filter options - generally static per session
         * TTL: 8 hours
         * Storage: sessionStorage
         */
        FILTER_OPTIONS: {
            ttl: 8 * 60 * 60 * 1000,        // 8 hours
            storage: 'session',
            description: 'Available filter options'
        },

        /**
         * System data - non-user specific data
         * TTL: 6 hours
         * Storage: sessionStorage
         */
        SYSTEM_DATA: {
            ttl: 6 * 60 * 60 * 1000,        // 6 hours
            storage: 'session',
            description: 'System-wide data'
        },

        /**
         * Analytics data - event tracking, less critical
         * TTL: 1 hour
         * Storage: memory
         */
        ANALYTICS: {
            ttl: 1 * 60 * 60 * 1000,        // 1 hour
            storage: 'memory',
            description: 'User interaction analytics'
        }
    };

    /**
     * Get cache strategy by type
     * Returns default strategy if not found
     * 
     * @param {string} strategyType - Type of cache strategy
     * @returns {Object} Cache strategy with ttl and storage
     */
    window.CacheStrategies.get = function(strategyType) {
        return this[strategyType] || {
            ttl: 30 * 60 * 1000,            // Default: 30 minutes
            storage: 'session',
            description: 'Default cache strategy'
        };
    };

    /**
     * Check if a strategy exists
     * 
     * @param {string} strategyType - Type to check
     * @returns {boolean} True if strategy exists
     */
    window.CacheStrategies.exists = function(strategyType) {
        return strategyType in this && 
               'ttl' in this[strategyType] && 
               'storage' in this[strategyType];
    };

    /**
     * List all available strategies
     * 
     * @returns {Array<string>} Array of strategy names
     */
    window.CacheStrategies.list = function() {
        return Object.keys(this).filter(key => {
            return typeof this[key] === 'object' && 
                   'ttl' in this[key];
        });
    };

    /**
     * Get strategy info for debugging
     * 
     * @returns {Object} All strategies with metadata
     */
    window.CacheStrategies.getAllInfo = function() {
        const info = {};
        for (const strategyName of this.list()) {
            const strategy = this[strategyName];
            info[strategyName] = {
                ...strategy,
                ttlMinutes: Math.round(strategy.ttl / 60 / 1000),
                ttlHours: (strategy.ttl / 60 / 60 / 1000).toFixed(1)
            };
        }
        return info;
    };
}

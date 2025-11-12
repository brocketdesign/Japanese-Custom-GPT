/**
 * Unified Cache Management System
 * 
 * Centralized caching with TTL support, automatic expiration cleanup,
 * and flexible storage selection (sessionStorage vs memory).
 * Replaces scattered cache implementations throughout dashboard.js
 * 
 * @author Dashboard Refactor Phase 1
 * @date November 12, 2025
 */

'use strict';

if (typeof CacheManager === 'undefined') {
    window.CacheManager = (() => {
        /**
         * In-memory cache storage for development/session
         * Cleared when page refreshes
         */
        const memoryCache = new Map();

        /**
         * Cache metadata tracking (expiration times, access counts)
         */
        const cacheMeta = new Map();

        /**
         * Generate standardized cache key
         * 
         * @param {string} namespace - Cache namespace (e.g., 'videoChats', 'search')
         * @param {string|number} key - Primary key
         * @returns {string} Standardized cache key
         */
        const generateKey = (namespace, key) => {
            if (!namespace || key === undefined) {
                throw new Error('Cache: namespace and key are required');
            }
            return `cache:${namespace}:${key}`;
        };

        /**
         * Get cache value
         * Supports both sessionStorage and memory storage
         * 
         * @param {string} key - Cache key (or generated from namespace + key)
         * @param {Object} options - Options
         * @param {string} options.namespace - If key is not prefixed
         * @param {string} options.storage - 'session', 'memory' (default: auto-detect)
         * @returns {*} Cached value or null if expired/missing
         */
        const get = (key, options = {}) => {
            try {
                let cacheKey = key;

                // Generate key if namespace provided
                if (options.namespace) {
                    cacheKey = generateKey(options.namespace, key);
                }

                // Check if expired
                if (isExpired(cacheKey)) {
                    remove(cacheKey);
                    return null;
                }

                // Try memory cache first
                if (memoryCache.has(cacheKey)) {
                    return memoryCache.get(cacheKey);
                }

                // Try sessionStorage
                try {
                    const stored = sessionStorage.getItem(cacheKey);
                    if (stored) {
                        return JSON.parse(stored);
                    }
                } catch (e) {
                    // sessionStorage may be unavailable in some contexts
                }

                return null;
            } catch (error) {
                console.error('[CacheManager] Get error:', error);
                return null;
            }
        };

        /**
         * Set cache value with optional TTL
         * 
         * @param {string} key - Cache key
         * @param {*} value - Value to cache
         * @param {Object} options - Options
         * @param {number} options.ttl - Time to live in milliseconds
         * @param {string} options.namespace - If key needs generation
         * @param {string} options.storage - 'session', 'memory' (default: auto-select)
         * @returns {boolean} Success
         */
        const set = (key, value, options = {}) => {
            try {
                if (value === undefined) {
                    return false;
                }

                let cacheKey = key;

                // Generate key if namespace provided
                if (options.namespace) {
                    cacheKey = generateKey(options.namespace, key);
                }

                const ttl = options.ttl || null;
                const storage = options.storage || 'auto';

                // Store expiration metadata
                if (ttl) {
                    cacheMeta.set(cacheKey, {
                        expiresAt: Date.now() + ttl,
                        createdAt: Date.now(),
                        ttl: ttl,
                        size: JSON.stringify(value).length
                    });
                } else {
                    cacheMeta.set(cacheKey, {
                        createdAt: Date.now(),
                        size: JSON.stringify(value).length
                    });
                }

                // Choose storage
                const useSessionStorage = storage === 'session' || 
                    (storage === 'auto' && isSessionStorageAvailable());

                if (useSessionStorage) {
                    try {
                        sessionStorage.setItem(cacheKey, JSON.stringify(value));
                        return true;
                    } catch (e) {
                        // Fall back to memory if sessionStorage fails
                        memoryCache.set(cacheKey, value);
                        return true;
                    }
                } else {
                    memoryCache.set(cacheKey, value);
                    return true;
                }
            } catch (error) {
                console.error('[CacheManager] Set error:', error);
                return false;
            }
        };

        /**
         * Check if cache entry is expired
         * 
         * @param {string} key - Cache key
         * @returns {boolean} True if expired
         */
        const isExpired = (key) => {
            try {
                const meta = cacheMeta.get(key);
                if (!meta || !meta.expiresAt) {
                    return false;
                }
                return Date.now() > meta.expiresAt;
            } catch (error) {
                return false;
            }
        };

        /**
         * Remove cache entry
         * 
         * @param {string} key - Cache key or namespace
         * @param {string} specificKey - If removing with namespace
         * @returns {boolean} Success
         */
        const remove = (key, specificKey = null) => {
            try {
                let cacheKey = key;
                
                if (specificKey) {
                    cacheKey = generateKey(key, specificKey);
                }

                // Remove from memory
                memoryCache.delete(cacheKey);
                cacheMeta.delete(cacheKey);

                // Remove from sessionStorage
                try {
                    sessionStorage.removeItem(cacheKey);
                } catch (e) {
                    // Ignore
                }

                return true;
            } catch (error) {
                console.error('[CacheManager] Remove error:', error);
                return false;
            }
        };

        /**
         * Clear all cache entries
         * 
         * @param {string} namespace - Optional: clear only specific namespace
         * @returns {number} Number of entries cleared
         */
        const clear = (namespace = null) => {
            try {
                let cleared = 0;

                if (namespace) {
                    // Clear specific namespace
                    const prefix = `cache:${namespace}:`;
                    
                    for (const [key] of memoryCache) {
                        if (key.startsWith(prefix)) {
                            memoryCache.delete(key);
                            cacheMeta.delete(key);
                            cleared++;
                        }
                    }

                    try {
                        for (let i = sessionStorage.length - 1; i >= 0; i--) {
                            const key = sessionStorage.key(i);
                            if (key && key.startsWith(prefix)) {
                                sessionStorage.removeItem(key);
                                cacheMeta.delete(key);
                                cleared++;
                            }
                        }
                    } catch (e) {
                        // Ignore
                    }
                } else {
                    // Clear all
                    cleared = memoryCache.size;
                    memoryCache.clear();
                    cacheMeta.clear();

                    try {
                        sessionStorage.clear();
                    } catch (e) {
                        // Ignore
                    }
                }

                return cleared;
            } catch (error) {
                console.error('[CacheManager] Clear error:', error);
                return 0;
            }
        };

        /**
         * Get cache statistics for debugging
         * 
         * @param {string} namespace - Optional: stats for specific namespace
         * @returns {Object} Cache statistics
         */
        const getStats = (namespace = null) => {
            try {
                let count = 0;
                let totalSize = 0;
                let expiredCount = 0;

                for (const [key, meta] of cacheMeta) {
                    if (!namespace || key.startsWith(`cache:${namespace}:`)) {
                        count++;
                        totalSize += meta.size || 0;
                        if (isExpired(key)) {
                            expiredCount++;
                        }
                    }
                }

                return {
                    entries: count,
                    totalSizeBytes: totalSize,
                    expiredEntries: expiredCount,
                    namespace: namespace,
                    timestamp: Date.now()
                };
            } catch (error) {
                console.error('[CacheManager] Stats error:', error);
                return {};
            }
        };

        /**
         * Clean up expired entries
         * Automatically called periodically
         * 
         * @returns {number} Number of entries cleaned
         */
        const cleanup = () => {
            try {
                let cleaned = 0;

                for (const [key] of cacheMeta) {
                    if (isExpired(key)) {
                        remove(key);
                        cleaned++;
                    }
                }

                return cleaned;
            } catch (error) {
                console.error('[CacheManager] Cleanup error:', error);
                return 0;
            }
        };

        /**
         * Check if sessionStorage is available
         * 
         * @returns {boolean} True if available
         */
        const isSessionStorageAvailable = () => {
            try {
                const test = '__storage_test__';
                sessionStorage.setItem(test, test);
                sessionStorage.removeItem(test);
                return true;
            } catch (e) {
                return false;
            }
        };

        /**
         * Run periodic cleanup (call from dashboard-init)
         * Removes expired entries every 5 minutes
         * 
         * @param {number} intervalMs - Cleanup interval in milliseconds
         */
        const startPeriodicCleanup = (intervalMs = 5 * 60 * 1000) => {
            setInterval(() => {
                const cleaned = cleanup();
                if (cleaned > 0 && console.debug) {
                    console.debug(`[CacheManager] Cleaned ${cleaned} expired entries`);
                }
            }, intervalMs);
        };

        // Public API
        return {
            get,
            set,
            remove,
            clear,
            isExpired,
            getStats,
            cleanup,
            startPeriodicCleanup,
            generateKey
        };
    })();
}

/**
 * Dashboard State Management
 * 
 * Centralized state management for all discovery features.
 * Handles gallery state, filters, modals, cache status, and UI settings.
 * 
 * @author Dashboard Refactor Phase 1
 * @date November 12, 2025
 */

'use strict';

if (typeof DashboardState === 'undefined') {
    window.DashboardState = (() => {
        /**
         * Central state object
         * Structure mirrors all dashboard concerns
         */
        const state = {
            // Gallery pagination states for each content type
            gallery: {
                popularChats: { 
                    page: 1, 
                    loading: false, 
                    totalPages: 0,
                    hasMore: true 
                },
                latestChats: { 
                    page: 1, 
                    loading: false, 
                    totalPages: 0,
                    hasMore: true 
                },
                videoChats: { 
                    page: 1, 
                    loading: false, 
                    totalPages: 0,
                    hasMore: true 
                },
                userPosts: { 
                    page: 1, 
                    loading: false, 
                    totalPages: 0,
                    hasMore: true 
                },
                userLikedImages: { 
                    page: 1, 
                    loading: false, 
                    totalPages: 0,
                    hasMore: true 
                },
                allChatImages: { 
                    page: 1, 
                    loading: false, 
                    totalPages: 0,
                    hasMore: true 
                }
            },

            // Search and filter state
            filters: { 
                query: '', 
                tags: [], 
                active: [],
                lastSearchTime: null,
                searchDebounceTimer: null
            },

            // Modal visibility and loading states
            modals: {
                characterUpdate: { isOpen: false, isLoading: false },
                settings: { isOpen: false, isLoading: false },
                characterCreation: { isOpen: false, isLoading: false },
                plan: { isOpen: false, isLoading: false },
                characterProfile: { isOpen: false, isLoading: false },
                userProfile: { isOpen: false, isLoading: false },
                videoPlay: { isOpen: false, isLoading: false }
            },

            // UI preferences and settings
            ui: {
                gridSize: 2,
                language: 'en',
                viewMode: 'gallery', // grid, list, carousel
                swiperIndex: 0,
                showNSFW: false,
                reducedMotion: false
            },

            // Cache meta information
            cache: {
                videoChats: { lastUpdated: null, isValid: false },
                popularChats: { lastUpdated: null, isValid: false },
                latestChats: { lastUpdated: null, isValid: false },
                userPosts: { lastUpdated: null, isValid: false },
                search: { lastUpdated: null, isValid: false }
            },

            // User context
            user: {
                id: null,
                isTemporary: false,
                subscriptionStatus: null,
                isAdmin: false
            },

            // System state
            system: {
                initialized: false,
                modulesReady: 0,
                totalModules: 0,
                errors: []
            }
        };

        /**
         * Deep get state value by path
         * Examples: 'gallery.popularChats.page', 'filters.query', 'ui.gridSize'
         * 
         * @param {string} path - Dot-separated path
         * @returns {*} Value at path or undefined
         */
        const getState = (path) => {
            if (!path) return state;
            
            const keys = path.split('.');
            let value = state;
            
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    return undefined;
                }
            }
            
            return value;
        };

        /**
         * Deep set state value by path
         * Creates intermediate objects if needed
         * 
         * @param {string} path - Dot-separated path
         * @param {*} value - Value to set
         * @returns {boolean} Success
         */
        const setState = (path, value) => {
            if (!path) return false;
            
            const keys = path.split('.');
            const lastKey = keys.pop();
            
            let current = state;
            
            // Create intermediate objects
            for (const key of keys) {
                if (!(key in current)) {
                    current[key] = {};
                }
                current = current[key];
            }
            
            // Set value
            if (typeof current === 'object') {
                current[lastKey] = value;
                
                // Log state change in development
                if (typeof console !== 'undefined' && console.debug) {
                    console.debug(`[DashboardState] ${path} = ${JSON.stringify(value)}`);
                }
                
                return true;
            }
            
            return false;
        };

        /**
         * Update gallery pagination state
         * 
         * @param {string} galleryType - Type of gallery (popularChats, latestChats, etc)
         * @param {Object} updates - Updates to apply
         */
        const updateGalleryState = (galleryType, updates) => {
            if (galleryType in state.gallery) {
                state.gallery[galleryType] = {
                    ...state.gallery[galleryType],
                    ...updates
                };
                return true;
            }
            return false;
        };

        /**
         * Get current gallery state for a type
         * 
         * @param {string} galleryType - Gallery type
         * @returns {Object} Current state
         */
        const getGalleryState = (galleryType) => {
            return state.gallery[galleryType] || null;
        };

        /**
         * Update modal state
         * 
         * @param {string} modalId - Modal identifier
         * @param {Object} updates - Updates to apply
         */
        const updateModalState = (modalId, updates) => {
            if (modalId in state.modals) {
                state.modals[modalId] = {
                    ...state.modals[modalId],
                    ...updates
                };
                return true;
            }
            return false;
        };

        /**
         * Get modal state
         * 
         * @param {string} modalId - Modal identifier
         * @returns {Object} Modal state or null
         */
        const getModalState = (modalId) => {
            return state.modals[modalId] || null;
        };

        /**
         * Update filter state
         * 
         * @param {Object} filterUpdates - Filter updates
         */
        const updateFilterState = (filterUpdates) => {
            state.filters = {
                ...state.filters,
                ...filterUpdates
            };
        };

        /**
         * Get current filter state
         * 
         * @returns {Object} Current filters
         */
        const getFilterState = () => {
            return { ...state.filters };
        };

        /**
         * Reset specific gallery state (for fresh loading)
         * 
         * @param {string} galleryType - Gallery type to reset
         */
        const resetGalleryState = (galleryType) => {
            if (galleryType in state.gallery) {
                state.gallery[galleryType] = {
                    page: 1,
                    loading: false,
                    totalPages: 0,
                    hasMore: true
                };
                return true;
            }
            return false;
        };

        /**
         * Reset all state to initial values
         */
        const resetAllState = () => {
            // Reset galleries
            Object.keys(state.gallery).forEach(galleryType => {
                resetGalleryState(galleryType);
            });
            
            // Reset filters
            state.filters = { 
                query: '', 
                tags: [], 
                active: [],
                lastSearchTime: null,
                searchDebounceTimer: null
            };
            
            // Close all modals
            Object.keys(state.modals).forEach(modalId => {
                state.modals[modalId] = { isOpen: false, isLoading: false };
            });
        };

        /**
         * Mark cache as valid/invalid
         * 
         * @param {string} cacheType - Type of cache
         * @param {boolean} isValid - Whether cache is valid
         */
        const setCacheValidity = (cacheType, isValid) => {
            if (cacheType in state.cache) {
                state.cache[cacheType] = {
                    lastUpdated: new Date().getTime(),
                    isValid: isValid
                };
            }
        };

        /**
         * Get cache validity
         * 
         * @param {string} cacheType - Type of cache
         * @returns {Object} Cache validity info
         */
        const getCacheValidity = (cacheType) => {
            return state.cache[cacheType] || null;
        };

        /**
         * Validate and recover state
         * Used for error recovery or debugging
         * 
         * @returns {boolean} True if state is valid
         */
        const validateState = () => {
            try {
                // Check gallery states
                Object.values(state.gallery).forEach(gallery => {
                    if (typeof gallery.page !== 'number' || gallery.page < 1) {
                        gallery.page = 1;
                    }
                    if (typeof gallery.loading !== 'boolean') {
                        gallery.loading = false;
                    }
                });

                // Check modal states
                Object.values(state.modals).forEach(modal => {
                    if (typeof modal.isOpen !== 'boolean') {
                        modal.isOpen = false;
                    }
                    if (typeof modal.isLoading !== 'boolean') {
                        modal.isLoading = false;
                    }
                });

                return true;
            } catch (error) {
                console.error('[DashboardState] Validation failed:', error);
                return false;
            }
        };

        /**
         * Get full state snapshot for debugging
         * 
         * @returns {Object} Full state copy
         */
        const getFullState = () => {
            return JSON.parse(JSON.stringify(state));
        };

        // Public API
        return {
            getState,
            setState,
            updateGalleryState,
            getGalleryState,
            updateModalState,
            getModalState,
            updateFilterState,
            getFilterState,
            resetGalleryState,
            resetAllState,
            setCacheValidity,
            getCacheValidity,
            validateState,
            getFullState
        };
    })();
}

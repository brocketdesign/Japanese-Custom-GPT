/**
 * Dashboard Event Manager
 * 
 * Centralized global event listeners for discovery features.
 * Coordinates events between modules and handles cross-cutting concerns.
 * 
 * @author Dashboard Refactor Phase 1
 * @date November 12, 2025
 */

'use strict';

if (typeof DashboardEventManager === 'undefined') {
    window.DashboardEventManager = (() => {
        /**
         * Setup all event listeners
         * Called by dashboard-core during initialization
         */
        const setupEventListeners = () => {
            try {
                console.log('[DashboardEventManager] Setting up event listeners...');

                setupFilterEvents();
                setupSearchEvents();
                setupPaginationEvents();
                setupLanguageEvents();
                setupWindowEvents();
                setupGalleryEvents();
                setupModalEvents();

                console.log('[DashboardEventManager] Event listeners setup complete');

            } catch (error) {
                console.error('[DashboardEventManager] Setup failed:', error);
            }
        };

        /**
         * Filter change events
         */
        const setupFilterEvents = () => {
            try {
                // Filter change trigger
                $(document).on('filterChanged', function(event, filters) {
                    console.debug('[DashboardEventManager] Filter changed:', filters);
                    
                    DashboardState.updateFilterState(filters);
                    
                    // Reset pagination to page 1
                    DashboardState.resetGalleryState('popularChats');
                    DashboardState.resetGalleryState('latestChats');
                    
                    // Trigger gallery reload
                    $(document).trigger('reloadGalleries', [{ resetPagination: true }]);
                });

                // Filter button clicks
                $(document).on('click', '[data-filter-btn]', function() {
                    const filterName = $(this).data('filter-btn');
                    console.debug('[DashboardEventManager] Filter button clicked:', filterName);
                    
                    // Let filter system handle it
                    $(document).trigger('filterButtonClicked', [filterName]);
                });

            } catch (error) {
                console.error('[DashboardEventManager] Filter events setup failed:', error);
            }
        };

        /**
         * Search input events
         */
        const setupSearchEvents = () => {
            try {
                let searchTimeout;

                $(document).on('input', '[data-search-input]', function(e) {
                    const query = $(this).val().trim();
                    
                    // Clear previous timeout
                    if (searchTimeout) {
                        clearTimeout(searchTimeout);
                    }

                    // Debounce search (300ms)
                    searchTimeout = setTimeout(function() {
                        console.debug('[DashboardEventManager] Search query:', query);
                        
                        DashboardState.updateFilterState({ query: query });
                        DashboardState.resetGalleryState('popularChats');
                        
                        $(document).trigger('searchTriggered', [query]);
                    }, 300);
                });

                // Clear search button
                $(document).on('click', '[data-clear-search]', function() {
                    DashboardState.updateFilterState({ query: '' });
                    $('[data-search-input]').val('');
                    $(document).trigger('searchCleared');
                });

            } catch (error) {
                console.error('[DashboardEventManager] Search events setup failed:', error);
            }
        };

        /**
         * Pagination click events
         */
        const setupPaginationEvents = () => {
            try {
                // Next page button
                $(document).on('click', '[data-pagination-next]', function() {
                    const galleryType = $(this).data('pagination-next');
                    console.debug('[DashboardEventManager] Next page clicked:', galleryType);
                    
                    const state = DashboardState.getGalleryState(galleryType);
                    if (state && state.hasMore) {
                        DashboardState.updateGalleryState(galleryType, { page: state.page + 1 });
                        $(document).trigger('paginationChanged', [{ galleryType, direction: 'next' }]);
                    }
                });

                // Previous page button
                $(document).on('click', '[data-pagination-prev]', function() {
                    const galleryType = $(this).data('pagination-prev');
                    console.debug('[DashboardEventManager] Previous page clicked:', galleryType);
                    
                    const state = DashboardState.getGalleryState(galleryType);
                    if (state && state.page > 1) {
                        DashboardState.updateGalleryState(galleryType, { page: state.page - 1 });
                        $(document).trigger('paginationChanged', [{ galleryType, direction: 'prev' }]);
                    }
                });

                // Numbered page buttons
                $(document).on('click', '[data-pagination-page]', function() {
                    const page = parseInt($(this).data('pagination-page'));
                    const galleryType = $(this).data('gallery-type');
                    
                    if (!isNaN(page) && page > 0) {
                        console.debug('[DashboardEventManager] Page button clicked:', galleryType, page);
                        DashboardState.updateGalleryState(galleryType, { page: page });
                        $(document).trigger('paginationChanged', [{ galleryType, page }]);
                    }
                });

            } catch (error) {
                console.error('[DashboardEventManager] Pagination events setup failed:', error);
            }
        };

        /**
         * Language change events
         */
        const setupLanguageEvents = () => {
            try {
                $(document).on('change', '[data-language-select]', function() {
                    const lang = $(this).val();
                    console.debug('[DashboardEventManager] Language changed:', lang);
                    
                    DashboardState.setState('ui.language', lang);
                    localStorage.setItem('userLanguage', lang);
                    
                    $(document).trigger('dashboardLanguageChanged', [lang]);
                });

            } catch (error) {
                console.error('[DashboardEventManager] Language events setup failed:', error);
            }
        };

        /**
         * Window events (resize, orientation change, etc.)
         */
        const setupWindowEvents = () => {
            try {
                let resizeTimeout;

                $(window).on('resize', function() {
                    if (resizeTimeout) {
                        clearTimeout(resizeTimeout);
                    }

                    resizeTimeout = setTimeout(function() {
                        console.debug('[DashboardEventManager] Window resized');
                        $(document).trigger('dashboardResized');
                    }, 250);
                });

                // Orientation change
                $(window).on('orientationchange', function() {
                    console.debug('[DashboardEventManager] Orientation changed');
                    $(document).trigger('dashboardOrientationChanged');
                });

                // Storage events (other tabs/windows)
                $(window).on('storage', function(e) {
                    if (e.key && e.key.startsWith('cache:')) {
                        console.debug('[DashboardEventManager] Cache changed in other window');
                        // Could trigger cache refresh
                    }
                });

            } catch (error) {
                console.error('[DashboardEventManager] Window events setup failed:', error);
            }
        };

        /**
         * Gallery-specific events
         */
        const setupGalleryEvents = () => {
            try {
                // Gallery load started
                $(document).on('galleryLoadStart', function(event, galleryType) {
                    console.debug('[DashboardEventManager] Gallery load started:', galleryType);
                    DashboardState.updateGalleryState(galleryType, { loading: true });
                });

                // Gallery load complete
                $(document).on('galleryLoadComplete', function(event, galleryType, data) {
                    console.debug('[DashboardEventManager] Gallery load complete:', galleryType);
                    DashboardState.updateGalleryState(galleryType, { 
                        loading: false,
                        totalPages: data?.totalPages || 0,
                        hasMore: data?.hasMore !== false
                    });
                });

                // Gallery load error
                $(document).on('galleryLoadError', function(event, galleryType, error) {
                    console.error('[DashboardEventManager] Gallery load error:', galleryType, error);
                    DashboardState.updateGalleryState(galleryType, { loading: false });
                });

            } catch (error) {
                console.error('[DashboardEventManager] Gallery events setup failed:', error);
            }
        };

        /**
         * Modal-specific events
         */
        const setupModalEvents = () => {
            try {
                // Modal open
                $(document).on('modalOpen', function(event, modalId) {
                    console.debug('[DashboardEventManager] Modal opened:', modalId);
                    DashboardState.updateModalState(modalId, { isOpen: true });
                });

                // Modal close
                $(document).on('modalClose', function(event, modalId) {
                    console.debug('[DashboardEventManager] Modal closed:', modalId);
                    DashboardState.updateModalState(modalId, { isOpen: false });
                });

                // Modal loading
                $(document).on('modalLoadingStart', function(event, modalId) {
                    DashboardState.updateModalState(modalId, { isLoading: true });
                });

                $(document).on('modalLoadingComplete', function(event, modalId) {
                    DashboardState.updateModalState(modalId, { isLoading: false });
                });

            } catch (error) {
                console.error('[DashboardEventManager] Modal events setup failed:', error);
            }
        };

        /**
         * Trigger filter change manually
         * 
         * @param {Object} filters - Filter object
         */
        const triggerFilterChange = (filters) => {
            console.debug('[DashboardEventManager] Triggering filter change:', filters);
            $(document).trigger('filterChanged', [filters]);
        };

        /**
         * Trigger search manually
         * 
         * @param {string} query - Search query
         */
        const triggerSearch = (query) => {
            console.debug('[DashboardEventManager] Triggering search:', query);
            $(document).trigger('searchTriggered', [query]);
        };

        /**
         * Trigger pagination change manually
         * 
         * @param {string} galleryType - Gallery type
         * @param {number} page - Page number
         */
        const triggerPaginationChange = (galleryType, page) => {
            console.debug('[DashboardEventManager] Triggering pagination:', galleryType, page);
            $(document).trigger('paginationChanged', [{ galleryType, page }]);
        };

        /**
         * Broadcast message to all modules
         * 
         * @param {string} eventName - Event name
         * @param {*} data - Event data
         */
        const broadcast = (eventName, data) => {
            console.debug('[DashboardEventManager] Broadcasting:', eventName);
            $(document).trigger(eventName, [data]);
        };

        // Public API
        return {
            setupEventListeners,
            triggerFilterChange,
            triggerSearch,
            triggerPaginationChange,
            broadcast
        };
    })();
}

/**
 * Popular Chats Gallery Module
 * 
 * Handles popular chats gallery rendering, loading, and management.
 * Part of the Phase 2 gallery system refactoring.
 * 
 * @author Dashboard Refactor Phase 2
 * @date November 12, 2025
 */

'use strict';

if (typeof PopularChatsGallery === 'undefined') {
    window.PopularChatsGallery = (() => {
        // Internal state
        let currentPage = 1;
        let totalPages = 1;
        let isLoading = false;
        let galleryType = 'popular';

        /**
         * Load popular chats from server
         * 
         * @param {number} page - Page number
         * @param {boolean} reload - Force reload from server
         * @returns {Promise<Object>} Popular chats data
         */
        const load = async (page = 1, reload = false) => {
            try {
                console.log('[PopularChatsGallery] Loading page:', page, 'reload:', reload);

                // Update state
                if (typeof DashboardState !== 'undefined') {
                    DashboardState.setState('gallery.popularChats.loading', true);
                }
                isLoading = true;

                // Check cache first if not reloading
                if (!reload && typeof CacheManager !== 'undefined') {
                    const cached = CacheManager.get(`gallery-popular-chats-page-${page}`);
                    if (cached) {
                        console.debug('[PopularChatsGallery] Using cached data for page:', page);
                        currentPage = page;
                        return cached;
                    }
                }

                // Fetch from server
                const response = await fetch(`/api/chats/popular?page=${page}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();

                // Update state
                currentPage = page;
                totalPages = data.totalPages || 1;

                // Cache results
                if (typeof CacheManager !== 'undefined') {
                    CacheManager.set(
                        `gallery-popular-chats-page-${page}`,
                        data,
                        { ttl: 3600000 } // 1 hour
                    );
                }

                // Update dashboard state
                if (typeof DashboardState !== 'undefined') {
                    DashboardState.setState('gallery.popularChats.page', page);
                    DashboardState.setState('gallery.popularChats.totalPages', totalPages);
                    DashboardState.setState('gallery.popularChats.loading', false);
                }

                isLoading = false;
                console.log('[PopularChatsGallery] Loaded', data.data?.length || 0, 'chats');

                return data;
            } catch (error) {
                console.error('[PopularChatsGallery] Load error:', error);
                isLoading = false;

                if (typeof DashboardState !== 'undefined') {
                    DashboardState.setState('gallery.popularChats.loading', false);
                }

                return { data: [], totalPages: 0, error: error.message };
            }
        };

        /**
         * Display popular chats in gallery
         * 
         * @param {Array} chats - Chat data array
         * @param {string} containerId - Target container ID
         */
        const display = (chats = [], containerId = '#popular-chats-gallery') => {
            try {
                console.log('[PopularChatsGallery] Displaying', chats.length, 'chats');

                const container = document.querySelector(containerId);
                if (!container) {
                    console.warn('[PopularChatsGallery] Container not found:', containerId);
                    return;
                }

                // Clear previous content
                container.innerHTML = '';

                if (!chats || chats.length === 0) {
                    container.innerHTML = '<div class="empty-state">No popular chats found</div>';
                    return;
                }

                // Generate HTML for all chats
                const html = chats.map((chat, index) => {
                    const isNSFW = chat.nsfw;
                    const showNSFW = window.user?.preferences?.showNSFW || false;
                    const isAdmin = window.user?.isAdmin || false;
                    const isTemporary = window.user?.isTemporary || false;

                    return GalleryRendererBase.createImageCard(
                        chat,
                        isNSFW && !showNSFW,
                        false,
                        isAdmin,
                        isTemporary,
                        index,
                        containerId,
                        galleryType,
                        true
                    );
                }).join('');

                container.innerHTML = html;

                // Apply lazy loading
                GalleryRendererBase.applyLazyLoading(container);

                // Setup click handlers
                setupClickHandlers(chats, container);

                // Trigger event
                if (typeof DashboardEventManager !== 'undefined') {
                    DashboardEventManager.broadcast('popularChatsDisplayed', { count: chats.length });
                }

                console.debug('[PopularChatsGallery] Display complete');
            } catch (error) {
                console.error('[PopularChatsGallery] Display error:', error);
            }
        };

        /**
         * Setup click handlers for chat cards
         * 
         * @param {Array} chats - Chat data
         * @param {HTMLElement} container - Gallery container
         */
        const setupClickHandlers = (chats, container) => {
            try {
                const cards = container.querySelectorAll('.image-card');

                cards.forEach((card, index) => {
                    card.style.cursor = 'pointer';
                    card.addEventListener('click', () => {
                        const chat = chats[index];
                        if (chat) {
                            handleChatClick(chat);
                        }
                    });
                });
            } catch (error) {
                console.error('[PopularChatsGallery] Setup click handlers error:', error);
            }
        };

        /**
         * Handle chat card click
         * 
         * @param {Object} chat - Chat data
         */
        const handleChatClick = (chat) => {
            try {
                console.log('[PopularChatsGallery] Chat selected:', chat.name);

                // Update state
                if (typeof DashboardState !== 'undefined') {
                    DashboardState.setState('selectedChat', chat);
                }

                // Trigger event
                if (typeof DashboardEventManager !== 'undefined') {
                    DashboardEventManager.broadcast('chatSelected', { chat });
                }

                // Navigate to chat page if available
                if (typeof window.redirectToChatPage === 'function') {
                    window.redirectToChatPage({ dataset: { persona: chat._id } });
                }
            } catch (error) {
                console.error('[PopularChatsGallery] Chat click handler error:', error);
            }
        };

        /**
         * Initialize gallery
         * 
         * @returns {Promise<void>}
         */
        const initialize = async () => {
            try {
                console.log('[PopularChatsGallery] Initializing...');

                // Load first page
                const data = await load(1, false);

                // Display results
                display(data.data || []);

                console.log('[PopularChatsGallery] Initialization complete');
            } catch (error) {
                console.error('[PopularChatsGallery] Initialization error:', error);
            }
        };

        /**
         * Clear gallery
         */
        const clear = () => {
            try {
                GalleryRendererBase.clearGallery('#popular-chats-gallery');
                currentPage = 1;
                totalPages = 1;
                console.log('[PopularChatsGallery] Gallery cleared');
            } catch (error) {
                console.error('[PopularChatsGallery] Clear error:', error);
            }
        };

        /**
         * Get current page
         * 
         * @returns {number} Current page number
         */
        const getCurrentPage = () => currentPage;

        /**
         * Get total pages
         * 
         * @returns {number} Total pages
         */
        const getTotalPages = () => totalPages;

        /**
         * Check if currently loading
         * 
         * @returns {boolean}
         */
        const getIsLoading = () => isLoading;

        /**
         * Get diagnostic information
         * 
         * @returns {Object} Diagnostic info
         */
        const getDiagnostics = () => {
            return {
                module: 'PopularChatsGallery',
                currentPage,
                totalPages,
                isLoading,
                type: galleryType,
                status: 'ready'
            };
        };

        // Public API
        return {
            load,
            display,
            initialize,
            clear,
            getCurrentPage,
            getTotalPages,
            getIsLoading,
            getDiagnostics
        };
    })();

    // Auto-register with Phase 1 system if available
    if (typeof DashboardApp !== 'undefined') {
        DashboardApp.registerModule('PopularChatsGallery', PopularChatsGallery);
    }
}

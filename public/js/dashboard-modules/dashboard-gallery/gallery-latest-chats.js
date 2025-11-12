/**
 * Latest Chats Gallery Module
 * 
 * Handles latest chats gallery rendering, loading, and management.
 * Part of the Phase 2 gallery system refactoring.
 * 
 * @author Dashboard Refactor Phase 2
 * @date November 12, 2025
 */

'use strict';

if (typeof LatestChatsGallery === 'undefined') {
    window.LatestChatsGallery = (() => {
        // Internal state
        let currentPage = 1;
        let totalPages = 1;
        let isLoading = false;
        let galleryType = 'latest';

        /**
         * Load latest chats from server
         * 
         * @param {number} page - Page number
         * @param {boolean} reload - Force reload from server
         * @returns {Promise<Object>} Latest chats data
         */
        const load = async (page = 1, reload = false) => {
            try {
                console.log('[LatestChatsGallery] Loading page:', page, 'reload:', reload);

                // Update state
                if (typeof DashboardState !== 'undefined') {
                    DashboardState.setState('gallery.latestChats.loading', true);
                }
                isLoading = true;

                // Check cache first if not reloading
                if (!reload && typeof CacheManager !== 'undefined') {
                    const cached = CacheManager.get(`gallery-latest-chats-page-${page}`);
                    if (cached) {
                        console.debug('[LatestChatsGallery] Using cached data for page:', page);
                        currentPage = page;
                        return cached;
                    }
                }

                // Fetch from server
                const response = await fetch(`/api/chats/latest?page=${page}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();

                // Update state
                currentPage = page;
                totalPages = data.totalPages || 1;

                // Cache results
                if (typeof CacheManager !== 'undefined') {
                    CacheManager.set(
                        `gallery-latest-chats-page-${page}`,
                        data,
                        { ttl: 1800000 } // 30 minutes (more frequent updates)
                    );
                }

                // Update dashboard state
                if (typeof DashboardState !== 'undefined') {
                    DashboardState.setState('gallery.latestChats.page', page);
                    DashboardState.setState('gallery.latestChats.totalPages', totalPages);
                    DashboardState.setState('gallery.latestChats.loading', false);
                }

                isLoading = false;
                console.log('[LatestChatsGallery] Loaded', data.data?.length || 0, 'chats');

                return data;
            } catch (error) {
                console.error('[LatestChatsGallery] Load error:', error);
                isLoading = false;

                if (typeof DashboardState !== 'undefined') {
                    DashboardState.setState('gallery.latestChats.loading', false);
                }

                return { data: [], totalPages: 0, error: error.message };
            }
        };

        /**
         * Display latest chats in gallery
         * 
         * @param {Array} chats - Chat data array
         * @param {string} containerId - Target container ID
         */
        const display = (chats = [], containerId = '#latest-chats-gallery') => {
            try {
                console.log('[LatestChatsGallery] Displaying', chats.length, 'chats');

                const container = document.querySelector(containerId);
                if (!container) {
                    console.warn('[LatestChatsGallery] Container not found:', containerId);
                    return;
                }

                // Clear previous content
                container.innerHTML = '';

                if (!chats || chats.length === 0) {
                    container.innerHTML = '<div class="empty-state">No latest chats found</div>';
                    return;
                }

                // Generate HTML for all chats
                const html = chats.map((chat, index) => {
                    const isNSFW = chat.nsfw;
                    const showNSFW = window.user?.preferences?.showNSFW || false;
                    const isAdmin = window.user?.isAdmin || false;
                    const isTemporary = window.user?.isTemporary || false;

                    // Create base card HTML
                    let cardHtml = GalleryRendererBase.createImageCard(
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

                    // Add timestamp to card
                    if (chat.created_at) {
                        const date = new Date(chat.created_at);
                        const dateStr = date.toLocaleDateString();
                        const timeStr = date.toLocaleTimeString();
                        cardHtml = cardHtml.replace(
                            '</div>\n                    </div>',
                            `<p class="chat-created"><small>${dateStr} ${timeStr}</small></p>\n                        </div>\n                    </div>`
                        );
                    }

                    return cardHtml;
                }).join('');

                container.innerHTML = html;

                // Apply lazy loading
                GalleryRendererBase.applyLazyLoading(container);

                // Setup click handlers
                setupClickHandlers(chats, container);

                // Trigger event
                if (typeof DashboardEventManager !== 'undefined') {
                    DashboardEventManager.broadcast('latestChatsDisplayed', { count: chats.length });
                }

                console.debug('[LatestChatsGallery] Display complete');
            } catch (error) {
                console.error('[LatestChatsGallery] Display error:', error);
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
                console.error('[LatestChatsGallery] Setup click handlers error:', error);
            }
        };

        /**
         * Handle chat card click
         * 
         * @param {Object} chat - Chat data
         */
        const handleChatClick = (chat) => {
            try {
                console.log('[LatestChatsGallery] Chat selected:', chat.name);

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
                console.error('[LatestChatsGallery] Chat click handler error:', error);
            }
        };

        /**
         * Initialize gallery
         * 
         * @returns {Promise<void>}
         */
        const initialize = async () => {
            try {
                console.log('[LatestChatsGallery] Initializing...');

                // Load first page
                const data = await load(1, false);

                // Display results
                display(data.data || []);

                console.log('[LatestChatsGallery] Initialization complete');
            } catch (error) {
                console.error('[LatestChatsGallery] Initialization error:', error);
            }
        };

        /**
         * Clear gallery
         */
        const clear = () => {
            try {
                GalleryRendererBase.clearGallery('#latest-chats-gallery');
                currentPage = 1;
                totalPages = 1;
                console.log('[LatestChatsGallery] Gallery cleared');
            } catch (error) {
                console.error('[LatestChatsGallery] Clear error:', error);
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
                module: 'LatestChatsGallery',
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
        DashboardApp.registerModule('LatestChatsGallery', LatestChatsGallery);
    }
}

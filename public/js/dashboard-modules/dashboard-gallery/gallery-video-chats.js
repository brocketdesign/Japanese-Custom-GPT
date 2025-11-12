/**
 * Video Chats Gallery Module
 * 
 * Handles video chats gallery rendering, loading, and playback.
 * Part of the Phase 2 gallery system refactoring.
 * 
 * @author Dashboard Refactor Phase 2
 * @date November 12, 2025
 */

'use strict';

if (typeof VideoChatsGallery === 'undefined') {
    window.VideoChatsGallery = (() => {
        // Internal state
        let currentPage = 1;
        let totalPages = 1;
        let isLoading = false;
        let galleryType = 'video';

        /**
         * Load video chats from server
         * 
         * @param {number} page - Page number
         * @param {boolean} reload - Force reload from server
         * @returns {Promise<Object>} Video chats data
         */
        const load = async (page = 1, reload = false) => {
            try {
                console.log('[VideoChatsGallery] Loading page:', page, 'reload:', reload);

                // Update state
                if (typeof DashboardState !== 'undefined') {
                    DashboardState.setState('gallery.videoChats.loading', true);
                }
                isLoading = true;

                // Check cache first if not reloading
                if (!reload && typeof CacheManager !== 'undefined') {
                    const cached = CacheManager.get(`gallery-video-chats-page-${page}`);
                    if (cached) {
                        console.debug('[VideoChatsGallery] Using cached data for page:', page);
                        currentPage = page;
                        return cached;
                    }
                }

                // Fetch from server
                const response = await fetch(`/api/chats/videos?page=${page}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();

                // Update state
                currentPage = page;
                totalPages = data.totalPages || 1;

                // Cache results
                if (typeof CacheManager !== 'undefined') {
                    CacheManager.set(
                        `gallery-video-chats-page-${page}`,
                        data,
                        { ttl: 1800000 } // 30 minutes
                    );
                }

                // Update dashboard state
                if (typeof DashboardState !== 'undefined') {
                    DashboardState.setState('gallery.videoChats.page', page);
                    DashboardState.setState('gallery.videoChats.totalPages', totalPages);
                    DashboardState.setState('gallery.videoChats.loading', false);
                }

                isLoading = false;
                console.log('[VideoChatsGallery] Loaded', data.data?.length || 0, 'videos');

                return data;
            } catch (error) {
                console.error('[VideoChatsGallery] Load error:', error);
                isLoading = false;

                if (typeof DashboardState !== 'undefined') {
                    DashboardState.setState('gallery.videoChats.loading', false);
                }

                return { data: [], totalPages: 0, error: error.message };
            }
        };

        /**
         * Display video chats in gallery
         * 
         * @param {Array} videos - Video data array
         * @param {string} containerId - Target container ID
         */
        const display = (videos = [], containerId = '#video-chats-gallery') => {
            try {
                console.log('[VideoChatsGallery] Displaying', videos.length, 'videos');

                const container = document.querySelector(containerId);
                if (!container) {
                    console.warn('[VideoChatsGallery] Container not found:', containerId);
                    return;
                }

                // Clear previous content
                container.innerHTML = '';

                if (!videos || videos.length === 0) {
                    container.innerHTML = '<div class="empty-state">No videos found</div>';
                    return;
                }

                const isAdmin = window.user?.isAdmin || false;
                const isTemporary = window.user?.isTemporary || false;

                // Generate HTML for all videos
                const html = videos.map((video, index) => {
                    const isNSFW = video.nsfw;
                    const isBlur = isNSFW; // Always blur NSFW videos initially

                    return GalleryRendererBase.createVideoCard(
                        video,
                        isBlur,
                        isTemporary
                    );
                }).join('');

                container.innerHTML = html;

                // Apply lazy loading
                GalleryRendererBase.applyLazyLoading(container);

                // Setup click handlers
                setupClickHandlers(videos, container);

                // Trigger event
                if (typeof DashboardEventManager !== 'undefined') {
                    DashboardEventManager.broadcast('videoChatsDisplayed', { count: videos.length });
                }

                console.debug('[VideoChatsGallery] Display complete');
            } catch (error) {
                console.error('[VideoChatsGallery] Display error:', error);
            }
        };

        /**
         * Setup click handlers for video cards
         * 
         * @param {Array} videos - Video data
         * @param {HTMLElement} container - Gallery container
         */
        const setupClickHandlers = (videos, container) => {
            try {
                const cards = container.querySelectorAll('.video-card');

                cards.forEach((card, index) => {
                    card.style.cursor = 'pointer';
                    card.addEventListener('click', () => {
                        const video = videos[index];
                        if (video) {
                            playVideo(video.video_url || video.url, video.name || video.title);
                        }
                    });
                });
            } catch (error) {
                console.error('[VideoChatsGallery] Setup click handlers error:', error);
            }
        };

        /**
         * Play video in modal
         * 
         * @param {string} videoUrl - Video URL
         * @param {string} chatName - Chat/video name
         */
        const playVideo = (videoUrl, chatName) => {
            try {
                console.log('[VideoChatsGallery] Playing video:', chatName);

                // Update state
                if (typeof DashboardState !== 'undefined') {
                    DashboardState.setState('modals.videoPlay.isOpen', true);
                }

                // Use existing playVideoModal function if available
                if (typeof window.playVideoModal === 'function') {
                    window.playVideoModal(videoUrl, chatName);
                } else {
                    // Fallback: open in new window
                    window.open(videoUrl, '_blank');
                }

                // Trigger event
                if (typeof DashboardEventManager !== 'undefined') {
                    DashboardEventManager.broadcast('videoPlayed', { url: videoUrl, name: chatName });
                }
            } catch (error) {
                console.error('[VideoChatsGallery] Play video error:', error);
            }
        };

        /**
         * Toggle NSFW status for admin users
         * 
         * @param {string} videoId - Video ID
         * @param {boolean} isNSFW - New NSFW status
         * @returns {Promise<boolean>} Success
         */
        const toggleNSFW = async (videoId, isNSFW) => {
            try {
                if (!window.user?.isAdmin) {
                    console.warn('[VideoChatsGallery] Only admins can toggle NSFW');
                    return false;
                }

                console.log('[VideoChatsGallery] Toggling NSFW for video:', videoId);

                // Call update API
                const response = await fetch(`/api/videos/${videoId}/nsfw`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ nsfw: isNSFW })
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                // Invalidate cache
                if (typeof CacheManager !== 'undefined') {
                    CacheManager.delete(`gallery-video-chats-page-${currentPage}`);
                }

                console.debug('[VideoChatsGallery] NSFW toggled successfully');
                return true;
            } catch (error) {
                console.error('[VideoChatsGallery] Toggle NSFW error:', error);
                return false;
            }
        };

        /**
         * Initialize gallery
         * 
         * @returns {Promise<void>}
         */
        const initialize = async () => {
            try {
                console.log('[VideoChatsGallery] Initializing...');

                // Load first page
                const data = await load(1, false);

                // Display results
                display(data.data || []);

                console.log('[VideoChatsGallery] Initialization complete');
            } catch (error) {
                console.error('[VideoChatsGallery] Initialization error:', error);
            }
        };

        /**
         * Clear gallery
         */
        const clear = () => {
            try {
                GalleryRendererBase.clearGallery('#video-chats-gallery');
                currentPage = 1;
                totalPages = 1;
                console.log('[VideoChatsGallery] Gallery cleared');
            } catch (error) {
                console.error('[VideoChatsGallery] Clear error:', error);
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
                module: 'VideoChatsGallery',
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
            playVideo,
            toggleNSFW,
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
        DashboardApp.registerModule('VideoChatsGallery', VideoChatsGallery);
    }
}

/**
 * Dashboard Gallery System - Phase 2 Main Entry Point
 * 
 * Orchestrates all gallery modules and provides unified gallery API.
 * Registers all gallery modules with the Phase 1 foundation system.
 * 
 * @author Dashboard Refactor Phase 2
 * @date November 12, 2025
 */

'use strict';

if (typeof DashboardGallerySystem === 'undefined') {
    window.DashboardGallerySystem = (() => {
        /**
         * Gallery registry - maps gallery types to modules
         */
        const galleryRegistry = {
            'popular': null,
            'latest': null,
            'video': null,
            'posts': null
        };

        /**
         * Initialize gallery system
         * Called by DashboardInitializer after Phase 1 is ready
         * 
         * @returns {Promise<void>}
         */
        const init = async () => {
            try {
                console.log('[DashboardGallerySystem] Initializing Phase 2 Gallery System...');

                // Wait for dependencies
                if (typeof DashboardApp === 'undefined') {
                    throw new Error('Phase 1 foundation (DashboardApp) not loaded');
                }

                // Register gallery modules
                registerGalleryModules();

                // Verify all modules loaded
                verifyModules();

                // Initialize modules
                await initializeModules();

                console.log('[DashboardGallerySystem] Gallery system initialized successfully');

                return true;
            } catch (error) {
                console.error('[DashboardGallerySystem] Initialization error:', error);
                return false;
            }
        };

        /**
         * Register all gallery modules with the system
         */
        const registerGalleryModules = () => {
            try {
                console.log('[DashboardGallerySystem] Registering gallery modules...');

                // Register individual gallery modules
                if (typeof PopularChatsGallery !== 'undefined') {
                    galleryRegistry.popular = PopularChatsGallery;
                    DashboardApp.registerModule('PopularChatsGallery', PopularChatsGallery);
                    console.debug('[DashboardGallerySystem] Registered PopularChatsGallery');
                }

                if (typeof LatestChatsGallery !== 'undefined') {
                    galleryRegistry.latest = LatestChatsGallery;
                    DashboardApp.registerModule('LatestChatsGallery', LatestChatsGallery);
                    console.debug('[DashboardGallerySystem] Registered LatestChatsGallery');
                }

                if (typeof VideoChatsGallery !== 'undefined') {
                    galleryRegistry.video = VideoChatsGallery;
                    DashboardApp.registerModule('VideoChatsGallery', VideoChatsGallery);
                    console.debug('[DashboardGallerySystem] Registered VideoChatsGallery');
                }

                if (typeof UserPostsGallery !== 'undefined') {
                    galleryRegistry.posts = UserPostsGallery;
                    DashboardApp.registerModule('UserPostsGallery', UserPostsGallery);
                    console.debug('[DashboardGallerySystem] Registered UserPostsGallery');
                }

                if (typeof GalleryRendererBase !== 'undefined') {
                    DashboardApp.registerModule('GalleryRendererBase', GalleryRendererBase);
                    console.debug('[DashboardGallerySystem] Registered GalleryRendererBase');
                }

                console.log('[DashboardGallerySystem] All modules registered');
            } catch (error) {
                console.error('[DashboardGallerySystem] Module registration error:', error);
            }
        };

        /**
         * Verify all required modules are loaded
         * 
         * @returns {boolean} True if all modules present
         */
        const verifyModules = () => {
            const required = ['PopularChatsGallery', 'LatestChatsGallery', 'VideoChatsGallery', 'UserPostsGallery', 'GalleryRendererBase'];
            const missing = [];

            required.forEach(module => {
                if (typeof window[module] === 'undefined') {
                    missing.push(module);
                }
            });

            if (missing.length > 0) {
                console.warn('[DashboardGallerySystem] Missing modules:', missing);
                return false;
            }

            console.debug('[DashboardGallerySystem] All modules verified');
            return true;
        };

        /**
         * Initialize all gallery modules
         * 
         * @returns {Promise<void>}
         */
        const initializeModules = async () => {
            try {
                console.log('[DashboardGallerySystem] Initializing gallery modules...');

                // Note: Don't auto-initialize galleries here
                // Let them be initialized on-demand by the application
                // This prevents loading all gallery data at startup

                console.debug('[DashboardGallerySystem] Modules ready for on-demand initialization');
            } catch (error) {
                console.error('[DashboardGallerySystem] Module initialization error:', error);
            }
        };

        /**
         * Load a specific gallery
         * 
         * @param {string} galleryType - Gallery type (popular, latest, video, posts)
         * @param {Object} options - Load options (page, reload, userId)
         * @returns {Promise<Object>} Gallery data
         */
        const load = async (galleryType, options = {}) => {
            try {
                const gallery = getGallery(galleryType);
                if (!gallery) {
                    throw new Error(`Gallery type not found: ${galleryType}`);
                }

                console.log('[DashboardGallerySystem] Loading gallery:', galleryType);

                const { page = 1, reload = false, userId } = options;

                // Load based on gallery type
                if (galleryType === 'posts' && userId) {
                    return await gallery.load(userId, page, reload);
                } else {
                    return await gallery.load(page, reload);
                }
            } catch (error) {
                console.error('[DashboardGallerySystem] Load error:', error);
                return { data: [], error: error.message };
            }
        };

        /**
         * Display a gallery
         * 
         * @param {string} galleryType - Gallery type
         * @param {Array} data - Gallery data to display
         * @param {string} containerId - Target container ID
         */
        const display = (galleryType, data, containerId) => {
            try {
                const gallery = getGallery(galleryType);
                if (!gallery) {
                    throw new Error(`Gallery type not found: ${galleryType}`);
                }

                console.log('[DashboardGallerySystem] Displaying gallery:', galleryType);

                gallery.display(data, containerId);
            } catch (error) {
                console.error('[DashboardGallerySystem] Display error:', error);
            }
        };

        /**
         * Get gallery module by type
         * 
         * @param {string} galleryType - Gallery type
         * @returns {Object} Gallery module or null
         */
        const getGallery = (galleryType) => {
            return galleryRegistry[galleryType] || null;
        };

        /**
         * Clear all galleries
         */
        const clearAll = () => {
            try {
                console.log('[DashboardGallerySystem] Clearing all galleries');

                Object.values(galleryRegistry).forEach(gallery => {
                    if (gallery && typeof gallery.clear === 'function') {
                        gallery.clear();
                    }
                });
            } catch (error) {
                console.error('[DashboardGallerySystem] Clear all error:', error);
            }
        };

        /**
         * Get diagnostic information
         * 
         * @returns {Object} Diagnostic info
         */
        const getDiagnostics = () => {
            const diagnostics = {
                module: 'DashboardGallerySystem',
                phase: 2,
                status: 'ready',
                registeredGalleries: Object.keys(galleryRegistry),
                details: {}
            };

            // Get diagnostics from each gallery
            Object.entries(galleryRegistry).forEach(([type, gallery]) => {
                if (gallery && typeof gallery.getDiagnostics === 'function') {
                    diagnostics.details[type] = gallery.getDiagnostics();
                }
            });

            return diagnostics;
        };

        /**
         * Log diagnostic information
         */
        const logDiagnostics = () => {
            const diagnostics = getDiagnostics();
            console.group('[DashboardGallerySystem] Diagnostics');
            console.log('Module:', diagnostics.module);
            console.log('Phase:', diagnostics.phase);
            console.log('Status:', diagnostics.status);
            console.log('Registered Galleries:', diagnostics.registeredGalleries);
            console.log('Details:', diagnostics.details);
            console.groupEnd();
        };

        // Public API
        return {
            init,
            load,
            display,
            getGallery,
            clearAll,
            getDiagnostics,
            logDiagnostics,
            // Direct access to gallery modules
            PopularChatsGallery: () => galleryRegistry.popular,
            LatestChatsGallery: () => galleryRegistry.latest,
            VideoChatsGallery: () => galleryRegistry.video,
            UserPostsGallery: () => galleryRegistry.posts
        };
    })();

    // Auto-register with Phase 1 system
    if (typeof DashboardApp !== 'undefined') {
        DashboardApp.registerModule('DashboardGallerySystem', DashboardGallerySystem);
        console.log('[DashboardGallerySystem] Registered with Phase 1 foundation');
    }
}

/**
 * Auto-initialize on document ready
 * Will run after all Phase 2 gallery modules are loaded
 */
$(document).ready(function() {
    setTimeout(function() {
        if (typeof DashboardGallerySystem !== 'undefined') {
            DashboardGallerySystem.init().catch(error => {
                console.error('[DashboardGallerySystem] Auto-initialization failed:', error);
            });
        }
    }, 500);
});

/**
 * Dashboard Initialization Module
 * 
 * Handles dashboard initialization sequence including state setup,
 * module integration, and initial content loading.
 * 
 * @author Dashboard Refactor Phase 1
 * @date November 12, 2025
 */

'use strict';

if (typeof DashboardInitializer === 'undefined') {
    window.DashboardInitializer = (() => {
        /**
         * Main initialization routine
         * Called by dashboard-core on document ready
         * 
         * @returns {Promise<void>}
         */
        const init = async () => {
            try {
                console.log('[DashboardInitializer] Starting initialization sequence...');

                // 1. Setup user context
                setupUserContext();

                // 2. Initialize UI state
                initializeUIState();

                // 3. Load configuration
                loadConfiguration();

                // 4. Setup module integrations
                setupModuleIntegrations();

                // 5. Load initial content
                await loadInitialContent();

                console.log('[DashboardInitializer] Initialization complete');

            } catch (error) {
                console.error('[DashboardInitializer] Initialization error:', error);
                throw error;
            }
        };

        /**
         * Setup user context from global variables
         * Captures user info from already-loaded window.user
         */
        const setupUserContext = () => {
            try {
                if (typeof window.user !== 'undefined') {
                    const user = window.user;
                    
                    DashboardState.setState('user.id', user._id || null);
                    DashboardState.setState('user.isTemporary', !!user.isTemporary);
                    DashboardState.setState('user.subscriptionStatus', user.subscriptionStatus);
                    
                    if (typeof window.isAdmin !== 'undefined') {
                        DashboardState.setState('user.isAdmin', window.isAdmin);
                    }

                    console.debug('[DashboardInitializer] User context loaded');
                } else {
                    console.warn('[DashboardInitializer] User context not available');
                }
            } catch (error) {
                console.error('[DashboardInitializer] User context setup failed:', error);
            }
        };

        /**
         * Initialize UI state from existing DOM elements
         */
        const initializeUIState = () => {
            try {
                // Detect language from document or localStorage
                let lang = 'en';
                
                if (typeof window.user !== 'undefined' && window.user.lang) {
                    lang = window.user.lang;
                } else if (localStorage.getItem('userLanguage')) {
                    lang = localStorage.getItem('userLanguage');
                } else {
                    lang = document.documentElement.lang || 'en';
                }

                DashboardState.setState('ui.language', lang);

                // Detect reduced motion preference
                const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                DashboardState.setState('ui.reducedMotion', prefersReducedMotion);

                // Detect dark mode preference
                const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                
                console.debug('[DashboardInitializer] UI state initialized:', {
                    language: lang,
                    reducedMotion: prefersReducedMotion,
                    darkMode: prefersDarkMode
                });

            } catch (error) {
                console.error('[DashboardInitializer] UI state initialization failed:', error);
            }
        };

        /**
         * Load configuration settings
         */
        const loadConfiguration = () => {
            try {
                // Default grid size
                let gridSize = 2;
                const savedGridSize = localStorage.getItem('dashboardGridSize');
                if (savedGridSize && !isNaN(parseInt(savedGridSize))) {
                    gridSize = Math.max(1, Math.min(4, parseInt(savedGridSize)));
                }
                DashboardState.setState('ui.gridSize', gridSize);

                // NSFW content preference
                const showNSFW = localStorage.getItem('showNSFWContent') === 'true';
                DashboardState.setState('ui.showNSFW', showNSFW);

                console.debug('[DashboardInitializer] Configuration loaded');

            } catch (error) {
                console.error('[DashboardInitializer] Configuration load failed:', error);
            }
        };

        /**
         * Setup integrations with other modules
         */
        const setupModuleIntegrations = () => {
            try {
                // Listen for language changes from other systems
                $(document).on('languageChanged', function(event, newLang) {
                    DashboardState.setState('ui.language', newLang);
                    localStorage.setItem('userLanguage', newLang);
                });

                // Listen for user updates
                $(document).on('userUpdated', function(event, userData) {
                    DashboardState.setState('user.subscriptionStatus', userData.subscriptionStatus);
                });

                // Listen for cache clear requests from other systems
                $(document).on('clearDashboardCache', function(event, namespace) {
                    if (namespace) {
                        CacheManager.clear(namespace);
                    } else {
                        CacheManager.clear();
                    }
                });

                // Listen for reload requests
                $(document).on('reloadDashboard', async function(event) {
                    await DashboardApp.reload();
                });

                console.debug('[DashboardInitializer] Module integrations setup');

            } catch (error) {
                console.error('[DashboardInitializer] Module integration setup failed:', error);
            }
        };

        /**
         * Load initial content
         * Called on first page load
         * 
         * @returns {Promise<void>}
         */
        const loadInitialContent = async () => {
            try {
                console.debug('[DashboardInitializer] Loading initial content...');

                // Check if we're on a page that needs initial dashboard content
                const onDiscoveryPage = $('[data-discovery-page]').length > 0;
                const onCharacterPage = $('#characterProfilePage').length > 0;

                if (onDiscoveryPage || onCharacterPage) {
                    // Initial content loading would be handled by specific modules
                    // (gallery-popular-chats.js, gallery-latest-chats.js, etc.)
                    // This is just a placeholder for the initialization sequence
                    
                    console.debug('[DashboardInitializer] Discovery/character page detected');
                } else {
                    console.debug('[DashboardInitializer] Not on discovery page');
                }

            } catch (error) {
                console.error('[DashboardInitializer] Initial content load failed:', error);
                // Don't throw - initial load failure shouldn't break dashboard
            }
        };

        /**
         * Setup system statistics tracking
         */
        const setupSystemStats = () => {
            try {
                // Track which modules are ready
                const modulesReady = [];
                const allModules = [
                    'gallery-popular-chats',
                    'gallery-latest-chats',
                    'gallery-video-chats',
                    'pagination-manager',
                    'modal-manager'
                ];

                DashboardState.setState('system.totalModules', allModules.length);

                // Listen for module ready events
                allModules.forEach(moduleName => {
                    $(document).on(`${moduleName}Ready`, function() {
                        modulesReady.push(moduleName);
                        DashboardState.setState('system.modulesReady', modulesReady.length);
                    });
                });

            } catch (error) {
                console.error('[DashboardInitializer] System stats setup failed:', error);
            }
        };

        /**
         * Debug helper: dump initialization state
         */
        const dumpState = () => {
            console.group('[DashboardInitializer] State Dump');
            console.log('User Context:', DashboardState.getState('user'));
            console.log('UI State:', DashboardState.getState('ui'));
            console.log('System State:', DashboardState.getState('system'));
            console.groupEnd();
        };

        // Public API
        return {
            init,
            setupUserContext,
            initializeUIState,
            loadConfiguration,
            setupModuleIntegrations,
            loadInitialContent,
            setupSystemStats,
            dumpState
        };
    })();
}

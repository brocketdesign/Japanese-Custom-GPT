/**
 * Dashboard Core Orchestrator
 * 
 * Main entry point for the modular dashboard system.
 * Coordinates module initialization and provides global access to dashboard features.
 * 
 * @author Dashboard Refactor Phase 1
 * @date November 12, 2025
 */

'use strict';

if (typeof DashboardApp === 'undefined') {
    window.DashboardApp = (() => {
        /**
         * Registry of loaded modules
         * Maps module name to module object
         */
        const moduleRegistry = new Map();

        /**
         * Initialization state
         */
        let initialized = false;
        let initializationError = null;

        /**
         * Initialize dashboard system
         * Called once on document ready
         * 
         * @returns {Promise<void>}
         */
        const init = async () => {
            try {
                if (initialized) {
                    console.warn('[DashboardApp] Already initialized');
                    return;
                }

                console.log('[DashboardApp] Initializing modular dashboard...');

                // 1. Verify dependencies
                if (!verifyDependencies()) {
                    throw new Error('Missing required dependencies');
                }

                // 2. Register foundation modules
                registerFoundationModules();

                // 3. Initialize state
                if (!DashboardState.validateState()) {
                    console.warn('[DashboardApp] State validation warnings');
                }

                // 4. Start cache cleanup
                CacheManager.startPeriodicCleanup();

                // 5. Call initializer (after all modules registered)
                if (typeof DashboardInitializer !== 'undefined') {
                    await DashboardInitializer.init();
                }

                // 6. Setup global event listeners
                if (typeof DashboardEventManager !== 'undefined') {
                    DashboardEventManager.setupEventListeners();
                }

                initialized = true;
                DashboardState.setState('system.initialized', true);

                console.log('[DashboardApp] Initialization complete');
                
                // Trigger custom event for other systems to know dashboard is ready
                const event = new CustomEvent('dashboardReady', { 
                    detail: { timestamp: Date.now() } 
                });
                document.dispatchEvent(event);

            } catch (error) {
                initializationError = error;
                console.error('[DashboardApp] Initialization failed:', error);
                
                // Try to gracefully degrade
                console.warn('[DashboardApp] Dashboard may not be fully functional');
            }
        };

        /**
         * Verify required dependencies are loaded
         * 
         * @returns {boolean} True if all dependencies present
         */
        const verifyDependencies = () => {
            const required = [
                'DashboardState',
                'CacheManager',
                'CacheStrategies',
                'jQuery'
            ];

            const missing = [];
            for (const dep of required) {
                if (typeof window[dep] === 'undefined') {
                    missing.push(dep);
                }
            }

            if (missing.length > 0) {
                console.error('[DashboardApp] Missing dependencies:', missing.join(', '));
                return false;
            }

            return true;
        };

        /**
         * Register foundation modules in module registry
         */
        const registerFoundationModules = () => {
            moduleRegistry.set('state', DashboardState);
            moduleRegistry.set('cache', CacheManager);
            moduleRegistry.set('cacheStrategies', CacheStrategies);

            console.log('[DashboardApp] Foundation modules registered');
        };

        /**
         * Register a module in the dashboard system
         * Called by individual modules to register themselves
         * 
         * @param {string} moduleName - Module identifier
         * @param {Object} moduleObject - Module to register
         * @returns {boolean} Success
         */
        const registerModule = (moduleName, moduleObject) => {
            if (!moduleName || typeof moduleObject !== 'object') {
                console.error('[DashboardApp] Invalid module registration:', moduleName);
                return false;
            }

            if (moduleRegistry.has(moduleName)) {
                console.warn(`[DashboardApp] Module already registered: ${moduleName}`);
                return false;
            }

            moduleRegistry.set(moduleName, moduleObject);
            console.debug(`[DashboardApp] Module registered: ${moduleName}`);
            return true;
        };

        /**
         * Get module by name
         * Safe access to registered modules
         * 
         * @param {string} moduleName - Module identifier
         * @returns {Object|null} Module or null if not found
         */
        const getModule = (moduleName) => {
            if (!moduleRegistry.has(moduleName)) {
                console.warn(`[DashboardApp] Module not found: ${moduleName}`);
                return null;
            }
            return moduleRegistry.get(moduleName);
        };

        /**
         * Check if module is registered
         * 
         * @param {string} moduleName - Module identifier
         * @returns {boolean} True if registered
         */
        const hasModule = (moduleName) => {
            return moduleRegistry.has(moduleName);
        };

        /**
         * Get all registered modules
         * 
         * @returns {Object} Module registry
         */
        const getAllModules = () => {
            const modules = {};
            for (const [name, module] of moduleRegistry) {
                modules[name] = module;
            }
            return modules;
        };

        /**
         * List module names
         * 
         * @returns {Array<string>} Array of module names
         */
        const listModules = () => {
            return Array.from(moduleRegistry.keys());
        };

        /**
         * Reload dashboard
         * Clears caches and re-initializes
         * 
         * @returns {Promise<void>}
         */
        const reload = async () => {
            try {
                console.log('[DashboardApp] Reloading dashboard...');
                
                // Reset state
                DashboardState.resetAllState();
                
                // Clear all caches
                CacheManager.clear();
                
                // Re-initialize
                initialized = false;
                await init();
                
            } catch (error) {
                console.error('[DashboardApp] Reload failed:', error);
            }
        };

        /**
         * Get diagnostic info
         * Useful for debugging issues
         * 
         * @returns {Object} Diagnostic information
         */
        const getDiagnostics = () => {
            return {
                initialized: initialized,
                error: initializationError,
                modules: {
                    total: moduleRegistry.size,
                    list: listModules()
                },
                state: {
                    systemState: DashboardState.getState('system'),
                    userContext: DashboardState.getState('user')
                },
                cache: {
                    stats: CacheManager.getStats(),
                    strategies: CacheStrategies.list()
                },
                timestamp: Date.now()
            };
        };

        /**
         * Log diagnostic info
         * Useful for debugging
         */
        const logDiagnostics = () => {
            console.group('[DashboardApp] Diagnostics');
            const diag = getDiagnostics();
            console.log('Initialized:', diag.initialized);
            console.log('Modules:', diag.modules);
            console.log('State:', diag.state);
            console.log('Cache:', diag.cache);
            console.groupEnd();
        };

        // Public API
        return {
            init,
            registerModule,
            getModule,
            hasModule,
            getAllModules,
            listModules,
            reload,
            getDiagnostics,
            logDiagnostics,
            
            // Expose utilities
            State: DashboardState,
            Cache: CacheManager,
            CacheStrategies: CacheStrategies
        };
    })();
}

/**
 * Auto-initialize on document ready
 */
$(document).ready(function() {
    // Give other scripts time to load
    setTimeout(function() {
        if (typeof DashboardApp !== 'undefined') {
            DashboardApp.init();
        }
    }, 100);
});

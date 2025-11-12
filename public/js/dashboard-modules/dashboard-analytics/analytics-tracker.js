/**
 * Analytics Tracker Module - Phase 6: Advanced Analytics & User Engagement System
 * 
 * Core event tracking system that normalizes user actions and batches them for efficient API transmission.
 * Provides real-time event capture, session management, and performance metrics collection.
 * 
 * @module AnalyticsTracker
 * @version 1.0.0
 * @requires dashboard-core.js, cache-manager.js
 * 
 * Features:
 * - Real-time event capture and normalization
 * - Session management and tracking
 * - Event batching for efficient API calls
 * - LocalStorage persistence
 * - Performance metrics collection
 * - Configurable sampling rates
 * - Error handling and retry logic
 * 
 * @example
 * // Initialize tracker
 * AnalyticsTracker.init({
 *   userId: 'user-123',
 *   sessionId: 'session-abc',
 *   batchSize: 10,
 *   batchInterval: 5000
 * });
 * 
 * // Track an event
 * AnalyticsTracker.trackEvent('gallery.view', {
 *   galleryType: 'chat-gallery',
 *   itemCount: 20
 * }, { source: 'discovery' });
 * 
 * // Get session metrics
 * const metrics = AnalyticsTracker.getSessionMetrics();
 */

if (typeof window.AnalyticsTracker === 'undefined') {
    window.AnalyticsTracker = (function() {
        'use strict';

        // ==========================================
        // PRIVATE VARIABLES & STATE
        // ==========================================

        /**
         * Configuration object
         * @type {Object}
         */
        let config = {
            userId: null,
            sessionId: null,
            batchSize: 10,
            batchInterval: 5000,
            sampleRate: 1.0,
            apiEndpoint: '/api/analytics/events',
            enableLocalStorage: true,
            debug: false,
            maxQueueSize: 1000,
            retryAttempts: 3,
            retryDelay: 1000
        };

        /**
         * Event queue for pending events
         * @type {Array<Object>}
         */
        let eventQueue = [];

        /**
         * Session tracking data
         * @type {Object}
         */
        let sessionData = {
            sessionId: null,
            userId: null,
            startTime: null,
            endTime: null,
            duration: 0,
            eventCount: 0,
            pageLoadTime: 0,
            lastActivityTime: null
        };

        /**
         * Batch tracking
         * @type {Object}
         */
        let batchState = {
            batchTimer: null,
            isBatching: false,
            lastBatchTime: null,
            batchCount: 0
        };

        /**
         * Retry tracking
         * @type {Object}
         */
        let retryState = {
            retryQueue: [],
            isRetrying: false
        };

        /**
         * Performance metrics
         * @type {Object}
         */
        let performanceMetrics = {
            eventsCaptured: 0,
            eventsSent: 0,
            eventsDropped: 0,
            apiErrors: 0,
            averageProcessingTime: 0,
            totalProcessingTime: 0
        };

        /**
         * Sampling configuration by event type
         * @type {Object}
         */
        const samplingRules = {
            'gallery.view': 0.8,      // Track 80% of gallery views
            'image.view': 0.5,        // Track 50% of image views
            'mouse.move': 0.1,        // Track 10% of mouse movements
            default: 1.0              // Track 100% of other events
        };

        /**
         * Event category mapping
         * @type {Object}
         */
        const eventCategories = {
            DISCOVERY: {
                GALLERY_VIEW: 'discovery.gallery.view',
                SEARCH_QUERY: 'discovery.search.query',
                FILTER_APPLY: 'discovery.filter.apply',
                SORT_APPLY: 'discovery.sort.apply'
            },
            CONTENT: {
                CHAT_OPEN: 'content.chat.open',
                IMAGE_VIEW: 'content.image.view',
                IMAGE_LIKE: 'content.image.like',
                IMAGE_SHARE: 'content.image.share',
                IMAGE_SAVE: 'content.image.save'
            },
            SOCIAL: {
                FOLLOW_USER: 'social.follow.user',
                SHARE_CONTENT: 'social.share.content',
                COMMENT_CREATE: 'social.comment.create',
                RATE_CONTENT: 'social.rate.content'
            },
            SYSTEM: {
                SESSION_START: 'system.session.start',
                SESSION_END: 'system.session.end',
                PAGE_LOAD: 'system.page.load',
                ERROR_OCCURRED: 'system.error.occurred'
            }
        };

        // ==========================================
        // PRIVATE UTILITY FUNCTIONS
        // ==========================================

        /**
         * Generate unique ID
         * @private
         * @returns {string} UUID-like string
         */
        function generateId() {
            return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        /**
         * Log debug message
         * @private
         * @param {string} message - Debug message
         * @param {*} data - Optional data to log
         */
        function log(message, data) {
            if (config.debug) {
                console.log(`[AnalyticsTracker] ${message}`, data || '');
            }
        }

        /**
         * Log error message
         * @private
         * @param {string} message - Error message
         * @param {*} error - Optional error object
         */
        function logError(message, error) {
            console.error(`[AnalyticsTracker ERROR] ${message}`, error || '');
        }

        /**
         * Check if event should be sampled
         * @private
         * @param {string} eventName - Event name
         * @returns {boolean} True if event should be included
         */
        function shouldSample(eventName) {
            const sampleRate = samplingRules[eventName] || samplingRules.default;
            return Math.random() < sampleRate;
        }

        /**
         * Normalize event data
         * @private
         * @param {string} eventName - Event name
         * @param {Object} eventData - Event data
         * @param {Object} context - Event context
         * @returns {Object} Normalized event
         */
        function normalizeEvent(eventName, eventData, context) {
            return {
                id: generateId(),
                eventName: String(eventName).toLowerCase().trim(),
                timestamp: Date.now(),
                sessionId: sessionData.sessionId,
                userId: sessionData.userId,
                data: eventData || {},
                context: {
                    source: context?.source || 'unknown',
                    referrer: context?.referrer || document.referrer,
                    userAgent: navigator.userAgent,
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    },
                    locale: window.lang || navigator.language,
                    isTemporaryUser: !!window.user?.isTemporary,
                    ...context
                },
                metadata: {
                    captureTime: Date.now(),
                    processingTime: 0,
                    batchId: null
                }
            };
        }

        /**
         * Get from localStorage safely
         * @private
         * @param {string} key - Storage key
         * @returns {*} Stored value or null
         */
        function getFromStorage(key) {
            if (!config.enableLocalStorage) return null;
            try {
                const item = localStorage.getItem(`analytics_${key}`);
                return item ? JSON.parse(item) : null;
            } catch (e) {
                logError('Failed to read from storage', e);
                return null;
            }
        }

        /**
         * Save to localStorage safely
         * @private
         * @param {string} key - Storage key
         * @param {*} value - Value to store
         * @returns {boolean} Success status
         */
        function saveToStorage(key, value) {
            if (!config.enableLocalStorage) return false;
            try {
                localStorage.setItem(`analytics_${key}`, JSON.stringify(value));
                return true;
            } catch (e) {
                logError('Failed to save to storage', e);
                return false;
            }
        }

        /**
         * Calculate average processing time
         * @private
         * @returns {number} Average processing time in ms
         */
        function calculateAverageProcessingTime() {
            if (performanceMetrics.eventsSent === 0) return 0;
            return Math.round(performanceMetrics.totalProcessingTime / performanceMetrics.eventsSent);
        }

        // ==========================================
        // BATCH PROCESSING
        // ==========================================

        /**
         * Process and send event batch
         * @private
         * @returns {Promise<boolean>} Success status
         */
        async function processBatch() {
            if (eventQueue.length === 0) {
                log('No events to batch');
                return true;
            }

            if (batchState.isBatching) {
                log('Batch already in progress');
                return false;
            }

            batchState.isBatching = true;
            const batchId = generateId();
            const batchSize = Math.min(config.batchSize, eventQueue.length);
            const eventsToSend = eventQueue.splice(0, batchSize);

            // Tag events with batch ID
            eventsToSend.forEach(event => {
                event.metadata.batchId = batchId;
            });

            log(`Processing batch ${batchId} with ${eventsToSend.length} events`);

            try {
                const response = await sendEventBatch(eventsToSend);
                
                if (response.success) {
                    performanceMetrics.eventsSent += eventsToSend.length;
                    batchState.lastBatchTime = Date.now();
                    batchState.batchCount++;
                    log(`Batch ${batchId} sent successfully`);
                    
                    // Clear retry queue on success
                    retryState.retryQueue = [];
                    
                    // Save cache
                    saveToStorage('performanceMetrics', performanceMetrics);
                    
                    return true;
                } else {
                    // Return events to queue for retry
                    eventQueue.unshift(...eventsToSend);
                    performanceMetrics.apiErrors++;
                    logError(`Batch ${batchId} failed: ${response.message}`);
                    return false;
                }
            } catch (error) {
                // Return events to queue for retry
                eventQueue.unshift(...eventsToSend);
                performanceMetrics.apiErrors++;
                logError(`Batch ${batchId} error:`, error);
                return false;
            } finally {
                batchState.isBatching = false;
            }
        }

        /**
         * Send event batch to API
         * @private
         * @param {Array<Object>} events - Events to send
         * @returns {Promise<Object>} API response
         */
        async function sendEventBatch(events) {
            try {
                const response = await fetch(config.apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Batch-Size': events.length,
                        'X-Session-Id': sessionData.sessionId
                    },
                    body: JSON.stringify({
                        batchId: events[0]?.metadata.batchId,
                        events: events,
                        timestamp: Date.now(),
                        sessionId: sessionData.sessionId,
                        userId: sessionData.userId
                    }),
                    credentials: 'include'
                });

                if (!response.ok) {
                    return {
                        success: false,
                        message: `HTTP ${response.status}`,
                        status: response.status
                    };
                }

                return await response.json();
            } catch (error) {
                logError('Network error sending batch:', error);
                return {
                    success: false,
                    message: error.message
                };
            }
        }

        /**
         * Schedule batch processing
         * @private
         */
        function scheduleBatchProcessing() {
            // Clear existing timer
            if (batchState.batchTimer) {
                clearTimeout(batchState.batchTimer);
            }

            // Check if batch should be sent immediately
            if (eventQueue.length >= config.batchSize) {
                processBatch();
                return;
            }

            // Schedule batch processing
            batchState.batchTimer = setTimeout(() => {
                if (eventQueue.length > 0) {
                    processBatch();
                }
                scheduleBatchProcessing();
            }, config.batchInterval);
        }

        // ==========================================
        // PUBLIC API
        // ==========================================

        return {
            /**
             * Initialize the analytics tracker
             * @param {Object} options - Configuration options
             * @param {string} options.userId - User ID
             * @param {string} options.sessionId - Session ID
             * @param {number} options.batchSize - Events per batch (default: 10)
             * @param {number} options.batchInterval - Batch interval in ms (default: 5000)
             * @param {number} options.sampleRate - Sample rate 0-1 (default: 1.0)
             * @param {string} options.apiEndpoint - API endpoint (default: '/api/analytics/events')
             * @param {boolean} options.enableLocalStorage - Enable storage (default: true)
             * @param {boolean} options.debug - Debug logging (default: false)
             * @returns {boolean} Initialization success
             */
            init(options = {}) {
                try {
                    config = { ...config, ...options };
                    
                    // Validate required fields
                    if (!config.userId) {
                        logError('userId is required for AnalyticsTracker initialization');
                        return false;
                    }

                    if (!config.sessionId) {
                        config.sessionId = generateId();
                    }

                    // Restore previous performance metrics
                    const savedMetrics = getFromStorage('performanceMetrics');
                    if (savedMetrics) {
                        performanceMetrics = { ...performanceMetrics, ...savedMetrics };
                    }

                    log('Tracker initialized', { userId: config.userId, sessionId: config.sessionId });
                    return true;
                } catch (error) {
                    logError('Initialization failed:', error);
                    return false;
                }
            },

            /**
             * Start session tracking
             * @param {string} userId - User ID
             * @returns {Object} Session data
             */
            startSession(userId) {
                sessionData = {
                    sessionId: config.sessionId,
                    userId: userId || config.userId,
                    startTime: Date.now(),
                    endTime: null,
                    duration: 0,
                    eventCount: 0,
                    pageLoadTime: performance.timing ? performance.timing.loadEventEnd - performance.timing.navigationStart : 0,
                    lastActivityTime: Date.now()
                };

                log('Session started', sessionData);

                // Track session start event
                this.trackEvent(eventCategories.SYSTEM.SESSION_START, {
                    pageUrl: window.location.href,
                    referrer: document.referrer
                }, { source: 'system' });

                // Start batch processing
                scheduleBatchProcessing();

                // Save session to storage
                saveToStorage('sessionData', sessionData);

                return sessionData;
            },

            /**
             * End session and flush events
             * @returns {Promise<boolean>} Completion status
             */
            async endSession() {
                if (!sessionData.sessionId) {
                    log('No active session to end');
                    return false;
                }

                // Update session data
                sessionData.endTime = Date.now();
                sessionData.duration = sessionData.endTime - sessionData.startTime;

                // Track session end event
                this.trackEvent(eventCategories.SYSTEM.SESSION_END, {
                    duration: sessionData.duration,
                    eventCount: sessionData.eventCount
                }, { source: 'system' });

                // Process remaining events
                if (eventQueue.length > 0) {
                    log(`Flushing ${eventQueue.length} remaining events`);
                    while (eventQueue.length > 0) {
                        await processBatch();
                    }
                }

                // Clear batch timer
                if (batchState.batchTimer) {
                    clearTimeout(batchState.batchTimer);
                }

                log('Session ended', sessionData);
                return true;
            },

            /**
             * Track a user event
             * @param {string} eventName - Event name
             * @param {Object} eventData - Event-specific data
             * @param {Object} context - Event context
             * @returns {string|null} Event ID or null if not tracked
             */
            trackEvent(eventName, eventData = {}, context = {}) {
                try {
                    // Check sampling
                    if (!shouldSample(eventName)) {
                        log(`Event ${eventName} not sampled`);
                        return null;
                    }

                    // Normalize event
                    const event = normalizeEvent(eventName, eventData, context);

                    // Check queue size
                    if (eventQueue.length >= config.maxQueueSize) {
                        performanceMetrics.eventsDropped++;
                        logError(`Event queue full, dropping event: ${eventName}`);
                        return null;
                    }

                    // Add to queue
                    eventQueue.push(event);
                    performanceMetrics.eventsCaptured++;
                    sessionData.eventCount++;
                    sessionData.lastActivityTime = Date.now();

                    log(`Event tracked: ${eventName}`, event);

                    // Schedule batch if needed
                    if (eventQueue.length >= config.batchSize) {
                        processBatch();
                    } else {
                        scheduleBatchProcessing();
                    }

                    return event.id;
                } catch (error) {
                    logError(`Failed to track event ${eventName}:`, error);
                    return null;
                }
            },

            /**
             * Get current session metrics
             * @returns {Object} Session metrics
             */
            getSessionMetrics() {
                return {
                    ...sessionData,
                    queueSize: eventQueue.length,
                    batchCount: batchState.batchCount,
                    eventsSent: performanceMetrics.eventsSent,
                    averageProcessingTime: calculateAverageProcessingTime()
                };
            },

            /**
             * Get performance metrics
             * @returns {Object} Performance metrics
             */
            getPerformanceMetrics() {
                return {
                    ...performanceMetrics,
                    averageProcessingTime: calculateAverageProcessingTime(),
                    queueSize: eventQueue.length,
                    batchCount: batchState.batchCount
                };
            },

            /**
             * Track page performance
             * @returns {Object} Performance data
             */
            trackPagePerformance() {
                if (!window.performance || !performance.timing) {
                    log('Performance API not available');
                    return null;
                }

                const timing = performance.timing;
                const navigation = performance.navigation;
                const perfData = {
                    navigationStart: timing.navigationStart,
                    loadEventEnd: timing.loadEventEnd,
                    loadEventStart: timing.loadEventStart,
                    domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
                    domContentLoadedEventStart: timing.domContentLoadedEventStart,
                    domInteractive: timing.domInteractive,
                    domLoading: timing.domLoading,
                    responseEnd: timing.responseEnd,
                    responseStart: timing.responseStart,
                    requestStart: timing.requestStart,
                    connectEnd: timing.connectEnd,
                    connectStart: timing.connectStart,
                    secureConnectionStart: timing.secureConnectionStart,
                    fetchStart: timing.fetchStart,
                    navigationType: navigation.type,
                    redirectCount: navigation.redirectCount,
                    totalLoadTime: timing.loadEventEnd - timing.navigationStart,
                    domReadyTime: timing.domContentLoadedEventEnd - timing.navigationStart,
                    resourcesLoadTime: timing.loadEventEnd - timing.domContentLoadedEventEnd
                };

                this.trackEvent(eventCategories.SYSTEM.PAGE_LOAD, perfData, { source: 'system' });
                return perfData;
            },

            /**
             * Force batch processing
             * @returns {Promise<boolean>} Success status
             */
            async batchEvents() {
                if (eventQueue.length === 0) {
                    log('No events to batch');
                    return true;
                }

                return await processBatch();
            },

            /**
             * Get event queue size
             * @returns {number} Current queue size
             */
            getQueueSize() {
                return eventQueue.length;
            },

            /**
             * Clear event queue (for testing)
             * @returns {number} Number of events cleared
             */
            clearQueue() {
                const count = eventQueue.length;
                eventQueue = [];
                log(`Cleared ${count} events from queue`);
                return count;
            },

            /**
             * Get event categories
             * @returns {Object} Event categories
             */
            getEventCategories() {
                return eventCategories;
            },

            /**
             * Destroy tracker and cleanup
             * @returns {Promise<void>}
             */
            async destroy() {
                await this.endSession();
                if (batchState.batchTimer) {
                    clearTimeout(batchState.batchTimer);
                }
                log('Tracker destroyed');
            }
        };
    })();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.AnalyticsTracker;
}

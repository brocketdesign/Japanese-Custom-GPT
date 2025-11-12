/**
 * Engagement Analyzer Module - Phase 6: Advanced Analytics & User Engagement System
 * 
 * Analyzes user interaction patterns and calculates engagement scores based on behavioral data.
 * Provides user segmentation, trend analysis, and predictive metrics.
 * 
 * @module EngagementAnalyzer
 * @version 1.0.0
 * @requires analytics-tracker.js, cache-manager.js
 * 
 * Features:
 * - Engagement score calculation (0-100 scale)
 * - User interaction pattern analysis
 * - User segmentation (power-user, active, casual, dormant)
 * - Engagement trend analysis
 * - Churn risk prediction
 * - Lifetime value estimation
 * - Component-level breakdowns
 * 
 * @example
 * // Initialize analyzer
 * EngagementAnalyzer.init({
 *   scoreWeights: {
 *     activity: 0.30,
 *     interaction: 0.35,
 *     social: 0.20,
 *     frequency: 0.15
 *   }
 * });
 * 
 * // Calculate engagement score
 * const score = EngagementAnalyzer.calculateEngagementScore(userId);
 * console.log(`Engagement: ${score.total}%`);
 * 
 * // Get user segment
 * const segment = EngagementAnalyzer.identifyUserSegment(userId);
 * console.log(`User segment: ${segment.segment}`);
 */

if (typeof window.EngagementAnalyzer === 'undefined') {
    window.EngagementAnalyzer = (function() {
        'use strict';

        // ==========================================
        // PRIVATE VARIABLES & STATE
        // ==========================================

        /**
         * Configuration object
         * @type {Object}
         */
        let config = {
            scoreWeights: {
                activity: 0.30,        // 30% - Activity level
                interaction: 0.35,     // 35% - Content interaction
                social: 0.20,          // 20% - Social engagement
                frequency: 0.15        // 15% - Session frequency
            },
            segmentThresholds: {
                powerUser: 75,         // >= 75 is power user
                active: 50,            // >= 50 is active
                casual: 25             // >= 25 is casual (< 25 is dormant)
            },
            updateInterval: 3600000,   // 1 hour
            cacheEnabled: true,
            cacheTTL: 300000,          // 5 minutes
            debug: false
        };

        /**
         * User profiles cache
         * @type {Map<string, Object>}
         */
        let userProfiles = new Map();

        /**
         * Cached scores
         * @type {Map<string, Object>}
         */
        let scoreCache = new Map();

        /**
         * Segment cache
         * @type {Map<string, Object>}
         */
        let segmentCache = new Map();

        /**
         * Historical data for trends
         * @type {Map<string, Array>}
         */
        let historyData = new Map();

        /**
         * Reference values for normalization
         * @type {Object}
         */
        let referenceMetrics = {
            avgSessionsPerWeek: 5,
            avgActionsPerSession: 12,
            avgSessionDuration: 1800000, // 30 minutes
            avgReturnRate: 0.7
        };

        // ==========================================
        // PRIVATE UTILITY FUNCTIONS
        // ==========================================

        /**
         * Log debug message
         * @private
         * @param {string} message - Debug message
         * @param {*} data - Optional data
         */
        function log(message, data) {
            if (config.debug) {
                console.log(`[EngagementAnalyzer] ${message}`, data || '');
            }
        }

        /**
         * Log error message
         * @private
         * @param {string} message - Error message
         * @param {*} error - Optional error
         */
        function logError(message, error) {
            console.error(`[EngagementAnalyzer ERROR] ${message}`, error || '');
        }

        /**
         * Normalize value to 0-100 scale
         * @private
         * @param {number} value - Value to normalize
         * @param {number} reference - Reference value
         * @returns {number} Normalized value (0-100)
         */
        function normalize(value, reference) {
            if (reference === 0) return 0;
            const normalized = (value / reference) * 100;
            return Math.min(100, Math.max(0, normalized));
        }

        /**
         * Get cached value if valid
         * @private
         * @param {Map} cache - Cache map
         * @param {string} key - Cache key
         * @returns {*} Cached value or null
         */
        function getCachedValue(cache, key) {
            if (!config.cacheEnabled) return null;
            
            const cached = cache.get(key);
            if (!cached) return null;
            
            const age = Date.now() - cached.timestamp;
            if (age > config.cacheTTL) {
                cache.delete(key);
                return null;
            }
            
            return cached.value;
        }

        /**
         * Set cached value
         * @private
         * @param {Map} cache - Cache map
         * @param {string} key - Cache key
         * @param {*} value - Value to cache
         */
        function setCachedValue(cache, key, value) {
            if (!config.cacheEnabled) return;
            
            cache.set(key, {
                value: value,
                timestamp: Date.now()
            });
        }

        /**
         * Add to history
         * @private
         * @param {string} userId - User ID
         * @param {Object} data - Data point
         */
        function addToHistory(userId, data) {
            if (!historyData.has(userId)) {
                historyData.set(userId, []);
            }
            
            const history = historyData.get(userId);
            history.push({
                ...data,
                timestamp: Date.now()
            });
            
            // Keep only last 100 data points
            if (history.length > 100) {
                history.shift();
            }
        }

        /**
         * Calculate trend from history
         * @private
         * @param {Array<Object>} history - Historical data
         * @param {string} field - Field to analyze
         * @returns {Object} Trend analysis
         */
        function calculateTrend(history, field) {
            if (history.length < 2) {
                return { trend: 'stable', change: 0 };
            }

            const recent = history.slice(-10);
            const older = history.slice(-20, -10) || history.slice(0, 10);

            if (older.length === 0) {
                return { trend: 'stable', change: 0 };
            }

            const recentAvg = recent.reduce((sum, item) => sum + (item[field] || 0), 0) / recent.length;
            const olderAvg = older.reduce((sum, item) => sum + (item[field] || 0), 0) / older.length;

            const change = ((recentAvg - olderAvg) / olderAvg) * 100;

            let trend = 'stable';
            if (change > 10) trend = 'improving';
            else if (change < -10) trend = 'declining';

            return { trend, change, recentAvg, olderAvg };
        }

        /**
         * Build user profile from events
         * @private
         * @param {string} userId - User ID
         * @param {Array<Object>} events - User events
         * @returns {Object} User profile
         */
        function buildUserProfile(userId, events) {
            if (!Array.isArray(events) || events.length === 0) {
                return {
                    userId: userId,
                    eventCount: 0,
                    sessionCount: 0,
                    lastActiveTime: null,
                    interactionTypes: {}
                };
            }

            // Group by session
            const sessions = new Map();
            events.forEach(event => {
                const sessionId = event.sessionId || 'unknown';
                if (!sessions.has(sessionId)) {
                    sessions.set(sessionId, []);
                }
                sessions.get(sessionId).push(event);
            });

            // Analyze interactions
            const interactionTypes = {};
            let totalInteractions = 0;
            let totalDuration = 0;

            events.forEach(event => {
                const eventType = event.eventName?.split('.')[0] || 'unknown';
                interactionTypes[eventType] = (interactionTypes[eventType] || 0) + 1;
                totalInteractions++;
            });

            return {
                userId: userId,
                eventCount: events.length,
                sessionCount: sessions.size,
                avgEventsPerSession: events.length / Math.max(1, sessions.size),
                lastActiveTime: events[events.length - 1]?.timestamp,
                interactionTypes: interactionTypes,
                totalInteractions: totalInteractions,
                sessionsData: Array.from(sessions.values())
            };
        }

        // ==========================================
        // SCORING FUNCTIONS
        // ==========================================

        /**
         * Calculate activity level score (0-100)
         * @private
         * @param {Object} profile - User profile
         * @returns {number} Activity score
         */
        function calculateActivityScore(profile) {
            const sessionsPerWeek = profile.sessionCount / (7); // Approximate from available data
            return normalize(sessionsPerWeek, referenceMetrics.avgSessionsPerWeek);
        }

        /**
         * Calculate interaction score (0-100)
         * @private
         * @param {Object} profile - User profile
         * @returns {number} Interaction score
         */
        function calculateInteractionScore(profile) {
            const actionsPerSession = profile.avgEventsPerSession || 0;
            return normalize(actionsPerSession, referenceMetrics.avgActionsPerSession);
        }

        /**
         * Calculate social engagement score (0-100)
         * @private
         * @param {Object} profile - User profile
         * @returns {number} Social score
         */
        function calculateSocialScore(profile) {
            const socialEvents = (profile.interactionTypes['social'] || 0) +
                                (profile.interactionTypes['content'] || 0);
            const socialRatio = profile.totalInteractions > 0 ? 
                                (socialEvents / profile.totalInteractions) * 100 : 0;
            return Math.min(100, socialRatio);
        }

        /**
         * Calculate frequency score (0-100)
         * @private
         * @param {Object} profile - User profile
         * @returns {number} Frequency score
         */
        function calculateFrequencyScore(profile) {
            // Based on return rate and session distribution
            return Math.min(100, Math.max(0, profile.sessionCount * 10));
        }

        // ==========================================
        // PUBLIC API
        // ==========================================

        return {
            /**
             * Initialize the engagement analyzer
             * @param {Object} options - Configuration options
             * @returns {boolean} Success status
             */
            init(options = {}) {
                try {
                    config = { ...config, ...options };
                    log('Analyzer initialized', config);
                    return true;
                } catch (error) {
                    logError('Initialization failed:', error);
                    return false;
                }
            },

            /**
             * Calculate engagement score for a user
             * @param {string} userId - User ID
             * @param {string} timeWindow - Time window (default: '30d')
             * @returns {Object} Engagement score breakdown
             */
            calculateEngagementScore(userId, timeWindow = '30d') {
                try {
                    // Check cache
                    const cached = getCachedValue(scoreCache, userId);
                    if (cached) {
                        log(`Retrieved cached score for ${userId}`);
                        return cached;
                    }

                    // Get user profile (mock for now - replace with real data source)
                    const profile = userProfiles.get(userId) || {
                        userId: userId,
                        sessionCount: 5,
                        eventCount: 50,
                        avgEventsPerSession: 10,
                        lastActiveTime: Date.now(),
                        interactionTypes: { content: 30, discovery: 15, social: 5 },
                        totalInteractions: 50
                    };

                    // Calculate component scores
                    const activityScore = calculateActivityScore(profile);
                    const interactionScore = calculateInteractionScore(profile);
                    const socialScore = calculateSocialScore(profile);
                    const frequencyScore = calculateFrequencyScore(profile);

                    // Calculate weighted total
                    const total = Math.round(
                        (activityScore * config.scoreWeights.activity) +
                        (interactionScore * config.scoreWeights.interaction) +
                        (socialScore * config.scoreWeights.social) +
                        (frequencyScore * config.scoreWeights.frequency)
                    );

                    const result = {
                        total: total,
                        timeWindow: timeWindow,
                        components: {
                            activityLevel: Math.round(activityScore),
                            contentInteraction: Math.round(interactionScore),
                            socialEngagement: Math.round(socialScore),
                            sessionFrequency: Math.round(frequencyScore)
                        },
                        weights: config.scoreWeights,
                        timestamp: Date.now()
                    };

                    // Cache result
                    setCachedValue(scoreCache, userId, result);
                    
                    // Add to history
                    addToHistory(userId, { score: total });

                    log(`Calculated engagement score for ${userId}: ${total}`, result);
                    return result;
                } catch (error) {
                    logError(`Failed to calculate score for ${userId}:`, error);
                    return { total: 0, components: {}, error: error.message };
                }
            },

            /**
             * Analyze interaction patterns for a user
             * @param {string} userId - User ID
             * @param {Array<Object>} events - User events
             * @returns {Object} Pattern analysis
             */
            analyzeInteractionPatterns(userId, events = []) {
                try {
                    const profile = buildUserProfile(userId, events);

                    return {
                        userId: userId,
                        favoriteContentTypes: Object.entries(profile.interactionTypes || {})
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([type, count]) => ({ type, count })),
                        peakActivityHours: [9, 14, 20], // Example peak hours
                        averageSessionDuration: 1800000, // 30 minutes
                        interactionFrequency: profile.eventCount > 100 ? 'high' : 
                                            profile.eventCount > 50 ? 'medium' : 'low',
                        lastActiveTime: profile.lastActiveTime,
                        sessionCount: profile.sessionCount,
                        avgEventsPerSession: profile.avgEventsPerSession,
                        timestamp: Date.now()
                    };
                } catch (error) {
                    logError(`Failed to analyze patterns for ${userId}:`, error);
                    return { error: error.message };
                }
            },

            /**
             * Identify user segment
             * @param {string} userId - User ID
             * @returns {Object} User segment information
             */
            identifyUserSegment(userId) {
                try {
                    // Check cache
                    const cached = getCachedValue(segmentCache, userId);
                    if (cached) {
                        log(`Retrieved cached segment for ${userId}`);
                        return cached;
                    }

                    // Calculate engagement score
                    const scoreData = this.calculateEngagementScore(userId);
                    const score = scoreData.total;

                    let segment = 'dormant';
                    let confidence = 0.7;

                    if (score >= config.segmentThresholds.powerUser) {
                        segment = 'power-user';
                        confidence = 0.9;
                    } else if (score >= config.segmentThresholds.active) {
                        segment = 'active';
                        confidence = 0.85;
                    } else if (score >= config.segmentThresholds.casual) {
                        segment = 'casual';
                        confidence = 0.75;
                    }

                    const result = {
                        userId: userId,
                        segment: segment,
                        score: score,
                        confidence: confidence,
                        characteristics: [
                            `${segment} user`,
                            `Engagement score: ${score}/100`,
                            segment === 'power-user' ? 'Highly engaged' :
                            segment === 'active' ? 'Regular user' :
                            segment === 'casual' ? 'Occasional user' : 'Inactive'
                        ],
                        timestamp: Date.now()
                    };

                    setCachedValue(segmentCache, userId, result);
                    log(`Identified segment for ${userId}: ${segment}`);
                    return result;
                } catch (error) {
                    logError(`Failed to identify segment for ${userId}:`, error);
                    return { segment: 'unknown', error: error.message };
                }
            },

            /**
             * Get engagement trends
             * @param {string} userId - User ID
             * @param {string} timeRange - Time range (default: '30d')
             * @returns {Object} Trend analysis
             */
            getEngagementTrends(userId, timeRange = '30d') {
                try {
                    const history = historyData.get(userId) || [];
                    
                    if (history.length === 0) {
                        return {
                            userId: userId,
                            trend: 'insufficient_data',
                            message: 'Not enough historical data'
                        };
                    }

                    const trendAnalysis = calculateTrend(history, 'score');

                    return {
                        userId: userId,
                        timeRange: timeRange,
                        trend: trendAnalysis.trend,
                        changePercentage: Math.round(trendAnalysis.change),
                        recentAverage: Math.round(trendAnalysis.recentAvg),
                        olderAverage: Math.round(trendAnalysis.olderAvg),
                        prediction: trendAnalysis.trend === 'improving' ? 'increasing_engagement' :
                                   trendAnalysis.trend === 'declining' ? 'decreasing_engagement' : 'stable',
                        dataPoints: history.slice(-10),
                        timestamp: Date.now()
                    };
                } catch (error) {
                    logError(`Failed to get trends for ${userId}:`, error);
                    return { error: error.message };
                }
            },

            /**
             * Get engagement breakdown
             * @param {string} userId - User ID
             * @returns {Object} Component breakdown
             */
            getEngagementBreakdown(userId) {
                try {
                    const scoreData = this.calculateEngagementScore(userId);
                    return {
                        userId: userId,
                        ...scoreData.components,
                        total: scoreData.total,
                        weights: scoreData.weights,
                        timestamp: Date.now()
                    };
                } catch (error) {
                    logError(`Failed to get breakdown for ${userId}:`, error);
                    return { error: error.message };
                }
            },

            /**
             * Compare user to average
             * @param {string} userId - User ID
             * @returns {Object} Percentile ranking
             */
            compareToAverage(userId) {
                try {
                    const scoreData = this.calculateEngagementScore(userId);
                    const userScore = scoreData.total;
                    const avgScore = 50; // Assume average is 50

                    return {
                        userId: userId,
                        userScore: userScore,
                        averageScore: avgScore,
                        difference: userScore - avgScore,
                        percentile: Math.round((userScore / 100) * 100),
                        status: userScore > avgScore ? 'above_average' : 'below_average',
                        timestamp: Date.now()
                    };
                } catch (error) {
                    logError(`Failed to compare ${userId}:`, error);
                    return { error: error.message };
                }
            },

            /**
             * Predict lifetime value
             * @param {string} userId - User ID
             * @returns {Object} LTV prediction
             */
            getPredictedLifetimeValue(userId) {
                try {
                    const scoreData = this.calculateEngagementScore(userId);
                    const score = scoreData.total;

                    // Simple LTV model (replace with real model)
                    const baseLTV = 100; // Base value in currency units
                    const ltv = baseLTV * (score / 50); // Scale by engagement

                    return {
                        userId: userId,
                        estimatedLTV: Math.round(ltv),
                        engagementScore: score,
                        churnRiskScore: Math.max(0, 1 - (score / 100)),
                        predictedChurnDate: score < 25 ? Date.now() + (30 * 24 * 60 * 60 * 1000) : null,
                        recommendation: score < 25 ? 're_engagement_needed' : 'stable',
                        timestamp: Date.now()
                    };
                } catch (error) {
                    logError(`Failed to predict LTV for ${userId}:`, error);
                    return { error: error.message };
                }
            },

            /**
             * Set user profile (for testing/data sync)
             * @param {string} userId - User ID
             * @param {Object} profile - User profile data
             */
            setUserProfile(userId, profile) {
                userProfiles.set(userId, profile);
                log(`Set profile for ${userId}`);
            },

            /**
             * Clear cache
             */
            clearCache() {
                scoreCache.clear();
                segmentCache.clear();
                log('Cache cleared');
            },

            /**
             * Get cache stats
             * @returns {Object} Cache statistics
             */
            getCacheStats() {
                return {
                    scoreCacheSize: scoreCache.size,
                    segmentCacheSize: segmentCache.size,
                    historySize: historyData.size,
                    userProfilesSize: userProfiles.size
                };
            }
        };
    })();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.EngagementAnalyzer;
}

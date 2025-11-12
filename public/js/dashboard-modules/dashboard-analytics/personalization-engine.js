/**
 * Personalization Engine Module - Phase 6: Advanced Analytics & User Engagement System
 * 
 * Generates intelligent content recommendations based on user behavior and preferences.
 * Implements hybrid recommendation algorithm combining collaborative and content-based filtering.
 * 
 * @module PersonalizationEngine
 * @version 1.0.0
 * @requires engagement-analyzer.js, cache-manager.js
 * 
 * Features:
 * - Content recommendation generation
 * - Collaborative filtering
 * - Content-based filtering
 * - Hybrid recommendation approach
 * - User preference learning
 * - Content scoring and ranking
 * - Model training with user feedback
 * - Recommendation explanation
 * 
 * @example
 * // Initialize engine
 * PersonalizationEngine.init({
 *   modelType: 'hybrid',
 *   maxRecommendations: 10,
 *   similarityThreshold: 0.5
 * });
 * 
 * // Get recommendations
 * const recommendations = await PersonalizationEngine.getRecommendations(userId, {
 *   context: 'discovery',
 *   limit: 10
 * });
 * 
 * // Train model with feedback
 * PersonalizationEngine.trainModel(userId, {
 *   contentId: 'chat-123',
 *   action: 'clicked',
 *   duration: 300000
 * });
 */

if (typeof window.PersonalizationEngine === 'undefined') {
    window.PersonalizationEngine = (function() {
        'use strict';

        // ==========================================
        // PRIVATE VARIABLES & STATE
        // ==========================================

        /**
         * Configuration object
         * @type {Object}
         */
        let config = {
            modelType: 'hybrid',       // 'collaborative', 'content-based', 'hybrid'
            cacheTTL: 600000,          // 10 minutes
            similarityThreshold: 0.5,  // 0-1 scale
            maxRecommendations: 10,
            minRecommendationScore: 0.3,
            cacheEnabled: true,
            debug: false,
            collaborativeWeight: 0.4,
            contentBasedWeight: 0.4,
            popularityWeight: 0.2
        };

        /**
         * User preference profiles
         * @type {Map<string, Object>}
         */
        let userPreferences = new Map();

        /**
         * Content metadata cache
         * @type {Map<string, Object>}
         */
        let contentMetadata = new Map();

        /**
         * Recommendation cache
         * @type {Map<string, Object>}
         */
        let recommendationCache = new Map();

        /**
         * User similarity matrix
         * @type {Map<string, Map<string, number>>}
         */
        let userSimilarityMatrix = new Map();

        /**
         * Content popularity scores
         * @type {Map<string, number>}
         */
        let contentPopularity = new Map();

        /**
         * User interaction history
         * @type {Map<string, Array<Object>>}
         */
        let interactionHistory = new Map();

        /**
         * Model training data
         * @type {Array<Object>}
         */
        let trainingData = [];

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
                console.log(`[PersonalizationEngine] ${message}`, data || '');
            }
        }

        /**
         * Log error
         * @private
         * @param {string} message - Error message
         * @param {*} error - Optional error
         */
        function logError(message, error) {
            console.error(`[PersonalizationEngine ERROR] ${message}`, error || '');
        }

        /**
         * Get cached recommendations
         * @private
         * @param {string} key - Cache key
         * @returns {*} Cached value or null
         */
        function getCachedRecommendations(key) {
            if (!config.cacheEnabled) return null;

            const cached = recommendationCache.get(key);
            if (!cached) return null;

            const age = Date.now() - cached.timestamp;
            if (age > config.cacheTTL) {
                recommendationCache.delete(key);
                return null;
            }

            return cached.recommendations;
        }

        /**
         * Cache recommendations
         * @private
         * @param {string} key - Cache key
         * @param {Array<Object>} recommendations - Recommendations to cache
         */
        function cacheRecommendations(key, recommendations) {
            if (!config.cacheEnabled) return;

            recommendationCache.set(key, {
                recommendations: recommendations,
                timestamp: Date.now()
            });
        }

        /**
         * Calculate cosine similarity between two vectors
         * @private
         * @param {Array<number>} vec1 - First vector
         * @param {Array<number>} vec2 - Second vector
         * @returns {number} Similarity score (0-1)
         */
        function cosineSimilarity(vec1, vec2) {
            const minLength = Math.min(vec1.length, vec2.length);
            let dotProduct = 0;
            let mag1 = 0;
            let mag2 = 0;

            for (let i = 0; i < minLength; i++) {
                dotProduct += vec1[i] * vec2[i];
                mag1 += vec1[i] * vec1[i];
                mag2 += vec2[i] * vec2[i];
            }

            mag1 = Math.sqrt(mag1);
            mag2 = Math.sqrt(mag2);

            if (mag1 === 0 || mag2 === 0) return 0;
            return dotProduct / (mag1 * mag2);
        }

        /**
         * Calculate content similarity
         * @private
         * @param {Object} content1 - First content
         * @param {Object} content2 - Second content
         * @returns {number} Similarity score
         */
        function calculateContentSimilarity(content1, content2) {
            let similarity = 0;
            let factors = 0;

            // Category similarity
            if (content1.category && content2.category) {
                similarity += content1.category === content2.category ? 1 : 0;
                factors++;
            }

            // Tag overlap
            if (Array.isArray(content1.tags) && Array.isArray(content2.tags)) {
                const overlap = content1.tags.filter(tag => content2.tags.includes(tag)).length;
                const union = new Set([...content1.tags, ...content2.tags]).size;
                similarity += union > 0 ? overlap / union : 0;
                factors++;
            }

            // Rating similarity
            if (content1.rating && content2.rating) {
                const ratingDiff = Math.abs(content1.rating - content2.rating);
                similarity += Math.max(0, 1 - (ratingDiff / 5));
                factors++;
            }

            return factors > 0 ? similarity / factors : 0;
        }

        /**
         * Get user preference vector
         * @private
         * @param {string} userId - User ID
         * @returns {Array<number>} Preference vector
         */
        function getUserPreferenceVector(userId) {
            const prefs = userPreferences.get(userId) || {
                contentTypes: [],
                genres: [],
                interactionStyle: 'all'
            };

            // Convert preferences to feature vector (mock implementation)
            return [
                prefs.contentTypes.length / 10,
                prefs.genres.length / 10,
                prefs.interactionStyle === 'interactive' ? 1 : 0.5
            ];
        }

        /**
         * Get content feature vector
         * @private
         * @param {Object} content - Content object
         * @returns {Array<number>} Feature vector
         */
        function getContentFeatureVector(content) {
            return [
                content.rating ? content.rating / 5 : 0.5,
                content.popularity ? Math.min(1, content.popularity / 1000) : 0.5,
                content.tags ? content.tags.length / 20 : 0.5
            ];
        }

        /**
         * Calculate Jaccard similarity
         * @private
         * @param {Array} set1 - First set
         * @param {Array} set2 - Second set
         * @returns {number} Jaccard similarity (0-1)
         */
        function jaccardSimilarity(set1, set2) {
            const intersection = set1.filter(item => set2.includes(item)).length;
            const union = new Set([...set1, ...set2]).size;
            return union > 0 ? intersection / union : 0;
        }

        /**
         * Get similar users
         * @private
         * @param {string} userId - User ID
         * @param {number} limit - Number of similar users
         * @returns {Array<Object>} Similar users with scores
         */
        function getSimilarUsers(userId, limit = 5) {
            const userPref = userPreferences.get(userId);
            if (!userPref) return [];

            const similarities = [];

            userPreferences.forEach((otherPref, otherUserId) => {
                if (otherUserId === userId) return;

                const similarity = jaccardSimilarity(
                    userPref.contentTypes || [],
                    otherPref.contentTypes || []
                );

                if (similarity > config.similarityThreshold) {
                    similarities.push({
                        userId: otherUserId,
                        score: similarity
                    });
                }
            });

            return similarities
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        }

        /**
         * Score content for user (hybrid approach)
         * @private
         * @param {string} userId - User ID
         * @param {Object} content - Content to score
         * @returns {number} Score (0-1)
         */
        function scoreContentHybrid(userId, content) {
            // Collaborative score
            let collaborativeScore = 0;
            const similarUsers = getSimilarUsers(userId, 5);
            
            similarUsers.forEach(({ userId: simUserId, score: similarity }) => {
                const history = interactionHistory.get(simUserId) || [];
                const interacted = history.some(h => h.contentId === content.id && h.action === 'clicked');
                if (interacted) {
                    collaborativeScore += similarity;
                }
            });

            collaborativeScore = Math.min(1, collaborativeScore / Math.max(1, similarUsers.length));

            // Content-based score
            const userVector = getUserPreferenceVector(userId);
            const contentVector = getContentFeatureVector(content);
            const contentBasedScore = cosineSimilarity(userVector, contentVector);

            // Popularity score
            const popularity = contentPopularity.get(content.id) || 0;
            const popularityScore = Math.min(1, popularity / 1000);

            // Combine scores
            const hybridScore = 
                (collaborativeScore * config.collaborativeWeight) +
                (contentBasedScore * config.contentBasedWeight) +
                (popularityScore * config.popularityWeight);

            return Math.min(1, Math.max(0, hybridScore));
        }

        // ==========================================
        // PUBLIC API
        // ==========================================

        return {
            /**
             * Initialize the personalization engine
             * @param {Object} options - Configuration options
             * @returns {boolean} Success status
             */
            init(options = {}) {
                try {
                    config = { ...config, ...options };
                    log('Personalization engine initialized', config);
                    return true;
                } catch (error) {
                    logError('Initialization failed:', error);
                    return false;
                }
            },

            /**
             * Get personalized recommendations
             * @param {string} userId - User ID
             * @param {Object} options - Recommendation options
             * @returns {Promise<Array<Object>>} Recommendations
             */
            async getRecommendations(userId, options = {}) {
                try {
                    const {
                        context = 'discovery',
                        limit = config.maxRecommendations,
                        excludeIds = [],
                        filters = {}
                    } = options;

                    // Check cache
                    const cacheKey = `${userId}-${context}-${limit}`;
                    const cached = getCachedRecommendations(cacheKey);
                    if (cached) {
                        log(`Retrieved cached recommendations for ${userId}`);
                        return cached;
                    }

                    // Mock content library
                    const contentLibrary = [
                        {
                            id: 'content-1',
                            title: 'Recommended Chat 1',
                            category: 'anime',
                            tags: ['adventure', 'action'],
                            rating: 4.5,
                            popularity: 500
                        },
                        {
                            id: 'content-2',
                            title: 'Recommended Chat 2',
                            category: 'anime',
                            tags: ['romance', 'slice-of-life'],
                            rating: 4.2,
                            popularity: 350
                        },
                        {
                            id: 'content-3',
                            title: 'Recommended Chat 3',
                            category: 'anime',
                            tags: ['comedy', 'adventure'],
                            rating: 4.0,
                            popularity: 280
                        }
                    ];

                    // Score and rank content
                    const scored = contentLibrary
                        .filter(content => !excludeIds.includes(content.id))
                        .map(content => ({
                            ...content,
                            score: scoreContentHybrid(userId, content),
                            reason: 'Based on your preferences and similar users'
                        }))
                        .filter(item => item.score >= config.minRecommendationScore)
                        .sort((a, b) => b.score - a.score)
                        .slice(0, limit);

                    const recommendations = scored.map(item => ({
                        id: item.id,
                        title: item.title,
                        score: Math.round(item.score * 100),
                        reason: item.reason
                    }));

                    // Cache recommendations
                    cacheRecommendations(cacheKey, recommendations);

                    log(`Generated ${recommendations.length} recommendations for ${userId}`);
                    return recommendations;
                } catch (error) {
                    logError(`Failed to get recommendations for ${userId}:`, error);
                    return [];
                }
            },

            /**
             * Update user preferences
             * @param {string} userId - User ID
             * @param {Object} preferences - User preferences
             */
            updateUserPreferences(userId, preferences) {
                try {
                    const existing = userPreferences.get(userId) || {};
                    userPreferences.set(userId, {
                        ...existing,
                        ...preferences,
                        updatedAt: Date.now()
                    });

                    log(`Updated preferences for ${userId}`);
                } catch (error) {
                    logError(`Failed to update preferences for ${userId}:`, error);
                }
            },

            /**
             * Get user preferences
             * @param {string} userId - User ID
             * @returns {Object} User preferences
             */
            getUserPreferences(userId) {
                return userPreferences.get(userId) || {
                    contentTypes: [],
                    genres: [],
                    interactionStyle: 'all'
                };
            },

            /**
             * Score content for user
             * @param {string} contentId - Content ID
             * @param {Object} userProfile - User profile
             * @returns {number} Score (0-100)
             */
            scoreContent(contentId, userProfile) {
                try {
                    const content = contentMetadata.get(contentId) || {
                        id: contentId,
                        rating: 3.5,
                        popularity: 100
                    };

                    // Create mock user ID
                    const userId = userProfile.userId || 'unknown';
                    const score = scoreContentHybrid(userId, content);

                    return Math.round(score * 100);
                } catch (error) {
                    logError(`Failed to score content ${contentId}:`, error);
                    return 0;
                }
            },

            /**
             * Get content similarity
             * @param {string} contentId1 - First content ID
             * @param {string} contentId2 - Second content ID
             * @returns {number} Similarity (0-1)
             */
            getContentSimilarity(contentId1, contentId2) {
                try {
                    const content1 = contentMetadata.get(contentId1) || {};
                    const content2 = contentMetadata.get(contentId2) || {};

                    return calculateContentSimilarity(content1, content2);
                } catch (error) {
                    logError(`Failed to calculate similarity:`, error);
                    return 0;
                }
            },

            /**
             * Get personalized order for content list
             * @param {Array<Object>} contentList - List of content
             * @param {string} userId - User ID
             * @param {Object} criteria - Ordering criteria
             * @returns {Array<Object>} Reordered content
             */
            getPersonalizedOrder(contentList, userId, criteria = {}) {
                try {
                    return contentList
                        .map(content => ({
                            ...content,
                            personalScore: scoreContentHybrid(userId, content)
                        }))
                        .sort((a, b) => b.personalScore - a.personalScore)
                        .map(({ personalScore, ...content }) => content);
                } catch (error) {
                    logError(`Failed to get personalized order:`, error);
                    return contentList;
                }
            },

            /**
             * Train model with feedback
             * @param {string} userId - User ID
             * @param {Object} feedback - Feedback data
             */
            trainModel(userId, feedback) {
                try {
                    trainingData.push({
                        userId: userId,
                        ...feedback,
                        timestamp: Date.now()
                    });

                    // Track interaction
                    if (!interactionHistory.has(userId)) {
                        interactionHistory.set(userId, []);
                    }

                    interactionHistory.get(userId).push({
                        contentId: feedback.contentId,
                        action: feedback.action || 'viewed',
                        duration: feedback.duration || 0,
                        timestamp: Date.now()
                    });

                    log(`Trained model with feedback from ${userId}`);
                } catch (error) {
                    logError(`Failed to train model:`, error);
                }
            },

            /**
             * Explain recommendation
             * @param {string} contentId - Content ID
             * @param {string} userId - User ID
             * @returns {Object} Recommendation explanation
             */
            explainRecommendation(contentId, userId) {
                try {
                    const content = contentMetadata.get(contentId);
                    const prefs = this.getUserPreferences(userId);
                    const similarity = getSimilarUsers(userId, 5);

                    return {
                        contentId: contentId,
                        userId: userId,
                        reasons: [
                            'Matches your preferred content types',
                            'Popular among similar users',
                            'Highly rated by community'
                        ],
                        similarUsers: similarity.length,
                        confidence: Math.round(scoreContentHybrid(userId, content || {}) * 100),
                        timestamp: Date.now()
                    };
                } catch (error) {
                    logError(`Failed to explain recommendation:`, error);
                    return { error: error.message };
                }
            },

            /**
             * Get training data size
             * @returns {number} Training data size
             */
            getTrainingDataSize() {
                return trainingData.length;
            },

            /**
             * Clear cache
             */
            clearCache() {
                recommendationCache.clear();
                log('Recommendation cache cleared');
            },

            /**
             * Get cache stats
             * @returns {Object} Cache statistics
             */
            getCacheStats() {
                return {
                    recommendationCacheSize: recommendationCache.size,
                    userPreferencesSize: userPreferences.size,
                    contentMetadataSize: contentMetadata.size,
                    interactionHistorySize: interactionHistory.size,
                    trainingDataSize: trainingData.length
                };
            },

            /**
             * Set content metadata
             * @param {string} contentId - Content ID
             * @param {Object} metadata - Content metadata
             */
            setContentMetadata(contentId, metadata) {
                contentMetadata.set(contentId, metadata);
            },

            /**
             * Update content popularity
             * @param {string} contentId - Content ID
             * @param {number} popularity - Popularity score
             */
            updateContentPopularity(contentId, popularity) {
                contentPopularity.set(contentId, popularity);
            }
        };
    })();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.PersonalizationEngine;
}

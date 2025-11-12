/**
 * Engagement UI Module - Phase 6: Advanced Analytics & User Engagement System
 * 
 * Provides UI components for displaying engagement metrics, recommendations, and user analytics.
 * Integrates with engagement analyzer and personalization engine for data visualization.
 * 
 * @module EngagementUI
 * @version 1.0.0
 * @requires engagement-analyzer.js, personalization-engine.js
 * 
 * Features:
 * - Engagement score badges and displays
 * - Engagement metrics charts
 * - Recommendation cards and carousels
 * - User segment badges
 * - Trend indicators
 * - Interactive components
 * - Responsive design
 * - Theme support
 * 
 * @example
 * // Render engagement badge
 * EngagementUI.renderEngagementBadge(userId, 'badge-container');
 * 
 * // Render recommendations
 * const recommendations = [
 *   { id: '1', title: 'Chat 1', score: 85 },
 *   { id: '2', title: 'Chat 2', score: 72 }
 * ];
 * EngagementUI.renderRecommendationCarousel(recommendations, 'carousel-container');
 * 
 * // Display trend
 * EngagementUI.renderTrendIndicator(userId, 'trend-container');
 */

if (typeof window.EngagementUI === 'undefined') {
    window.EngagementUI = (function() {
        'use strict';

        // ==========================================
        // PRIVATE VARIABLES & STATE
        // ==========================================

        /**
         * Configuration object
         * @type {Object}
         */
        let config = {
            theme: 'light',        // 'light' or 'dark'
            animationEnabled: true,
            showTooltips: true,
            compactMode: false,
            debug: false
        };

        /**
         * Component instances
         * @type {Map<string, Object>}
         */
        let componentInstances = new Map();

        /**
         * CSS classes
         * @type {Object}
         */
        const cssClasses = {
            badge: 'engagement-badge',
            badgeScore: 'engagement-badge__score',
            badgeLabel: 'engagement-badge__label',
            card: 'engagement-card',
            cardTitle: 'engagement-card__title',
            cardScore: 'engagement-card__score',
            carousel: 'engagement-carousel',
            carouselItem: 'engagement-carousel__item',
            button: 'engagement-btn',
            buttonPrimary: 'engagement-btn--primary',
            buttonSecondary: 'engagement-btn--secondary',
            trend: 'engagement-trend',
            trendUp: 'engagement-trend--up',
            trendDown: 'engagement-trend--down',
            trendStable: 'engagement-trend--stable',
            segment: 'engagement-segment',
            tooltip: 'engagement-tooltip'
        };

        /**
         * Color schemes
         * @type {Object}
         */
        const colorSchemes = {
            score: {
                excellent: '#28a745',  // Green
                good: '#17a2b8',       // Blue
                fair: '#ffc107',       // Yellow
                poor: '#dc3545'        // Red
            },
            segment: {
                'power-user': '#667bc6',   // Purple
                'active': '#17a2b8',       // Blue
                'casual': '#ffc107',       // Yellow
                'dormant': '#6c757d'       // Gray
            }
        };

        // ==========================================
        // PRIVATE UTILITY FUNCTIONS
        // ==========================================

        /**
         * Log debug message
         * @private
         * @param {string} message - Message
         * @param {*} data - Optional data
         */
        function log(message, data) {
            if (config.debug) {
                console.log(`[EngagementUI] ${message}`, data || '');
            }
        }

        /**
         * Log error
         * @private
         * @param {string} message - Message
         * @param {*} error - Optional error
         */
        function logError(message, error) {
            console.error(`[EngagementUI ERROR] ${message}`, error || '');
        }

        /**
         * Get color for score
         * @private
         * @param {number} score - Score (0-100)
         * @returns {string} Color code
         */
        function getScoreColor(score) {
            if (score >= 75) return colorSchemes.score.excellent;
            if (score >= 50) return colorSchemes.score.good;
            if (score >= 25) return colorSchemes.score.fair;
            return colorSchemes.score.poor;
        }

        /**
         * Get color for segment
         * @private
         * @param {string} segment - Segment name
         * @returns {string} Color code
         */
        function getSegmentColor(segment) {
            return colorSchemes.segment[segment] || '#6c757d';
        }

        /**
         * Create HTML element
         * @private
         * @param {string} tag - HTML tag
         * @param {string} className - CSS class
         * @param {string} innerHTML - Inner HTML
         * @returns {HTMLElement} Element
         */
        function createElement(tag, className, innerHTML = '') {
            const el = document.createElement(tag);
            if (className) el.className = className;
            if (innerHTML) el.innerHTML = innerHTML;
            return el;
        }

        /**
         * Format percentage value
         * @private
         * @param {number} value - Value
         * @returns {string} Formatted value
         */
        function formatPercentage(value) {
            return Math.round(value) + '%';
        }

        /**
         * Format large numbers
         * @private
         * @param {number} num - Number
         * @returns {string} Formatted number
         */
        function formatNumber(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toString();
        }

        /**
         * Add tooltip
         * @private
         * @param {HTMLElement} element - Element
         * @param {string} text - Tooltip text
         */
        function addTooltip(element, text) {
            if (!config.showTooltips) return;
            element.title = text;
            element.classList.add(cssClasses.tooltip);
        }

        /**
         * Get engagement analyzer
         * @private
         * @returns {Object} EngagementAnalyzer instance
         */
        function getEngagementAnalyzer() {
            if (typeof window.EngagementAnalyzer === 'undefined') {
                logError('EngagementAnalyzer not available');
                return null;
            }
            return window.EngagementAnalyzer;
        }

        /**
         * Get personalization engine
         * @private
         * @returns {Object} PersonalizationEngine instance
         */
        function getPersonalizationEngine() {
            if (typeof window.PersonalizationEngine === 'undefined') {
                logError('PersonalizationEngine not available');
                return null;
            }
            return window.PersonalizationEngine;
        }

        // ==========================================
        // PUBLIC API
        // ==========================================

        return {
            /**
             * Initialize engagement UI
             * @param {Object} options - Configuration options
             */
            init(options = {}) {
                try {
                    config = { ...config, ...options };
                    log('Engagement UI initialized', config);
                    return true;
                } catch (error) {
                    logError('Initialization failed:', error);
                    return false;
                }
            },

            /**
             * Render engagement badge
             * @param {string} userId - User ID
             * @param {string} containerId - Container ID
             * @returns {HTMLElement|null} Badge element
             */
            renderEngagementBadge(userId, containerId) {
                try {
                    const container = document.getElementById(containerId);
                    if (!container) {
                        logError(`Container not found: ${containerId}`);
                        return null;
                    }

                    const analyzer = getEngagementAnalyzer();
                    if (!analyzer) return null;

                    const scoreData = analyzer.calculateEngagementScore(userId);
                    const score = scoreData.total;
                    const color = getScoreColor(score);

                    const badge = createElement('div', cssClasses.badge);
                    badge.style.borderColor = color;

                    const scoreEl = createElement('div', cssClasses.badgeScore);
                    scoreEl.textContent = formatPercentage(score);
                    scoreEl.style.color = color;

                    const labelEl = createElement('div', cssClasses.badgeLabel);
                    labelEl.textContent = 'Engagement';

                    badge.appendChild(scoreEl);
                    badge.appendChild(labelEl);

                    container.appendChild(badge);
                    componentInstances.set(`${containerId}-badge`, badge);

                    addTooltip(badge, `User engagement score: ${score}/100`);
                    log(`Rendered engagement badge for ${userId}`);

                    return badge;
                } catch (error) {
                    logError(`Failed to render engagement badge:`, error);
                    return null;
                }
            },

            /**
             * Render engagement chart
             * @param {string} userId - User ID
             * @param {string} containerId - Container ID
             * @returns {HTMLElement|null} Chart element
             */
            renderEngagementChart(userId, containerId) {
                try {
                    const container = document.getElementById(containerId);
                    if (!container) return null;

                    const analyzer = getEngagementAnalyzer();
                    if (!analyzer) return null;

                    const breakdown = analyzer.getEngagementBreakdown(userId);

                    const chart = createElement('div', 'engagement-breakdown-chart');
                    let html = '<div class="engagement-breakdown">';

                    Object.entries(breakdown).forEach(([key, value]) => {
                        if (key !== 'userId' && key !== 'weights' && key !== 'timestamp' && key !== 'total') {
                            const percentage = Math.round(value);
                            const color = getScoreColor(percentage);

                            html += `
                                <div class="breakdown-item">
                                    <label>${key}</label>
                                    <div class="progress" style="height: 20px;">
                                        <div class="progress-bar" style="width: ${percentage}%; background-color: ${color};">
                                            ${percentage}%
                                        </div>
                                    </div>
                                </div>
                            `;
                        }
                    });

                    html += '</div>';
                    chart.innerHTML = html;
                    container.appendChild(chart);

                    log(`Rendered engagement chart for ${userId}`);
                    return chart;
                } catch (error) {
                    logError(`Failed to render engagement chart:`, error);
                    return null;
                }
            },

            /**
             * Render recommendation card
             * @param {Object} recommendation - Recommendation object
             * @param {string} containerId - Container ID
             * @returns {HTMLElement|null} Card element
             */
            renderRecommendationCard(recommendation, containerId) {
                try {
                    const container = document.getElementById(containerId);
                    if (!container) return null;

                    const card = createElement('div', cssClasses.card);
                    const score = recommendation.score || 0;
                    const color = getScoreColor(score);

                    let html = `
                        <div class="${cssClasses.cardTitle}">${recommendation.title || 'Untitled'}</div>
                        <div class="${cssClasses.cardScore}" style="color: ${color};">${formatPercentage(score)}</div>
                    `;

                    if (recommendation.reason) {
                        html += `<div class="card-reason" style="font-size: 0.85em; color: #6c757d; margin-top: 0.5em;">${recommendation.reason}</div>`;
                    }

                    card.innerHTML = html;
                    container.appendChild(card);

                    addTooltip(card, `Recommendation score: ${score}`);
                    log(`Rendered recommendation card`);

                    return card;
                } catch (error) {
                    logError(`Failed to render recommendation card:`, error);
                    return null;
                }
            },

            /**
             * Render recommendation carousel
             * @param {Array<Object>} recommendations - Array of recommendations
             * @param {string} containerId - Container ID
             * @returns {HTMLElement|null} Carousel element
             */
            renderRecommendationCarousel(recommendations, containerId) {
                try {
                    const container = document.getElementById(containerId);
                    if (!container) return null;

                    const carousel = createElement('div', cssClasses.carousel);

                    if (!Array.isArray(recommendations) || recommendations.length === 0) {
                        carousel.innerHTML = '<p style="padding: 1em; text-align: center; color: #6c757d;">No recommendations available</p>';
                        container.appendChild(carousel);
                        return carousel;
                    }

                    let html = '<div class="carousel-inner">';

                    recommendations.slice(0, 5).forEach((rec, index) => {
                        const score = rec.score || 0;
                        const color = getScoreColor(score);

                        html += `
                            <div class="${cssClasses.carouselItem} ${index === 0 ? 'active' : ''}" style="border-left: 3px solid ${color}; padding: 0.75em;">
                                <div style="font-weight: 600; margin-bottom: 0.25em;">${rec.title}</div>
                                <div style="color: ${color}; font-size: 0.9em;">${formatPercentage(score)}</div>
                                ${rec.reason ? `<div style="font-size: 0.8em; color: #6c757d; margin-top: 0.25em;">${rec.reason}</div>` : ''}
                            </div>
                        `;
                    });

                    html += '</div>';
                    carousel.innerHTML = html;
                    container.appendChild(carousel);

                    log(`Rendered recommendation carousel with ${recommendations.length} items`);
                    return carousel;
                } catch (error) {
                    logError(`Failed to render recommendation carousel:`, error);
                    return null;
                }
            },

            /**
             * Render user segment badge
             * @param {string} userId - User ID
             * @param {string} containerId - Container ID
             * @returns {HTMLElement|null} Badge element
             */
            renderUserSegmentBadge(userId, containerId) {
                try {
                    const container = document.getElementById(containerId);
                    if (!container) return null;

                    const analyzer = getEngagementAnalyzer();
                    if (!analyzer) return null;

                    const segment = analyzer.identifyUserSegment(userId);
                    const color = getSegmentColor(segment.segment);

                    const badge = createElement('span', cssClasses.segment);
                    badge.style.backgroundColor = color;
                    badge.style.color = 'white';
                    badge.style.padding = '0.25em 0.75em';
                    badge.style.borderRadius = '1em';
                    badge.style.fontSize = '0.85em';
                    badge.style.fontWeight = '600';
                    badge.textContent = segment.segment.replace('-', ' ').toUpperCase();

                    container.appendChild(badge);

                    addTooltip(badge, `User segment: ${segment.segment} (Confidence: ${Math.round(segment.confidence * 100)}%)`);
                    log(`Rendered segment badge: ${segment.segment}`);

                    return badge;
                } catch (error) {
                    logError(`Failed to render segment badge:`, error);
                    return null;
                }
            },

            /**
             * Render engagement breakdown
             * @param {string} userId - User ID
             * @param {string} containerId - Container ID
             * @returns {HTMLElement|null} Breakdown element
             */
            renderEngagementBreakdown(userId, containerId) {
                try {
                    const container = document.getElementById(containerId);
                    if (!container) return null;

                    return this.renderEngagementChart(userId, containerId);
                } catch (error) {
                    logError(`Failed to render breakdown:`, error);
                    return null;
                }
            },

            /**
             * Render trend indicator
             * @param {string} userId - User ID
             * @param {string} containerId - Container ID
             * @returns {HTMLElement|null} Trend element
             */
            renderTrendIndicator(userId, containerId) {
                try {
                    const container = document.getElementById(containerId);
                    if (!container) return null;

                    const analyzer = getEngagementAnalyzer();
                    if (!analyzer) return null;

                    const trends = analyzer.getEngagementTrends(userId);

                    const indicator = createElement('div', cssClasses.trend);

                    let trendClass = cssClasses.trendStable;
                    let trendIcon = '→';
                    let trendText = 'Stable';

                    if (trends.trend === 'improving') {
                        trendClass = cssClasses.trendUp;
                        trendIcon = '↑';
                        trendText = 'Improving';
                    } else if (trends.trend === 'declining') {
                        trendClass = cssClasses.trendDown;
                        trendIcon = '↓';
                        trendText = 'Declining';
                    }

                    indicator.className = `${cssClasses.trend} ${trendClass}`;
                    indicator.innerHTML = `
                        <span style="font-size: 1.2em; margin-right: 0.5em;">${trendIcon}</span>
                        <span>${trendText}</span>
                        ${trends.changePercentage !== 0 ? `<span style="margin-left: 0.5em; font-weight: 600;">${Math.abs(trends.changePercentage)}%</span>` : ''}
                    `;

                    container.appendChild(indicator);

                    addTooltip(indicator, `Engagement trend: ${trendText} (${trends.changePercentage > 0 ? '+' : ''}${trends.changePercentage}%)`);
                    log(`Rendered trend indicator: ${trends.trend}`);

                    return indicator;
                } catch (error) {
                    logError(`Failed to render trend indicator:`, error);
                    return null;
                }
            },

            /**
             * Update engagement badge
             * @param {string} userId - User ID
             * @param {string} containerId - Container ID
             */
            updateEngagementBadge(userId, containerId) {
                try {
                    const container = document.getElementById(containerId);
                    if (!container) return;

                    container.innerHTML = '';
                    this.renderEngagementBadge(userId, containerId);
                    log(`Updated engagement badge for ${userId}`);
                } catch (error) {
                    logError(`Failed to update engagement badge:`, error);
                }
            },

            /**
             * Toggle detailed view
             * @param {string} containerId - Container ID
             */
            toggleDetailedView(containerId) {
                try {
                    const container = document.getElementById(containerId);
                    if (!container) return;

                    const detailed = container.querySelector('.detailed-view');
                    if (detailed) {
                        detailed.style.display = detailed.style.display === 'none' ? 'block' : 'none';
                    }
                } catch (error) {
                    logError(`Failed to toggle detailed view:`, error);
                }
            },

            /**
             * Get component instance
             * @param {string} id - Component ID
             * @returns {Object|null} Component instance
             */
            getComponentInstance(id) {
                return componentInstances.get(id) || null;
            },

            /**
             * Clear all components
             */
            clearAllComponents() {
                componentInstances.forEach(component => {
                    if (component && component.remove) {
                        component.remove();
                    }
                });
                componentInstances.clear();
                log('All components cleared');
            },

            /**
             * Get UI state
             * @returns {Object} Current state
             */
            getUIState() {
                return {
                    theme: config.theme,
                    componentCount: componentInstances.size,
                    animationEnabled: config.animationEnabled
                };
            }
        };
    })();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.EngagementUI;
}

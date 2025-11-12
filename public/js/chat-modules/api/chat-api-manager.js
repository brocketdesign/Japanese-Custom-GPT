/**
 * chat-api-manager.js
 * Central API coordination and error handling
 * Provides a unified interface for all API calls with retry logic and error handling
 * 
 * @version 1.0.0
 * @date November 12, 2025
 * @module ChatAPI
 */

(function(window) {
    'use strict';

    /**
     * ChatAPI - Central API manager for all HTTP requests
     * Handles request/response formatting, error handling, and retries
     */
    const ChatAPI = {
        // Configuration
        config: {
            baseUrl: window.API_URL || '/api',
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000
        },

        // Request cache for duplicate prevention
        requestCache: new Map(),

        // Active requests tracking
        activeRequests: new Map(),

        /**
         * Make an API request with error handling and retries
         * @param {string} method - HTTP method (GET, POST, PUT, DELETE, PATCH)
         * @param {string} endpoint - API endpoint path
         * @param {Object} data - Request data/payload
         * @param {Object} options - Additional options (headers, timeout, retries, etc.)
         * @returns {Promise} Response data
         */
        makeRequest: function(method, endpoint, data, options = {}) {
            const finalOptions = Object.assign({
                timeout: this.config.timeout,
                retries: this.config.retryAttempts,
                useCache: false,
                cacheKey: null
            }, options);

            // Generate cache key if needed
            if (finalOptions.useCache) {
                finalOptions.cacheKey = finalOptions.cacheKey || `${method}:${endpoint}`;
                const cached = this.requestCache.get(finalOptions.cacheKey);
                if (cached && (Date.now() - cached.timestamp < 60000)) {
                    console.log(`[ChatAPI] Cache hit for ${finalOptions.cacheKey}`);
                    return Promise.resolve(cached.data);
                }
            }

            // Check for duplicate in-flight requests
            const requestKey = `${method}:${endpoint}:${JSON.stringify(data)}`;
            if (this.activeRequests.has(requestKey)) {
                console.log(`[ChatAPI] Duplicate request detected, returning existing promise for ${requestKey}`);
                return this.activeRequests.get(requestKey);
            }

            // Make the actual request
            const requestPromise = this._executeRequest(method, endpoint, data, finalOptions);
            
            // Track active request
            this.activeRequests.set(requestKey, requestPromise);
            
            // Clean up on completion
            requestPromise.finally(() => {
                this.activeRequests.delete(requestKey);
            });

            return requestPromise;
        },

        /**
         * Execute the actual HTTP request with retry logic
         * @private
         */
        _executeRequest: function(method, endpoint, data, options, attempt = 0) {
            const url = `${this.config.baseUrl}${endpoint}`;
            
            const fetchOptions = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                timeout: options.timeout
            };

            // Add request body for non-GET requests
            if (method !== 'GET' && data) {
                fetchOptions.body = JSON.stringify(data);
            }

            console.log(`[ChatAPI] ${method} ${endpoint}`, data || '');

            return fetch(url, fetchOptions)
                .then(response => {
                    if (!response.ok) {
                        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                        error.status = response.status;
                        error.response = response;
                        throw error;
                    }
                    
                    // Parse response based on content type
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        return response.json();
                    }
                    return response.text();
                })
                .then(responseData => {
                    console.log(`[ChatAPI] Response success for ${method} ${endpoint}`, responseData);
                    
                    // Cache the result if requested
                    if (options.cacheKey) {
                        this.requestCache.set(options.cacheKey, {
                            data: responseData,
                            timestamp: Date.now()
                        });
                    }
                    
                    return responseData;
                })
                .catch(error => {
                    // Determine if error is retryable
                    const isRetryable = this._isRetryableError(error);
                    const hasRetries = attempt < options.retries;

                    console.error(`[ChatAPI] Error on attempt ${attempt + 1}/${options.retries + 1}:`, error.message);

                    if (isRetryable && hasRetries) {
                        const delayMs = options.retryDelay * Math.pow(2, attempt);
                        console.log(`[ChatAPI] Retrying in ${delayMs}ms...`);
                        
                        return new Promise(resolve => setTimeout(resolve, delayMs))
                            .then(() => this._executeRequest(method, endpoint, data, options, attempt + 1));
                    }

                    // Handle error and re-throw
                    return this.handleApiError(error, endpoint);
                });
        },

        /**
         * Determine if an error is retryable
         * @private
         */
        _isRetryableError: function(error) {
            // Retry on network errors
            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                return true;
            }

            // Retry on 5xx server errors
            if (error.status >= 500 && error.status < 600) {
                return true;
            }

            // Retry on timeout (408)
            if (error.status === 408) {
                return true;
            }

            // Retry on rate limit (429)
            if (error.status === 429) {
                return true;
            }

            return false;
        },

        /**
         * Handle API errors with user-friendly messages
         * @param {Error} error - The error that occurred
         * @param {string} endpoint - The endpoint that failed
         * @throws {Error} The formatted error
         */
        handleApiError: function(error, endpoint) {
            let userMessage = 'An error occurred. Please try again.';
            let errorType = 'unknown';

            if (error instanceof TypeError) {
                errorType = 'network';
                userMessage = 'Network error. Please check your internet connection.';
            } else if (error.status === 401) {
                errorType = 'auth';
                userMessage = 'Your session has expired. Please log in again.';
                // Trigger logout/redirect to login
                if (window.handleAuthError) {
                    window.handleAuthError();
                }
            } else if (error.status === 403) {
                errorType = 'permission';
                userMessage = 'You do not have permission to access this resource.';
            } else if (error.status === 404) {
                errorType = 'notfound';
                userMessage = 'The requested resource was not found.';
            } else if (error.status === 429) {
                errorType = 'ratelimit';
                userMessage = 'Too many requests. Please wait a moment and try again.';
            } else if (error.status >= 500) {
                errorType = 'server';
                userMessage = 'Server error. Please try again later.';
            }

            const formattedError = new Error(userMessage);
            formattedError.type = errorType;
            formattedError.status = error.status;
            formattedError.endpoint = endpoint;
            formattedError.originalError = error;

            console.error(`[ChatAPI] ${errorType.toUpperCase()} Error on ${endpoint}:`, formattedError.message);

            throw formattedError;
        },

        /**
         * Clear the request cache
         */
        clearCache: function() {
            this.requestCache.clear();
            console.log('[ChatAPI] Request cache cleared');
        },

        /**
         * Get cache statistics
         * @returns {Object} Cache statistics
         */
        getCacheStats: function() {
            return {
                size: this.requestCache.size,
                activeRequests: this.activeRequests.size,
                items: Array.from(this.requestCache.entries()).map(([key, value]) => ({
                    key: key,
                    age: Date.now() - value.timestamp
                }))
            };
        },

        /**
         * Abort all active requests
         */
        abortAllRequests: function() {
            console.log(`[ChatAPI] Aborting ${this.activeRequests.size} active requests`);
            this.activeRequests.clear();
        }
    };

    // Export to global scope
    window.ChatAPI = ChatAPI;

    console.log('[ChatAPI] Module loaded successfully');

})(window);

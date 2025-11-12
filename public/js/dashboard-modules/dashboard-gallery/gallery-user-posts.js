/**
 * User Posts Gallery Module
 * 
 * Handles user-generated posts gallery rendering, loading, and management.
 * Part of the Phase 2 gallery system refactoring.
 * 
 * @author Dashboard Refactor Phase 2
 * @date November 12, 2025
 */

'use strict';

if (typeof UserPostsGallery === 'undefined') {
    window.UserPostsGallery = (() => {
        // Internal state
        let currentUserId = null;
        let currentPage = 1;
        let totalPages = 1;
        let isLoading = false;
        let galleryType = 'posts';

        /**
         * Load user posts from server
         * 
         * @param {string} userId - User ID
         * @param {number} page - Page number
         * @param {boolean} reload - Force reload from server
         * @returns {Promise<Object>} User posts data
         */
        const load = async (userId, page = 1, reload = false) => {
            try {
                console.log('[UserPostsGallery] Loading user posts for:', userId, 'page:', page);

                // Update state
                if (typeof DashboardState !== 'undefined') {
                    DashboardState.setState('gallery.userPosts.loading', true);
                }
                isLoading = true;
                currentUserId = userId;

                // Check cache first if not reloading
                if (!reload && typeof CacheManager !== 'undefined') {
                    const cached = CacheManager.get(`gallery-user-posts-${userId}-page-${page}`);
                    if (cached) {
                        console.debug('[UserPostsGallery] Using cached data for user:', userId, 'page:', page);
                        currentPage = page;
                        return cached;
                    }
                }

                // Fetch from server
                const response = await fetch(`/api/users/${userId}/posts?page=${page}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();

                // Update state
                currentPage = page;
                totalPages = data.totalPages || 1;

                // Cache results
                if (typeof CacheManager !== 'undefined') {
                    CacheManager.set(
                        `gallery-user-posts-${userId}-page-${page}`,
                        data,
                        { ttl: 1800000 } // 30 minutes
                    );
                }

                // Update dashboard state
                if (typeof DashboardState !== 'undefined') {
                    DashboardState.setState('gallery.userPosts.page', page);
                    DashboardState.setState('gallery.userPosts.totalPages', totalPages);
                    DashboardState.setState('gallery.userPosts.loading', false);
                }

                isLoading = false;
                console.log('[UserPostsGallery] Loaded', data.data?.length || 0, 'posts');

                return data;
            } catch (error) {
                console.error('[UserPostsGallery] Load error:', error);
                isLoading = false;

                if (typeof DashboardState !== 'undefined') {
                    DashboardState.setState('gallery.userPosts.loading', false);
                }

                return { data: [], totalPages: 0, error: error.message };
            }
        };

        /**
         * Display user posts in gallery
         * 
         * @param {Array} posts - Post data array
         * @param {string} containerId - Target container ID
         */
        const display = (posts = [], containerId = '#user-posts-gallery') => {
            try {
                console.log('[UserPostsGallery] Displaying', posts.length, 'posts');

                const container = document.querySelector(containerId);
                if (!container) {
                    console.warn('[UserPostsGallery] Container not found:', containerId);
                    return;
                }

                // Clear previous content
                container.innerHTML = '';

                if (!posts || posts.length === 0) {
                    container.innerHTML = '<div class="empty-state">No posts found</div>';
                    return;
                }

                const isAdmin = window.user?.isAdmin || false;
                const isTemporary = window.user?.isTemporary || false;
                const currentUserId = window.user?._id;

                // Generate HTML for all posts
                const html = posts.map((post, index) => {
                    const isLiked = post.likedByMe || (post.likes && post.likes.includes(currentUserId));
                    const isNSFW = post.nsfw;

                    return generatePostCard(post, isNSFW, isLiked, isAdmin, isTemporary, index);
                }).join('');

                container.innerHTML = html;

                // Apply lazy loading
                GalleryRendererBase.applyLazyLoading(container);

                // Setup click handlers
                setupClickHandlers(posts, container);

                // Trigger event
                if (typeof DashboardEventManager !== 'undefined') {
                    DashboardEventManager.broadcast('userPostsDisplayed', { count: posts.length });
                }

                console.debug('[UserPostsGallery] Display complete');
            } catch (error) {
                console.error('[UserPostsGallery] Display error:', error);
            }
        };

        /**
         * Generate HTML for a single post card
         * 
         * @param {Object} post - Post data
         * @param {boolean} isNSFW - Whether post is NSFW
         * @param {boolean} isLiked - Whether user has liked this post
         * @param {boolean} isAdmin - Whether user is admin
         * @param {boolean} isTemporary - Whether user is temporary
         * @param {number} index - Post index
         * @returns {string} HTML
         */
        const generatePostCard = (post, isNSFW, isLiked, isAdmin, isTemporary, index) => {
            try {
                const placeholder = '/img/nsfw-blurred-2.png';
                const postId = post._id || post.id;
                const imageSrc = isNSFW ? placeholder : (post.image || post.thumbnail);
                const isPublic = post.visibility === 'public';

                return `
                    <div class="post-card" data-index="${index}" data-post-id="${postId}">
                        <div class="post-wrapper">
                            <img 
                                class="post-image lazy-load"
                                src="${placeholder}"
                                data-src="${imageSrc}"
                                alt="${post.title || 'Post'}"
                                loading="lazy"
                            />
                            ${isNSFW ? GalleryRendererBase.generateNSFWOverlay(true, post.userId) : ''}
                            <div class="post-overlay">
                                <div class="post-actions">
                                    ${!isTemporary ? `
                                        <button 
                                            class="btn-icon favorite-btn ${isLiked ? 'liked' : ''}"
                                            onclick="window.togglePostFavorite(this)"
                                            data-post-id="${postId}"
                                            title="${isLiked ? 'Unlike' : 'Like'}"
                                        >
                                            <i class="fas fa-heart"></i>
                                            <span class="count">${post.likes || 0}</span>
                                        </button>
                                    ` : ''}
                                    ${isAdmin || (window.user && window.user._id === post.userId) ? `
                                        <button 
                                            class="btn-icon visibility-btn"
                                            onclick="window.togglePostVisibility(this)"
                                            data-post-id="${postId}"
                                            title="${isPublic ? 'Make Private' : 'Make Public'}"
                                        >
                                            <i class="fas fa-${isPublic ? 'globe' : 'lock'}"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="post-info">
                            <h4>${post.title || 'Untitled Post'}</h4>
                            ${post.description ? `<p class="post-description">${post.description.substring(0, 100)}...</p>` : ''}
                            <div class="post-meta">
                                <span class="meta-user">By ${post.userName || 'Unknown'}</span>
                                ${post.created_at ? `
                                    <span class="meta-date">${new Date(post.created_at).toLocaleDateString()}</span>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('[UserPostsGallery] Post card generation error:', error);
                return '';
            }
        };

        /**
         * Setup click handlers for post cards
         * 
         * @param {Array} posts - Post data
         * @param {HTMLElement} container - Gallery container
         */
        const setupClickHandlers = (posts, container) => {
            try {
                const cards = container.querySelectorAll('.post-card');

                cards.forEach((card, index) => {
                    // Only allow clicks on the main image area
                    const image = card.querySelector('.post-image');
                    if (image) {
                        image.style.cursor = 'pointer';
                        image.addEventListener('click', () => {
                            const post = posts[index];
                            if (post) {
                                handlePostClick(post);
                            }
                        });
                    }
                });
            } catch (error) {
                console.error('[UserPostsGallery] Setup click handlers error:', error);
            }
        };

        /**
         * Handle post card click
         * 
         * @param {Object} post - Post data
         */
        const handlePostClick = (post) => {
            try {
                console.log('[UserPostsGallery] Post selected:', post._id);

                // Trigger event
                if (typeof DashboardEventManager !== 'undefined') {
                    DashboardEventManager.broadcast('postSelected', { post });
                }
            } catch (error) {
                console.error('[UserPostsGallery] Post click handler error:', error);
            }
        };

        /**
         * Toggle favorite/like status
         * 
         * @param {string} postId - Post ID
         * @param {boolean} liked - New like status
         * @returns {Promise<boolean>} Success
         */
        const toggleFavorite = async (postId, liked) => {
            try {
                console.log('[UserPostsGallery] Toggling favorite for post:', postId);

                const response = await fetch(`/api/posts/${postId}/like`, {
                    method: liked ? 'POST' : 'DELETE'
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                // Invalidate cache
                if (typeof CacheManager !== 'undefined' && currentUserId) {
                    CacheManager.delete(`gallery-user-posts-${currentUserId}-page-${currentPage}`);
                }

                return true;
            } catch (error) {
                console.error('[UserPostsGallery] Toggle favorite error:', error);
                return false;
            }
        };

        /**
         * Toggle post visibility (public/private)
         * 
         * @param {string} postId - Post ID
         * @param {string} visibility - New visibility status
         * @returns {Promise<boolean>} Success
         */
        const toggleVisibility = async (postId, visibility) => {
            try {
                console.log('[UserPostsGallery] Toggling visibility for post:', postId);

                const response = await fetch(`/api/posts/${postId}/visibility`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ visibility })
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                // Invalidate cache
                if (typeof CacheManager !== 'undefined' && currentUserId) {
                    CacheManager.delete(`gallery-user-posts-${currentUserId}-page-${currentPage}`);
                }

                return true;
            } catch (error) {
                console.error('[UserPostsGallery] Toggle visibility error:', error);
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
                const userId = window.user?._id;
                if (!userId) {
                    console.warn('[UserPostsGallery] No user ID available');
                    return;
                }

                console.log('[UserPostsGallery] Initializing...');

                // Load first page
                const data = await load(userId, 1, false);

                // Display results
                display(data.data || []);

                console.log('[UserPostsGallery] Initialization complete');
            } catch (error) {
                console.error('[UserPostsGallery] Initialization error:', error);
            }
        };

        /**
         * Clear gallery
         */
        const clear = () => {
            try {
                GalleryRendererBase.clearGallery('#user-posts-gallery');
                currentUserId = null;
                currentPage = 1;
                totalPages = 1;
                console.log('[UserPostsGallery] Gallery cleared');
            } catch (error) {
                console.error('[UserPostsGallery] Clear error:', error);
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
                module: 'UserPostsGallery',
                currentUserId,
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
            toggleFavorite,
            toggleVisibility,
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
        DashboardApp.registerModule('UserPostsGallery', UserPostsGallery);
    }
}

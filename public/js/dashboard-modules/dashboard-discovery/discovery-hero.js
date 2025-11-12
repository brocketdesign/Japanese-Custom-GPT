/**
 * Discovery Hero Module - Phase 5
 * Manages immersive hero section with featured character card
 * Features: Parallax scroll, quick actions, fade-in animations
 * 
 * @requires DashboardState
 * @requires DashboardCache
 */

const DashboardDiscoveryHero = (() => {
    const STATE = {
        heroElement: null,
        currentHeroChat: null,
        parallaxEnabled: true,
        animationInProgress: false
    };

    /**
     * Initialize hero section with featured chat
     * @param {Object} options - Configuration options
     * @param {string} options.selector - Hero container selector (default: '#discovery-hero')
     * @param {Object} options.featuredChat - Initial featured chat data
     */
    function init(options = {}) {
        const selector = options.selector || '#discovery-hero';
        STATE.heroElement = document.querySelector(selector);

        if (!STATE.heroElement) {
            console.warn('[DashboardDiscoveryHero] Hero element not found:', selector);
            return;
        }

        // Set initial featured chat
        if (options.featuredChat) {
            setFeaturedChat(options.featuredChat);
        }

        // Setup event listeners
        setupScrollListeners();
        setupActionListeners();

        console.log('[DashboardDiscoveryHero] Initialized');
    }

    /**
     * Setup parallax scroll effect
     */
    function setupScrollListeners() {
        if (!STATE.parallaxEnabled) return;

        window.addEventListener('scroll', throttle(() => {
            if (!STATE.heroElement) return;

            const rect = STATE.heroElement.getBoundingClientRect();
            const scrolled = -rect.top;
            const parallaxElement = STATE.heroElement.querySelector('.hero-parallax-bg');

            if (parallaxElement) {
                // 30% of scroll distance for subtle parallax
                parallaxElement.style.transform = `translateY(${scrolled * 0.3}px)`;
            }
        }, 16)); // ~60fps
    }

    /**
     * Setup quick action buttons
     */
    function setupActionListeners() {
        const actions = STATE.heroElement.querySelectorAll('[data-hero-action]');

        actions.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const action = button.getAttribute('data-hero-action');

                switch (action) {
                    case 'chat':
                        handleChatAction();
                        break;
                    case 'save':
                        handleSaveAction();
                        break;
                    case 'share':
                        handleShareAction();
                        break;
                    default:
                        console.warn('[DashboardDiscoveryHero] Unknown action:', action);
                }
            });
        });
    }

    /**
     * Set featured chat card
     * @param {Object} chat - Chat/character data
     */
    function setFeaturedChat(chat) {
        if (!STATE.heroElement || !chat) return;

        STATE.currentHeroChat = chat;
        STATE.animationInProgress = true;

        // Fade out
        STATE.heroElement.style.opacity = '0';
        STATE.heroElement.style.transition = 'opacity 0.3s ease-out';

        setTimeout(() => {
            renderHeroCard(chat);
            
            // Fade in
            STATE.heroElement.style.opacity = '1';
            STATE.animationInProgress = false;
        }, 300);
    }

    /**
     * Render hero card HTML
     * @param {Object} chat - Chat data
     */
    function renderHeroCard(chat) {
        const template = `
            <div class="hero-container">
                <div class="hero-parallax-bg">
                    <img 
                        src="${chat.imageUrl || '/images/placeholder.png'}" 
                        alt="${chat.name}"
                        class="hero-image"
                        loading="lazy"
                    />
                    <div class="hero-overlay"></div>
                </div>

                <div class="hero-content">
                    <div class="hero-badges">
                        ${chat.featured ? '<span class="badge badge-featured">Featured</span>' : ''}
                        ${chat.trending ? '<span class="badge badge-trending">Trending</span>' : ''}
                    </div>

                    <h1 class="hero-title">${escapeHtml(chat.name)}</h1>
                    <p class="hero-description">${escapeHtml(chat.description || '')}</p>

                    <div class="hero-rating">
                        <div class="stars">
                            ${renderStars(chat.rating || 0)}
                        </div>
                        <span class="rating-text">
                            ${(chat.rating || 0).toFixed(1)} 
                            (${chat.ratingCount || 0} reviews)
                        </span>
                    </div>

                    <div class="hero-stats">
                        <div class="stat">
                            <span class="stat-value">${formatNumber(chat.views || 0)}</span>
                            <span class="stat-label">Views</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${formatNumber(chat.likes || 0)}</span>
                            <span class="stat-label">Likes</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${formatNumber(chat.chats || 0)}</span>
                            <span class="stat-label">Chats</span>
                        </div>
                    </div>

                    <div class="hero-actions">
                        <button 
                            class="btn btn-primary btn-lg hero-action"
                            data-hero-action="chat"
                        >
                            <i class="bi bi-chat-left-fill me-2"></i>
                            Start Chat
                        </button>
                        <button 
                            class="btn btn-outline-light hero-action"
                            data-hero-action="save"
                        >
                            <i class="bi bi-bookmark me-2"></i>
                            Save
                        </button>
                        <button 
                            class="btn btn-outline-light hero-action"
                            data-hero-action="share"
                        >
                            <i class="bi bi-share me-2"></i>
                            Share
                        </button>
                    </div>
                </div>

                <div class="hero-dots">
                    <div class="dot active" data-slide="0"></div>
                    <div class="dot" data-slide="1"></div>
                    <div class="dot" data-slide="2"></div>
                </div>
            </div>
        `;

        STATE.heroElement.innerHTML = template;
    }

    /**
     * Handle chat action
     */
    function handleChatAction() {
        if (!STATE.currentHeroChat) return;

        if (typeof redirectToChat === 'function') {
            redirectToChat(STATE.currentHeroChat._id, STATE.currentHeroChat.imageUrl);
        }
    }

    /**
     * Handle save action (bookmark)
     */
    function handleSaveAction() {
        if (!STATE.currentHeroChat) return;

        const button = STATE.heroElement.querySelector('[data-hero-action="save"]');
        if (!button) return;

        button.classList.toggle('active');

        // TODO: Integrate with bookmark API
        console.log('[DashboardDiscoveryHero] Save:', STATE.currentHeroChat._id);
    }

    /**
     * Handle share action
     */
    function handleShareAction() {
        if (!STATE.currentHeroChat) return;

        if (navigator.share) {
            navigator.share({
                title: STATE.currentHeroChat.name,
                text: STATE.currentHeroChat.description,
                url: window.location.href
            });
        } else {
            // Fallback: copy to clipboard
            const url = `${window.location.origin}/character/${STATE.currentHeroChat._id}`;
            navigator.clipboard.writeText(url);
            console.log('[DashboardDiscoveryHero] Link copied to clipboard');
        }
    }

    /**
     * Rotate featured chat (carousel)
     */
    function nextFeaturedChat() {
        // TODO: Fetch next featured chat from API or cache
        console.log('[DashboardDiscoveryHero] Next featured chat');
    }

    /**
     * Get current featured chat
     * @returns {Object|null}
     */
    function getCurrentHero() {
        return STATE.currentHeroChat;
    }

    /**
     * Destroy hero section
     */
    function destroy() {
        if (STATE.heroElement) {
            STATE.heroElement.innerHTML = '';
        }
        STATE.currentHeroChat = null;
        console.log('[DashboardDiscoveryHero] Destroyed');
    }

    // ==================== Helper Functions ====================

    function throttle(fn, delay) {
        let lastCall = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                return fn(...args);
            }
        };
    }

    function renderStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        let html = '';

        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                html += '<i class="bi bi-star-fill"></i>';
            } else if (i === fullStars && hasHalfStar) {
                html += '<i class="bi bi-star-half"></i>';
            } else {
                html += '<i class="bi bi-star"></i>';
            }
        }

        return html;
    }

    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // ==================== Public API ====================

    return {
        init,
        setFeaturedChat,
        nextFeaturedChat,
        getCurrentHero,
        destroy
    };
})();

// Export for use
if (typeof window !== 'undefined') {
    window.DashboardDiscoveryHero = DashboardDiscoveryHero;
}

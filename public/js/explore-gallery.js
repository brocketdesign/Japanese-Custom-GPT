/**
 * Explore Gallery - Mobile-First Instagram-Style Character Discovery
 * 
 * Features:
 * - Vertical swipe to browse different characters
 * - Horizontal swipe to browse images of the same character
 * - NSFW toggle with complete filtering
 * - Lazy loading with infinite scroll
 * - Native app-like smooth animations
 */

class ExploreGallery {
    constructor() {
        // State
        this.characters = [];
        this.currentCharacterIndex = 0;
        this.isLoading = false;
        this.hasMore = true;
        this.page = 1;
        this.limit = 15;
        this.query = window.initialQuery || '';
        this.showNSFW = window.showNSFW || false;
        
        // User state
        this.user = window.user || {};
        this.isPremium = this.user.subscriptionStatus === 'active';
        this.isTemporary = this.user.isTemporary || false;
        
        // Swipers
        this.verticalSwiper = null;
        this.horizontalSwipers = new Map();
        
        // Elements
        this.container = document.getElementById('explorePage');
        this.swiperWrapper = document.getElementById('characterSwiperWrapper');
        this.loadingEl = document.getElementById('exploreLoading');
        this.emptyEl = document.getElementById('exploreEmpty');
        this.quickActions = document.getElementById('quickActions');
        this.swipeHint = document.getElementById('swipeHint');
        this.nsfwToggleBtn = document.getElementById('nsfwToggleBtn');
        
        // Current character for quick actions
        this.currentCharacter = null;
        
        // Debounce timer for search
        this.searchDebounce = null;
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.checkSwipeHint();
        await this.loadCharacters();
        this.initVerticalSwiper();
    }
    
    setupEventListeners() {
        // Search form
        const searchForm = document.getElementById('search-form');
        const searchInput = document.getElementById('search-input');
        
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.query = searchInput.value.trim();
                this.resetAndReload();
            });
        }
        
        // Live search with debounce
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchDebounce);
                this.searchDebounce = setTimeout(() => {
                    this.query = e.target.value.trim();
                    this.resetAndReload();
                }, 500);
            });
        }
        
        // Clear search
        const clearBtn = document.getElementById('clearSearch');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                this.query = '';
                this.resetAndReload();
            });
        }
        
        // NSFW toggle
        if (this.nsfwToggleBtn) {
            this.nsfwToggleBtn.addEventListener('click', () => this.toggleNSFW());
            this.updateNSFWButton();
        }
        
        // Quick action buttons
        document.getElementById('viewProfileBtn')?.addEventListener('click', () => this.viewProfile());
        document.getElementById('startChatBtn')?.addEventListener('click', () => this.startChat());
        
        // Swipe hint dismiss
        if (this.swipeHint) {
            this.swipeHint.addEventListener('click', () => this.dismissSwipeHint());
            // Also dismiss on any touch
            this.swipeHint.addEventListener('touchstart', () => this.dismissSwipeHint());
        }
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Handle visibility change to pause/resume
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.verticalSwiper) {
                this.verticalSwiper.update();
            }
        });
    }
    
    checkSwipeHint() {
        const hasSeenHint = localStorage.getItem('exploreSwipeHintSeen');
        if (hasSeenHint) {
            this.swipeHint?.classList.add('hidden');
        } else {
            // Auto-dismiss after 4 seconds
            setTimeout(() => this.dismissSwipeHint(), 4000);
        }
    }
    
    dismissSwipeHint() {
        if (this.swipeHint && !this.swipeHint.classList.contains('hidden')) {
            this.swipeHint.classList.add('hidden');
            localStorage.setItem('exploreSwipeHintSeen', 'true');
        }
    }
    
    handleKeyboard(e) {
        // Don't handle if user is typing in search
        if (document.activeElement.tagName === 'INPUT') return;
        if (!this.verticalSwiper) return;
        
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                this.verticalSwiper.slidePrev();
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.verticalSwiper.slideNext();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.getCurrentHorizontalSwiper()?.slidePrev();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.getCurrentHorizontalSwiper()?.slideNext();
                break;
            case 'Enter':
                e.preventDefault();
                this.startChat();
                break;
        }
    }
    
    getCurrentHorizontalSwiper() {
        const currentSlide = this.verticalSwiper?.slides[this.verticalSwiper.activeIndex];
        if (currentSlide) {
            const charId = currentSlide.dataset.characterId;
            return this.horizontalSwipers.get(charId);
        }
        return null;
    }
    
    async toggleNSFW() {
        // Check if user is premium
        if (!this.isPremium) {
            // Show premium upgrade prompt
            if (typeof loadPlanPage === 'function') {
                loadPlanPage();
            } else {
                window.location.href = '/plan';
            }
            return;
        }
        
        this.showNSFW = !this.showNSFW;
        window.showNSFW = this.showNSFW;
        
        // Update button state
        this.updateNSFWButton();
        
        // Save preference to server
        try {
            await fetch(`/user/update-nsfw-preference/${this.user._id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `showNSFW=${this.showNSFW}`
            });
        } catch (err) {
            console.error('[ExploreGallery] Failed to save NSFW preference:', err);
        }
        
        // Reload gallery with new filter
        this.resetAndReload();
    }
    
    updateNSFWButton() {
        if (!this.nsfwToggleBtn) return;
        
        const label = this.nsfwToggleBtn.querySelector('.nsfw-label');
        const icon = this.nsfwToggleBtn.querySelector('i');
        
        if (this.showNSFW) {
            this.nsfwToggleBtn.dataset.nsfw = 'true';
            label.textContent = 'NSFW';
            icon.className = 'bi bi-shield-exclamation';
        } else {
            this.nsfwToggleBtn.dataset.nsfw = 'false';
            label.textContent = 'SFW';
            icon.className = 'bi bi-shield-check';
        }
    }
    
    async resetAndReload() {
        this.characters = [];
        this.page = 1;
        this.hasMore = true;
        this.currentCharacterIndex = 0;
        
        // Clear existing slides
        if (this.swiperWrapper) {
            this.swiperWrapper.innerHTML = '';
        }
        
        // Destroy swipers
        this.horizontalSwipers.forEach(swiper => swiper.destroy());
        this.horizontalSwipers.clear();
        if (this.verticalSwiper) {
            this.verticalSwiper.destroy();
            this.verticalSwiper = null;
        }
        
        // Hide quick actions and empty state
        if (this.quickActions) {
            this.quickActions.style.display = 'none';
        }
        if (this.emptyEl) {
            this.emptyEl.style.display = 'none';
        }
        
        // Reload
        this.showLoading();
        await this.loadCharacters();
        this.initVerticalSwiper();
    }
    
    async loadCharacters() {
        if (this.isLoading || !this.hasMore) return;
        
        this.isLoading = true;
        
        try {
            const params = new URLSearchParams({
                query: this.query,
                page: this.page,
                limit: this.limit,
                nsfw: this.showNSFW ? 'include' : 'exclude'
            });
            
            // Use fetchWithState if available (includes user state for personalization)
            const fetchFn = window.fetchWithState || fetch;
            const response = await fetchFn(`/api/gallery/explore?${params}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.characters && data.characters.length > 0) {
                // Process characters
                const newCharacters = this.processCharacters(data.characters);
                this.characters.push(...newCharacters);
                this.renderCharacterSlides(newCharacters);
                
                this.page++;
                this.hasMore = data.hasMore !== false && newCharacters.length > 0;
            } else if (this.characters.length === 0) {
                this.showEmpty();
            }
            
            this.hideLoading();
            
        } catch (err) {
            console.error('[ExploreGallery] Failed to load characters:', err);
            this.hideLoading();
            if (this.characters.length === 0) {
                this.showEmpty();
            }
        } finally {
            this.isLoading = false;
        }
    }
    
    processCharacters(characters) {
        return characters.map(char => {
            // Filter images based on NSFW setting
            let images = char.images || [];
            
            if (!this.showNSFW) {
                images = images.filter(img => !img.nsfw);
            }
            
            return {
                ...char,
                images: images
            };
        }).filter(char => char.images.length > 0); // Only keep characters with visible images
    }
    
    renderCharacterSlides(characters) {
        if (!this.swiperWrapper) return;
        
        characters.forEach(char => {
            const slide = this.createCharacterSlide(char);
            this.swiperWrapper.appendChild(slide);
        });
        
        // Update swiper if already initialized
        if (this.verticalSwiper) {
            this.verticalSwiper.update();
        }

        // Initialize or update horizontal swipers for newly added slides
        this.initHorizontalSwipers();
    }
    
    createCharacterSlide(character) {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide character-slide';
        slide.dataset.characterId = character.chatId;
        
        const imagesHtml = character.images.map((img, idx) => {
            // Use imageUrl as primary source, fallback to thumbnailUrl, then placeholder
            const imageUrl = img.imageUrl || img.thumbnailUrl || '/img/placeholder.png';
            const thumbUrl = img.thumbnailUrl || img.imageUrl || '/img/placeholder.png';
            const isNsfw = img.nsfw && (!this.showNSFW || !this.isPremium);

            // All images use the full imageUrl for display
            return `
                <div class="swiper-slide">
                    <div class="explore-image-card ${isNsfw ? 'nsfw-content' : ''}">
                        <img 
                            src="${imageUrl}" 
                            alt="${this.escapeHtml(character.chatName)}"
                            class="explore-image"
                            loading="${idx < 2 ? 'eager' : 'lazy'}"
                            onerror="this.onerror=null; this.src='/img/placeholder.png';"
                        >
                        ${isNsfw ? this.createNSFWOverlay() : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        const dotsHtml = this.createImageDots(character.images.length);
        
        slide.innerHTML = `
            <div class="swiper character-images-swiper" data-character-id="${character.chatId}">
                <div class="swiper-wrapper">
                    ${imagesHtml}
                </div>
            </div>
            <div class="character-info-overlay">
                <div class="character-header">
                    <div class="character-avatar-link">
                        <img 
                            src="${character.chatImageUrl || '/img/default-thumbnail.png'}" 
                            alt="${this.escapeHtml(character.chatName)}"
                            class="character-avatar"
                            onerror="this.src='/img/default-thumbnail.png'"
                        >
                    </div>
                    <div class="character-details">
                        <h3 class="character-name">
                            <a href="/character/slug/${character.chatSlug}" onclick="event.stopPropagation()">${this.escapeHtml(character.chatName)}</a>
                        </h3>
                        <p class="image-counter">
                            <span class="current-image">1</span> / ${character.images.length} images
                        </p>
                    </div>
                    <div class="character-actions">
                        <button class="action-btn" onclick="event.stopPropagation(); window.location.href='/character/slug/${character.chatSlug}'" title="View Profile">
                            <i class="bi bi-person"></i>
                        </button>
                        <button class="action-btn primary" onclick="event.stopPropagation(); window.exploreGallery.handleChatClick('${character.chatId}')" title="Open Chat">
                            <i class="bi bi-chat-dots"></i>
                        </button>
                    </div>
                </div>
                ${dotsHtml}
            </div>
        `;
        
        return slide;
    }
    
    /**
     * Handle chat button click - redirects to chat or opens login modal
     */
    handleChatClick(chatId) {
        if (this.isTemporary) {
            // Open login modal for non-logged-in users
            if (typeof openLoginForm === 'function') {
                openLoginForm();
            } else {
                window.location.href = '/login';
            }
        } else {
            // Go to chat for logged-in users
            window.location.href = `/chat/${chatId}`;
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
    
    createNSFWOverlay() {
        if (this.isTemporary || !this.isPremium) {
            return `
                <div class="nsfw-blur-overlay" onclick="event.stopPropagation(); window.exploreGallery.showUpgradePrompt()">
                    <div class="nsfw-blur-content">
                        <i class="bi bi-lock-fill"></i>
                        <p>Premium content</p>
                    </div>
                </div>
            `;
        }
        return '';
    }
    
    createImageDots(count) {
        if (count <= 1) return '';
        
        const maxDots = Math.min(count, 8);
        const dots = Array(maxDots).fill(0).map((_, i) => 
            `<div class="image-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`
        ).join('');
        
        if (count > maxDots) {
            return `<div class="image-pagination">${dots}<span class="more-indicator">+${count - maxDots}</span></div>`;
        }
        
        return `<div class="image-pagination">${dots}</div>`;
    }
    
    initVerticalSwiper() {
        if (!this.swiperWrapper || this.characters.length === 0) {
            this.hideLoading();
            return;
        }
        
        this.verticalSwiper = new Swiper('#characterSwiper', {
            direction: 'vertical',
            slidesPerView: 1,
            spaceBetween: 0,
            mousewheel: {
                forceToAxis: true,
                sensitivity: 1
            },
            keyboard: {
                enabled: true,
                onlyInViewport: true
            },
            touchEventsTarget: 'container',
            threshold: 20,
            resistanceRatio: 0.85,
            speed: 400,
            effect: 'slide',
            on: {
                slideChange: () => this.onCharacterChange(),
                reachEnd: () => this.onReachEnd()
            }
        });
        
        // Initialize horizontal swipers for each character
        this.initHorizontalSwipers();
        
        // Show quick actions
        if (this.quickActions && this.characters.length > 0) {
            this.quickActions.style.display = 'flex';
            this.updateCurrentCharacter();
        }
    }
    
    initHorizontalSwipers() {
        const horizontalContainers = document.querySelectorAll('.character-images-swiper');
        
        horizontalContainers.forEach(container => {
            const charId = container.dataset.characterId;
            if (this.horizontalSwipers.has(charId)) return;
            
            const swiper = new Swiper(container, {
                direction: 'horizontal',
                slidesPerView: 1,
                spaceBetween: 0,
                nested: true,
                touchEventsTarget: 'container',
                threshold: 20,
                resistanceRatio: 0.85,
                speed: 300,
                observer: true,
                observeParents: true,
                watchSlidesProgress: true,
                on: {
                    slideChange: (s) => this.onImageChange(charId, s.activeIndex)
                }
            });
            
            // Force an update in case slides were added dynamically
            swiper.update();
            
            this.horizontalSwipers.set(charId, swiper);
        });
    }
    
    onCharacterChange() {
        this.currentCharacterIndex = this.verticalSwiper.activeIndex;
        this.updateCurrentCharacter();
        
        // Track character view
        this.trackCharacterView();
        
        // Initialize horizontal swiper for new slides
        this.initHorizontalSwipers();
        
        // Preload next characters
        this.preloadNextCharacters();
    }
    
    preloadNextCharacters() {
        // Preload images for next 2 characters
        const nextIndices = [
            this.currentCharacterIndex + 1,
            this.currentCharacterIndex + 2
        ];
        
        nextIndices.forEach(idx => {
            if (idx < this.characters.length) {
                const char = this.characters[idx];
                if (char && char.images && char.images.length > 0) {
                    const img = new Image();
                    img.src = char.images[0].thumbnailUrl || char.images[0].imageUrl;
                }
            }
        });
    }
    
    onImageChange(charId, imageIndex) {
        // Update image counter
        const slide = document.querySelector(`.character-slide[data-character-id="${charId}"]`);
        if (slide) {
            const counter = slide.querySelector('.current-image');
            if (counter) {
                counter.textContent = imageIndex + 1;
            }
            
            // Update dots
            const dots = slide.querySelectorAll('.image-dot');
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === imageIndex);
            });
        }
    }
    
    onReachEnd() {
        if (this.hasMore && !this.isLoading) {
            this.loadCharacters();
        }
    }
    
    updateCurrentCharacter() {
        const char = this.characters[this.currentCharacterIndex];
        if (char) {
            this.currentCharacter = char;
        }
    }
    
    /**
     * Track character view for personalization
     */
    trackCharacterView() {
        if (!this.currentCharacter) return;
        
        // Gather data to track
        const characterId = this.currentCharacter.chatId;
        const imageIds = (this.currentCharacter.images || []).map(img => img._id || img.imageUrl);
        const tags = this.currentCharacter.chatTags || [];
        
        // Use ContentDiscovery tracker if available
        if (window.ContentDiscovery) {
            window.ContentDiscovery.trackCharacterView(characterId, imageIds.slice(0, 5), tags);
        }
        
        // For logged-in users, also send to server (async, don't wait)
        if (!this.isTemporary) {
            this.sendTrackingToServer(characterId, imageIds.slice(0, 5), tags);
        }
    }
    
    /**
     * Send tracking data to server (for logged-in users)
     */
    async sendTrackingToServer(characterId, imageIds, tags) {
        try {
            await fetch('/api/gallery/track/character-view', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    characterId,
                    imageIds,
                    tags
                })
            });
        } catch (error) {
            // Silent fail - tracking is not critical
            console.debug('[ExploreGallery] Failed to send tracking:', error);
        }
    }
    
    // Quick Actions
    viewProfile() {
        if (this.currentCharacter) {
            this.openProfile(this.currentCharacter.chatId);
        }
    }
    
    startChat() {
        if (this.currentCharacter) {
            this.goToChat(this.currentCharacter.chatSlug);
        }
    }
    
    openProfile(chatId) {
        if (typeof openCharacterIntroModal === 'function') {
            openCharacterIntroModal(chatId);
        } else {
            window.location.href = `/character/${chatId}`;
        }
    }
    
    goToChat(slug) {
        window.location.href = `/character/slug/${slug}`;
    }
    
    showUpgradePrompt() {
        if (typeof loadPlanPage === 'function') {
            loadPlanPage();
        } else {
            window.location.href = '/plan';
        }
    }
    
    // UI States
    showLoading() {
        if (this.loadingEl) {
            this.loadingEl.style.display = 'flex';
        }
        if (this.emptyEl) {
            this.emptyEl.style.display = 'none';
        }
    }
    
    hideLoading() {
        if (this.loadingEl) {
            this.loadingEl.style.display = 'none';
        }
    }
    
    showEmpty() {
        if (this.emptyEl) {
            this.emptyEl.style.display = 'flex';
        }
        if (this.loadingEl) {
            this.loadingEl.style.display = 'none';
        }
        if (this.quickActions) {
            this.quickActions.style.display = 'none';
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.exploreGallery = new ExploreGallery();
});

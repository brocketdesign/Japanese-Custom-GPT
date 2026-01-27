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
    /**
     * Helper to check if a value represents NSFW content
     * Handles: boolean true, string 'true', string 'on', and any truthy non-false value
     */
    static isNsfwValue(value) {
        if (value === true) return true;
        if (value === 'true') return true;
        if (value === 'on') return true;
        if (value === 1) return true;
        if (value === '1') return true;
        return false;
    }
    
    constructor() {
        // State
        this.characters = [];
        this.currentCharacterIndex = 0;
        this.isLoading = false;
        this.hasMore = true;
        this.page = 1;
        this.limit = 15;
        this.query = window.initialQuery || '';
        
        // Read showNSFW from sessionStorage first (user's current session preference),
        // then localStorage (persisted preference), then window.showNSFW (server default)
        this.showNSFW = this.getStoredNSFWPreference();
        
        // User state
        this.user = window.user || {};
        this.isPremium = this.user.subscriptionStatus === 'active';
        this.isTemporary = this.user.isTemporary || false;
        
        // Liked images state (per image ID)
        this.likedImages = new Set();
        
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
    
    getStoredNSFWPreference() {
        try {
            // Check sessionStorage first (current session preference)
            const sessionValue = sessionStorage.getItem('showNSFW');
            if (sessionValue !== null) {
                return sessionValue === 'true';
            }
            
            // Then check localStorage (persisted preference)
            const localValue = localStorage.getItem('showNSFW');
            if (localValue !== null) {
                return localValue === 'true';
            }
        } catch (err) {
            console.warn('[ExploreGallery] Failed to read from storage:', err);
        }
        
        // Fall back to server-provided value
        return window.showNSFW || false;
    }
    
    async init() {
        // Update the NSFW button to reflect the current state
        this.updateNSFWButton();
        
        this.setupEventListeners();
        this.checkSwipeHint();
        await this.loadCharacters();
        this.initVerticalSwiper();
        
        // Apply blur states after initial render
        this.updateImageBlurStates();
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
        
        // Save to sessionStorage and localStorage (with error handling)
        try {
            sessionStorage.setItem('showNSFW', this.showNSFW.toString());
            localStorage.setItem('showNSFW', this.showNSFW.toString());
        } catch (err) {
            console.error('[ExploreGallery] Failed to save to storage:', err);
        }
        
        // Update button state
        this.updateNSFWButton();
        
        // Apply or remove blur based on new state
        this.updateImageBlurStates();
        
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
    
    updateImageBlurStates() {
        // Get all images in the gallery
        const allImages = document.querySelectorAll('.explore-image[data-sfw]');
        
        allImages.forEach(img => {
            const dataSfwAttr = img.getAttribute('data-sfw');
            const isSfw = dataSfwAttr === 'true';
            const imageCard = img.closest('.explore-image-card');
            
            if (!imageCard) return;
            
            // Remove existing overlay if any
            const existingOverlay = imageCard.querySelector('.nsfw-blur-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
            
            // If image is NSFW and we're in SFW mode, apply blur
            if (!isSfw && !this.showNSFW) {
                // Add blur class (CSS will apply the blur effect)
                imageCard.classList.add('nsfw-content', 'nsfw-blurred');
                
                // Add clickable overlay for premium users to toggle back to NSFW mode
                if (this.isPremium && !this.isTemporary) {
                    const overlay = document.createElement('div');
                    overlay.className = 'nsfw-blur-overlay';
                    
                    const content = document.createElement('div');
                    content.className = 'nsfw-blur-content';
                    
                    const icon = document.createElement('i');
                    icon.className = 'bi bi-eye-slash-fill';
                    
                    const text = document.createElement('p');
                    text.textContent = 'NSFW Content';
                    
                    const small = document.createElement('small');
                    small.textContent = 'Click to show all NSFW content';
                    
                    content.appendChild(icon);
                    content.appendChild(text);
                    content.appendChild(small);
                    overlay.appendChild(content);
                    
                    // Clicking overlay toggles NSFW mode globally
                    overlay.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleNSFW();
                    });
                    imageCard.appendChild(overlay);
                }
            } else {
                // Remove blur
                imageCard.classList.remove('nsfw-content', 'nsfw-blurred');
            }
        });
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
        this.showLoading();

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

                // Continue infinite scroll: hasMore is true if we got results
                // Even if backend says hasMore=false, we keep trying (backend might have more on next page)
                this.hasMore = newCharacters.length > 0;
            } else {
                // No more characters found
                this.hasMore = false;

                if (this.characters.length === 0) {
                    this.showEmpty();
                }
            }

            this.hideLoading();

        } catch (err) {
            console.error('[ExploreGallery] Failed to load characters:', err);
            this.hideLoading();

            if (this.characters.length === 0) {
                this.showEmpty();
            } else {
                // On error, allow retry by keeping hasMore true
                this.hasMore = true;
            }
        } finally {
            this.isLoading = false;
        }
    }
    
    processCharacters(characters) {
        // Don't filter out NSFW images - just pass them through
        // Blurring is handled in createCharacterSlide and updateImageBlurStates
        return characters.map(char => ({
            ...char,
            images: char.images || []
        })).filter(char => char.images.length > 0);
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
        slide.dataset.currentImageId = character.images[0]?._id || character.images[0]?.imageUrl || '';
        
        const imagesHtml = character.images.map((img, idx) => {
            // Use imageUrl as primary source, fallback to thumbnailUrl, then placeholder
            const imageUrl = img.imageUrl || img.thumbnailUrl || '/img/placeholder.png';
            const thumbUrl = img.thumbnailUrl || img.imageUrl || '/img/placeholder.png';
            // Check if image is NSFW using helper (handles boolean, 'true', 'on', etc.)
            const isNsfwImage = ExploreGallery.isNsfwValue(img.nsfw);
            const shouldBlur = isNsfwImage && !this.showNSFW;
            // data-sfw is the inverse of isNsfwImage
            const isSfw = !isNsfwImage;

            // All images use the full imageUrl for display
            return `
                <div class="swiper-slide" data-image-id="${img._id || img.imageUrl}">
                    <div class="explore-image-card ${isNsfwImage ? 'nsfw-content' : ''} ${shouldBlur ? 'nsfw-blurred' : ''}">
                        <img 
                            src="${imageUrl}" 
                            alt="${this.escapeHtml(character.chatName)}"
                            class="explore-image"
                            data-sfw="${isSfw}"
                            loading="${idx < 2 ? 'eager' : 'lazy'}"
                            onerror="this.onerror=null; this.src='/img/placeholder.png';"
                        >
                        ${shouldBlur ? this.createNSFWOverlay() : ''}
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
            
            <!-- TikTok-style action buttons (right side, vertical) -->
            <div class="tiktok-actions">
                <span class="tiktok-action-btn heart-btn" 
                        data-chat-id="${character.chatId}"
                        data-id="${character.images[0]?._id || character.images[0]?.imageUrl || ''}"
                        onclick="event.stopPropagation(); window.exploreGallery.handleLikeImage(this);"
                        title="Add to favorites">
                    <div class="action-icon">
                        <i class="bi bi-heart"></i>
                    </div>
                </span>
                <button class="tiktok-action-btn profile-btn" 
                        onclick="event.stopPropagation(); window.location.href='/character/slug/${character.chatSlug}'" 
                        title="View Profile">
                    <div class="action-icon">
                        <i class="bi bi-person"></i>
                    </div>
                </button>
                <button class="tiktok-action-btn chat-btn"
                        onclick="event.stopPropagation(); window.exploreGallery.handleChatClick('${character.chatId}')"
                        title="Open Chat">
                    <div class="action-icon">
                        <i class="bi bi-chat-dots"></i>
                    </div>
                </button>
                ${window.isAdmin ? `
                <div class="admin-actions-divider"></div>
                <button class="tiktok-action-btn admin-btn delete-image-btn"
                        data-chat-id="${character.chatId}"
                        onclick="event.stopPropagation(); window.exploreGallery.handleAdminDeleteImage(this);"
                        title="Delete Current Image">
                    <div class="action-icon">
                        <i class="bi bi-image"></i>
                    </div>
                </button>
                <button class="tiktok-action-btn admin-btn delete-character-btn"
                        data-chat-id="${character.chatId}"
                        onclick="event.stopPropagation(); window.exploreGallery.handleAdminDeleteCharacter(this);"
                        title="Delete Character">
                    <div class="action-icon">
                        <i class="bi bi-trash"></i>
                    </div>
                </button>
                <button class="tiktok-action-btn admin-btn preview-model-btn"
                        data-chat-id="${character.chatId}"
                        data-image-model="${character.imageModel || ''}"
                        onclick="event.stopPropagation(); window.exploreGallery.handleAdminPreviewModel(this);"
                        title="Preview Image Model: ${character.imageModel || 'N/A'}">
                    <div class="action-icon">
                        <i class="bi bi-gpu-card"></i>
                    </div>
                </button>
                ` : ''}
            </div>
            
            <!-- Bottom info overlay -->
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
            
            // Update heart button state for the first image
            this.updateHeartButtonForImage(container, 0);
            
            // Setup double-tap to like on images
            this.setupDoubleTapLike(container);
        });
    }
    
    /**
     * Setup double-tap to like on images
     */
    setupDoubleTapLike(container) {
        const slide = container.closest('.character-slide');
        if (!slide) return;

        let lastTapTime = 0;
        let lastTapX = 0;
        let lastTapY = 0;

        // Touch events for mobile
        container.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;

            // Get current touch point
            if (e.changedTouches.length > 0) {
                const touch = e.changedTouches[0];
                const currentX = touch.clientX;
                const currentY = touch.clientY;

                // Check if it's a double tap (within 300ms and same location within 30px)
                const distance = Math.sqrt(
                    Math.pow(currentX - lastTapX, 2) +
                    Math.pow(currentY - lastTapY, 2)
                );

                if (tapLength < 300 && tapLength > 0 && distance < 30) {
                    e.preventDefault();

                    // Create floating heart animation at tap position
                    this.createDoubleTapHearts(currentX, currentY, slide);

                    // Trigger like on the heart button
                    const heartBtn = slide.querySelector('.tiktok-action-btn.heart-btn');
                    if (heartBtn) {
                        this.handleLikeImage(heartBtn);
                    }
                }

                lastTapTime = currentTime;
                lastTapX = currentX;
                lastTapY = currentY;
            }
        });

        // Double-click support for desktop
        container.addEventListener('dblclick', (e) => {
            e.preventDefault();

            // Create floating heart animation at click position
            this.createDoubleTapHearts(e.clientX, e.clientY, slide);

            // Trigger like on the heart button
            const heartBtn = slide.querySelector('.tiktok-action-btn.heart-btn');
            if (heartBtn) {
                this.handleLikeImage(heartBtn);
            }
        });
    }

    /**
     * Create floating hearts animation at double-tap position
     */
    createDoubleTapHearts(x, y, slide) {
        console.log(`🎯 Creating hearts at position: (${x}, ${y})`);

        const numHearts = 3;
        const animations = ['floatHeart', 'floatHeartLeft', 'floatHeartRight'];

        for (let i = 0; i < numHearts; i++) {
            const heart = document.createElement('div');
            heart.className = `double-tap-heart heart-${i + 1}`;

            // Check if Bootstrap Icons are available, otherwise use emoji
            const testIcon = document.createElement('i');
            testIcon.className = 'bi bi-heart-fill';
            testIcon.style.position = 'absolute';
            testIcon.style.visibility = 'hidden';
            document.body.appendChild(testIcon);
            const computedStyle = window.getComputedStyle(testIcon);
            const hasBootstrapIcons = computedStyle.fontFamily.includes('bootstrap-icons');
            document.body.removeChild(testIcon);

            // Use Bootstrap icon or emoji fallback
            if (hasBootstrapIcons) {
                heart.innerHTML = '<i class="bi bi-heart-fill"></i>';
            } else {
                heart.innerHTML = '❤️';
                console.log('Using emoji fallback for heart animation');
            }

            // Use fixed positioning to work with clientX/clientY coordinates
            heart.style.position = 'fixed';
            heart.style.left = `${x}px`;
            heart.style.top = `${y}px`;
            heart.style.zIndex = '999999';

            // Apply animation for each heart
            heart.style.animation = `${animations[i]} 1s ease-out forwards`;
            heart.style.animationDelay = `${i * 0.1}s`;

            console.log(`❤️ Heart ${i + 1} created with animation: ${animations[i]}`);

            // Add to body for proper fixed positioning
            document.body.appendChild(heart);

            // Remove after animation completes
            setTimeout(() => {
                if (heart.parentNode) {
                    heart.remove();
                    console.log(`🗑️ Heart ${i + 1} removed`);
                }
            }, 1200 + (i * 100));
        }
    }

    /**
     * Update heart button for a specific image
     */
    updateHeartButtonForImage(container, imageIndex) {
        const slide = container.closest('.character-slide');
        if (!slide) return;
        
        const imageSlidesArray = Array.from(slide.querySelectorAll('.character-images-swiper .swiper-slide'));
        if (!imageSlidesArray[imageIndex]) return;
        
        const imageId = imageSlidesArray[imageIndex].dataset.imageId;
        const heartBtn = slide.querySelector('.tiktok-action-btn.heart-btn');
        
        if (heartBtn && imageId) {
            heartBtn.dataset.id = imageId;
            this.syncHeartButtonState(heartBtn, imageId);
        }
    }
    
    /**
     * Synchronize heart button state with the actual like status
     */
    syncHeartButtonState(heartBtn, imageId) {
        if (!heartBtn || !imageId) return;
        
        // Check current icon state
        const icon = heartBtn.querySelector('.action-icon i');
        if (!icon) return;
        
        // Check if we have this image's like state stored locally
        const isLiked = this.likedImages && this.likedImages.has(imageId);
        
        // Update the heart button to match the stored state
        if (isLiked) {
            heartBtn.classList.add('liked');
            icon.classList.remove('bi-heart');
            icon.classList.add('bi-heart-fill');
            icon.classList.add('text-danger');
        } else {
            heartBtn.classList.remove('liked');
            icon.classList.remove('bi-heart-fill');
            icon.classList.remove('text-danger');
            icon.classList.add('bi-heart');
        }
    }
    
    /**
     * Handle like/unlike image with proper state management and notification
     */
    handleLikeImage(buttonEl) {
        // Check if user is temporary
        if (this.isTemporary) {
            if (typeof openLoginForm === 'function') {
                openLoginForm();
            }
            return;
        }
        
        const imageId = buttonEl.dataset.id;
        const chatId = buttonEl.dataset.chatId;
        if (!imageId) return;
        
        const icon = buttonEl.querySelector('.action-icon i');
        if (!icon) return;
        
        // Determine current state and toggle
        const isCurrentlyLiked = this.likedImages.has(imageId);
        const action = isCurrentlyLiked ? 'unlike' : 'like';
        
        // Update local state FIRST
        if (action === 'like') {
            this.likedImages.add(imageId);
        } else {
            this.likedImages.delete(imageId);
        }
        
        // Update UI immediately
        this.syncHeartButtonState(buttonEl, imageId);
        
        // Show notification for likes
        if (action === 'like') {
            if (typeof showNotification === 'function') {
                const message = window.translations?.like_grant_points?.replace('{point}', '5') || 'Image liked! +5 points';
                showNotification(message, 'success');
            }
        }
        
        // Make API call
        fetch(`/gallery/${imageId}/like-toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ action, userChatId: chatId })
        }).catch(err => {
            console.error('[ExploreGallery] Failed to toggle like:', err);
            // Revert state on error
            if (action === 'like') {
                this.likedImages.delete(imageId);
            } else {
                this.likedImages.add(imageId);
            }
            this.syncHeartButtonState(buttonEl, imageId);
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

        // Load more characters when approaching the end (5 characters before the end)
        const remainingCharacters = this.characters.length - this.currentCharacterIndex;
        if (remainingCharacters <= 5 && this.hasMore && !this.isLoading) {
            console.log('[ExploreGallery] Approaching end, preloading more characters...');
            this.loadCharacters();
        }
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
            
            // Update the heart button with the new image ID
            const imageSlidesArray = Array.from(slide.querySelectorAll('.character-images-swiper .swiper-slide'));
            if (imageSlidesArray[imageIndex]) {
                const newImageId = imageSlidesArray[imageIndex].dataset.imageId;
                const heartBtn = slide.querySelector('.tiktok-action-btn.heart-btn');
                if (heartBtn && newImageId) {
                    heartBtn.dataset.id = newImageId;
                    slide.dataset.currentImageId = newImageId;
                    
                    // Synchronize heart button state with the actual like status
                    this.syncHeartButtonState(heartBtn, newImageId);
                }
            }
        }
    }
    
    onReachEnd() {
        // Load more characters when reaching near the end
        if (this.hasMore && !this.isLoading) {
            console.log('[ExploreGallery] Reached end, loading more characters...');
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
    
    /**
     * Handle image favorite button click
     */
    handleImageFavorite(button, chatId) {
        // Check if user is logged in
        if (this.isTemporary) {
            // Open login modal for non-logged-in users
            if (typeof openLoginForm === 'function') {
                openLoginForm();
            } else {
                window.location.href = '/login';
            }
            return;
        }
        
        // Toggle favorite status
        const isCurrentlyLiked = button.classList.contains('liked');
        
        // Optimistic UI update
        if (isCurrentlyLiked) {
            button.classList.remove('liked');
            const icon = button.querySelector('.action-icon i');
            if (icon) {
                icon.classList.remove('bi-heart-fill');
                icon.classList.add('bi-heart');
            }
        } else {
            button.classList.add('liked');
            const icon = button.querySelector('.action-icon i');
            if (icon) {
                icon.classList.remove('bi-heart');
                icon.classList.add('bi-heart-fill');
            }
        }
        
        // Call favorites API
        if (typeof Favorites !== 'undefined') {
            Favorites.toggleFavorite(chatId, (response) => {
                // Update UI based on actual response
                if (response && response.success) {
                    const actualState = response.isFavorited;
                    
                    // Ensure UI matches actual state
                    if (actualState) {
                        button.classList.add('liked');
                        const icon = button.querySelector('.action-icon i');
                        if (icon) {
                            icon.classList.remove('bi-heart');
                            icon.classList.add('bi-heart-fill');
                        }
                    } else {
                        button.classList.remove('liked');
                        const icon = button.querySelector('.action-icon i');
                        if (icon) {
                            icon.classList.remove('bi-heart-fill');
                            icon.classList.add('bi-heart');
                        }
                    }
                } else {
                    // Revert optimistic update on error
                    if (isCurrentlyLiked) {
                        button.classList.add('liked');
                        const icon = button.querySelector('.action-icon i');
                        if (icon) {
                            icon.classList.remove('bi-heart');
                            icon.classList.add('bi-heart-fill');
                        }
                    } else {
                        button.classList.remove('liked');
                        const icon = button.querySelector('.action-icon i');
                        if (icon) {
                            icon.classList.remove('bi-heart-fill');
                            icon.classList.add('bi-heart');
                        }
                    }
                }
            });
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
    
    // Admin actions
    handleAdminDeleteImage(btn) {
        const slide = btn.closest('.character-slide');
        if (!slide) return;
        const chatId = btn.dataset.chatId;
        const currentImageSlide = slide.querySelector('.character-images-swiper .swiper-slide-active');
        const imageId = currentImageSlide?.dataset?.imageId;
        if (!imageId) {
            alert('No image selected');
            return;
        }
        if (!confirm('Delete this image? This cannot be undone.')) return;

        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
        fetch(`/api/admin/delete-image/${chatId}/${imageId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                // Remove the image slide
                if (currentImageSlide) currentImageSlide.remove();
                // Update horizontal swiper
                const swiperEl = slide.querySelector('.character-images-swiper');
                if (swiperEl?.swiper) swiperEl.swiper.update();
                alert('Image deleted');
            } else {
                alert(data.error || 'Failed to delete image');
            }
        })
        .catch(() => alert('Failed to delete image'))
        .finally(() => {
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        });
    }

    handleAdminDeleteCharacter(btn) {
        const chatId = btn.dataset.chatId;
        if (!chatId) return;
        if (!confirm('Delete this character and all their data? This cannot be undone.')) return;

        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
        fetch(`/api/delete-chat/${chatId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        })
        .then(r => r.json())
        .then(data => {
            if (data.message || data.success) {
                // Remove the character slide and move to next
                const slide = btn.closest('.character-slide');
                if (slide) slide.remove();
                if (this.verticalSwiper) this.verticalSwiper.update();
                alert('Character deleted');
            } else {
                alert(data.error || 'Failed to delete character');
            }
        })
        .catch(() => alert('Failed to delete character'))
        .finally(() => {
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        });
    }

    handleAdminPreviewModel(btn) {
        const imageModel = btn.dataset.imageModel;
        if (!imageModel) {
            alert('No image model set for this character');
            return;
        }
        // Open the admin image test page filtered by this model
        window.open(`/dashboard/image?model=${encodeURIComponent(imageModel)}`, '_blank');
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

// Debug function to test heart animation from console
window.testHeartAnimation = function(x, y) {
    console.log('🧪 Testing heart animation...');

    // Check if Font Awesome is loaded
    const testIcon = document.createElement('i');
    testIcon.className = 'fas fa-heart';
    document.body.appendChild(testIcon);
    const computedStyle = window.getComputedStyle(testIcon);
    const isFontAwesome = computedStyle.fontFamily.includes('Font Awesome');
    document.body.removeChild(testIcon);
    console.log('📦 Font Awesome loaded:', isFontAwesome);

    // Use center of screen if no coordinates provided
    if (x === undefined || y === undefined) {
        x = window.innerWidth / 2;
        y = window.innerHeight / 2;
        console.log(`📍 Using center of screen: (${x}, ${y})`);
    }

    const numHearts = 3;
    const animations = ['floatHeart', 'floatHeartLeft', 'floatHeartRight'];

    for (let i = 0; i < numHearts; i++) {
        const heart = document.createElement('div');
        heart.className = `double-tap-heart heart-${i + 1}`;

        // Use both icon and text as fallback
        heart.innerHTML = '<i class="fas fa-heart"></i>';
        if (!isFontAwesome) {
            heart.innerHTML = '❤️'; // Fallback to emoji
            console.warn('⚠️ Font Awesome not detected, using emoji fallback');
        }

        // Use fixed positioning
        heart.style.position = 'fixed';
        heart.style.left = `${x}px`;
        heart.style.top = `${y}px`;
        heart.style.zIndex = '999999';

        // Apply animation
        heart.style.animation = `${animations[i]} 1s ease-out forwards`;
        heart.style.animationDelay = `${i * 0.1}s`;

        console.log(`❤️ Heart ${i + 1} created:`, {
            position: heart.style.position,
            left: heart.style.left,
            top: heart.style.top,
            zIndex: heart.style.zIndex,
            animation: heart.style.animation,
            className: heart.className,
            innerHTML: heart.innerHTML
        });

        // Add to body
        document.body.appendChild(heart);

        // Log computed styles after adding to DOM
        const computed = window.getComputedStyle(heart);
        console.log(`🎨 Heart ${i + 1} computed styles:`, {
            position: computed.position,
            left: computed.left,
            top: computed.top,
            zIndex: computed.zIndex,
            opacity: computed.opacity,
            visibility: computed.visibility,
            display: computed.display,
            fontSize: computed.fontSize,
            color: computed.color
        });

        // Remove after animation
        setTimeout(() => {
            if (heart.parentNode) {
                heart.remove();
                console.log(`🗑️ Heart ${i + 1} removed`);
            }
        }, 1200 + (i * 100));
    }

    console.log('✅ Heart animation test complete! Hearts should be visible now.');
};

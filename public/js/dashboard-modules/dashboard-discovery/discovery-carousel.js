/**
 * Discovery Carousel Module - Phase 5
 * Optimized carousel for featured collections
 * Features: Smooth swipe gestures, responsive dimensions, touch-friendly
 * 
 * @requires Swiper (external dependency)
 */

const DashboardDiscoveryCarousel = (() => {
    const STATE = {
        carousels: new Map(), // id -> swiper instance
        touchStartX: 0,
        touchEndX: 0
    };

    /**
     * Initialize carousel with Swiper
     * @param {Object} options - Configuration options
     * @param {string} options.id - Unique carousel ID
     * @param {string} options.selector - Container selector
     * @param {Object} options.config - Swiper configuration override
     */
    function init(options = {}) {
        const { id, selector, config = {} } = options;

        if (!id) {
            console.error('[DashboardDiscoveryCarousel] ID is required');
            return null;
        }

        const element = document.querySelector(selector || `.carousel[data-carousel-id="${id}"]`);
        if (!element) {
            console.warn('[DashboardDiscoveryCarousel] Carousel element not found:', selector);
            return null;
        }

        // Default Swiper config optimized for touch
        const swiperConfig = {
            loop: true,
            slidesPerView: 1.2,
            spaceBetween: 12,
            grabCursor: true,
            pagination: {
                el: element.querySelector('.swiper-pagination'),
                clickable: true,
                dynamicBullets: true
            },
            navigation: {
                nextEl: element.querySelector('.swiper-button-next'),
                prevEl: element.querySelector('.swiper-button-prev')
            },
            breakpoints: {
                320: { slidesPerView: 1.1, spaceBetween: 8 },
                480: { slidesPerView: 1.3, spaceBetween: 10 },
                768: { slidesPerView: 2.2, spaceBetween: 12 },
                1024: { slidesPerView: 3.2, spaceBetween: 16 },
                1400: { slidesPerView: 4, spaceBetween: 20 }
            },
            autoplay: {
                delay: 5000,
                disableOnInteraction: true,
                pauseOnMouseEnter: true
            },
            speed: 400,
            effect: 'slide',
            // Touch swipe
            touchRatio: 1,
            touchAngle: 45,
            simulateTouch: true,
            shortSwipes: true,
            ...config
        };

        try {
            const swiper = new Swiper(selector || element, swiperConfig);
            STATE.carousels.set(id, swiper);

            // Setup custom event handlers
            setupCarouselEvents(id, swiper, element);

            console.log(`[DashboardDiscoveryCarousel] Initialized carousel: ${id}`);
            return swiper;
        } catch (error) {
            console.error('[DashboardDiscoveryCarousel] Failed to initialize Swiper:', error);
            return null;
        }
    }

    /**
     * Setup carousel event listeners
     * @param {string} id - Carousel ID
     * @param {Swiper} swiper - Swiper instance
     * @param {Element} element - Container element
     */
    function setupCarouselEvents(id, swiper, element) {
        // Pause autoplay on hover
        element.addEventListener('mouseenter', () => {
            swiper.autoplay.stop();
        });

        element.addEventListener('mouseleave', () => {
            swiper.autoplay.start();
        });

        // Lazy load images in slides
        swiper.on('slideChange', () => {
            const slides = element.querySelectorAll('.swiper-slide');
            slides.forEach((slide, index) => {
                if (Math.abs(index - swiper.activeIndex) <= 2) {
                    // Load images in current, next, and previous slides
                    loadSlideImages(slide);
                }
            });
        });

        // Track swipe distance for haptic feedback (optional)
        swiper.on('touchMove', () => {
            const distance = Math.abs(STATE.touchEndX - STATE.touchStartX);
            if (distance > 50 && 'vibrate' in navigator) {
                navigator.vibrate(10); // Light haptic feedback
            }
        });
    }

    /**
     * Load images in a slide
     * @param {Element} slide - Slide element
     */
    function loadSlideImages(slide) {
        const images = slide.querySelectorAll('img[data-src]');
        images.forEach(img => {
            if (!img.src && img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            }
        });
    }

    /**
     * Add slides to carousel
     * @param {string} id - Carousel ID
     * @param {Array<Object>} slides - Slide data
     */
    function addSlides(id, slides) {
        const swiper = STATE.carousels.get(id);
        if (!swiper) {
            console.warn('[DashboardDiscoveryCarousel] Carousel not found:', id);
            return;
        }

        const swiperWrapper = swiper.wrapperEl;
        slides.forEach(slide => {
            const slideEl = createSlideElement(slide);
            swiperWrapper.appendChild(slideEl);
        });

        swiper.update();
        console.log(`[DashboardDiscoveryCarousel] Added ${slides.length} slides to ${id}`);
    }

    /**
     * Create slide HTML element
     * @param {Object} slide - Slide data
     * @returns {Element}
     */
    function createSlideElement(slide) {
        const div = document.createElement('div');
        div.className = 'swiper-slide';
        div.innerHTML = `
            <div class="carousel-slide-content">
                <img 
                    src="${slide.imageUrl || '/images/placeholder.png'}"
                    alt="${escapeHtml(slide.title)}"
                    class="carousel-image"
                    loading="lazy"
                />
                <div class="carousel-slide-overlay">
                    <h3 class="carousel-slide-title">${escapeHtml(slide.title)}</h3>
                    ${slide.subtitle ? `<p class="carousel-slide-subtitle">${escapeHtml(slide.subtitle)}</p>` : ''}
                </div>
            </div>
        `;

        if (slide.onClick) {
            div.addEventListener('click', () => slide.onClick(slide));
        }

        return div;
    }

    /**
     * Go to slide
     * @param {string} id - Carousel ID
     * @param {number} index - Slide index
     */
    function goToSlide(id, index) {
        const swiper = STATE.carousels.get(id);
        if (swiper) {
            swiper.slideTo(index);
        }
    }

    /**
     * Next slide
     * @param {string} id - Carousel ID
     */
    function nextSlide(id) {
        const swiper = STATE.carousels.get(id);
        if (swiper) {
            swiper.slideNext();
        }
    }

    /**
     * Previous slide
     * @param {string} id - Carousel ID
     */
    function prevSlide(id) {
        const swiper = STATE.carousels.get(id);
        if (swiper) {
            swiper.slidePrev();
        }
    }

    /**
     * Get carousel instance
     * @param {string} id - Carousel ID
     * @returns {Swiper|null}
     */
    function getCarousel(id) {
        return STATE.carousels.get(id) || null;
    }

    /**
     * Destroy carousel
     * @param {string} id - Carousel ID
     */
    function destroy(id) {
        const swiper = STATE.carousels.get(id);
        if (swiper) {
            swiper.destroy();
            STATE.carousels.delete(id);
            console.log(`[DashboardDiscoveryCarousel] Destroyed carousel: ${id}`);
        }
    }

    /**
     * Destroy all carousels
     */
    function destroyAll() {
        STATE.carousels.forEach(swiper => swiper.destroy());
        STATE.carousels.clear();
        console.log('[DashboardDiscoveryCarousel] Destroyed all carousels');
    }

    /**
     * Update carousel dimensions (responsive)
     * @param {string} id - Carousel ID
     */
    function updateDimensions(id) {
        const swiper = STATE.carousels.get(id);
        if (swiper) {
            swiper.update();
        }
    }

    /**
     * Set autoplay speed
     * @param {string} id - Carousel ID
     * @param {number} delay - Delay in ms
     */
    function setAutoplaySpeed(id, delay) {
        const swiper = STATE.carousels.get(id);
        if (swiper) {
            swiper.autoplay.delay = delay;
        }
    }

    /**
     * Toggle autoplay
     * @param {string} id - Carousel ID
     * @param {boolean} enabled - Enable/disable autoplay
     */
    function toggleAutoplay(id, enabled = true) {
        const swiper = STATE.carousels.get(id);
        if (!swiper) return;

        if (enabled) {
            swiper.autoplay.start();
        } else {
            swiper.autoplay.stop();
        }
    }

    // ==================== Helper Functions ====================

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
        addSlides,
        goToSlide,
        nextSlide,
        prevSlide,
        getCarousel,
        destroy,
        destroyAll,
        updateDimensions,
        setAutoplaySpeed,
        toggleAutoplay
    };
})();

// Export for use
if (typeof window !== 'undefined') {
    window.DashboardDiscoveryCarousel = DashboardDiscoveryCarousel;
}

// Replace the showImagePreview function starting around line 400

window.showImagePreview = function(el) {
    if($(el).hasClass('isBlurred')){
        loadPlanPage();
        return;
    }

    // Get all images from the chat, filter out placeholder
    const images = $('.assistant-image-box img')
        .map((_, img) => ({
            url: $(img).attr('src') || $(img).attr('data-src'),
            id: $(img).attr('data-id'),
            title: $(img).attr('alt') || $(img).attr('data-title'),
            prompt: $(img).attr('data-prompt')
        }))
        .get()
        .filter(img => img.url && !img.url.includes('placeholder'));

    const clickedImageUrl = $(el).find('img').attr('src') || $(el).attr('src') || $(el).attr('data-src');
    const clickedImageId = $(el).find('img').attr('data-id') || $(el).attr('data-id');
    
    // Find the index of the clicked image WITHOUT reordering
    const clickedIndex = images.findIndex(img => img.url === clickedImageUrl);
    
    // Create modal if it doesn't exist yet
    if ($('#imagePreviewModal').length === 0) {
        const modalHTML = `
            <div class="modal fade" id="imagePreviewModal" tabindex="-1" aria-labelledby="imagePreviewModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-fullscreen">
                    <div class="modal-content mx-auto w-100" style="background:rgba(24, 24, 24, 0.95);">
                        <div class="modal-header border-0 position-absolute" style="top: 0; right: 0; z-index: 10000; background: transparent;">
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-0" style="height: 100vh; overflow: hidden;">
                            <!-- Enhanced Swiper Container -->
                            <div class="swiper-container image-preview-swiper" style="height: 100%; width: 100%;">
                                <div class="swiper-wrapper"></div>
                                
                                <!-- Navigation arrows with better styling -->
                                <div class="swiper-button-next" style="color: white; opacity: 0.8; right: 20px;"></div>
                                <div class="swiper-button-prev" style="color: white; opacity: 0.8; left: 20px;"></div>
                                
                                <!-- Pagination dots -->
                                <div class="swiper-pagination" style="bottom: 140px;"></div>
                                
                                <!-- Like button overlay - TOP LEFT -->
                                <div class="image-like-overlay position-absolute" style="top: 60px; left: 20px; z-index: 1000;">
                                    <button class="btn btn-light rounded-circle image-like-btn d-flex justify-content-center align-items-center" style="width: 50px; height: 50px; opacity: 0.9; backdrop-filter: blur(10px); border: 2px solid rgba(255, 255, 255, 0.2);">
                                        <i class="bi bi-heart fs-4"></i>
                                    </button>
                                </div>
                                
                                <!-- Image info overlay - BOTTOM CENTER -->
                                <div class="image-info-overlay position-absolute w-100" style="bottom: 20px; left: 0; right: 0; z-index: 1000;">
                                    <div class="container text-center">
                                        <div class="image-info-container mx-auto" style="max-width: 600px; background: rgba(0,0,0,0.7); padding: 15px; border-radius: 12px; backdrop-filter: blur(10px);">
                                            <div class="image-title text-white fw-bold mb-2" style="font-size: 18px;"></div>
                                            <div class="image-prompt-container d-none" style="max-height: 60px; overflow-y: auto; scrollbar-width: thin;">
                                                <div class="image-prompt text-white-50" style="font-size: 14px; line-height: 1.4;"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $('body').append(modalHTML);
        
        // Initialize Swiper with enhanced configuration
        $('#imagePreviewModal').on('shown.bs.modal', function() {
            if (window.imageSwiper) {
                window.imageSwiper.destroy(true, true);
            }
            
            window.imageSwiper = new Swiper('.image-preview-swiper', {
                // IMPORTANT: Disable loop to avoid index confusion
                loop: false,
                
                // Enable zoom functionality but disable double-tap zoom
                zoom: {
                    maxRatio: 5,
                    minRatio: 1,
                    toggle: false, // Disable double-tap to zoom
                    containerClass: 'swiper-zoom-container',
                },
                
                // Navigation
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                },
                
                // Pagination
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                    dynamicBullets: true,
                },
                
                // Touch and gesture settings
                touchRatio: 1,
                touchAngle: 45,
                grabCursor: true,
                
                // Keyboard control
                keyboard: {
                    enabled: true,
                    onlyInViewport: false,
                },
                
                // Mouse wheel control
                mousewheel: {
                    invert: false,
                },
                
                // Lazy loading
                lazy: {
                    loadPrevNext: true,
                    loadPrevNextAmount: 2,
                },
                
                // Performance
                watchSlidesProgress: true,
                watchSlidesVisibility: true,
                
                // Events
                on: {
                    slideChange: function() {
                        const realIndex = this.realIndex || this.activeIndex;
                        updateImageInfo(realIndex);
                        updateLikeButton(realIndex);
                    },
                    
                    // Handle double tap for like (custom implementation)
                    touchEnd: function(swiper, event) {
                        handleDoubleTap(swiper, event);
                    },
                    
                    // Reset zoom when changing slides
                    slideChangeTransitionStart: function() {
                        if (this.zoom) {
                            this.zoom.out();
                        }
                    },
                    
                    // Initial setup when swiper is ready
                    init: function() {
                        // Set initial state - use the clicked image index
                        setTimeout(() => {
                            const startIndex = window.initialSlideIndex || 0;
                            this.slideTo(startIndex, 0); // Go to clicked image immediately
                            updateImageInfo(startIndex);
                            updateLikeButton(startIndex);
                        }, 100);
                    }
                }
            });
            
            // Show all slides immediately
            $('.swiper-slide').show();
        });
        
        // Update the like button click handler
        $(document).on('click', '.image-like-btn', function(e) {
            e.stopPropagation();
            
            const imageId = $(this).attr('data-id');
            
            if (imageId) {
                // Create a mock element for the toggleImageFavorite function
                const mockElement = $(`<div data-id="${imageId}"><i class="bi bi-heart"></i></div>`);
                window.toggleImageFavorite(mockElement[0]);
                
                // Visual feedback
                showLikeAnimation();
                
                // Update the current image's like status in previewImages array
                const activeIndex = window.imageSwiper ? (window.imageSwiper.realIndex || window.imageSwiper.activeIndex) : 0;
                const currentImage = window.previewImages[activeIndex];
                if (currentImage && currentImage.id === imageId) {
                    // Toggle the like status
                    currentImage.isLiked = !currentImage.isLiked;
                }
            } else {
                console.error('[DEBUG] No image ID found on like button');
            }
        });
    }
    
    // Clear existing slides and add new ones
    const swiperWrapper = $('#imagePreviewModal .swiper-wrapper');
    swiperWrapper.empty();
    
    // DON'T reorder images - keep original order
    const orderedImages = [...images];
    
    // Add slides with zoom containers
    orderedImages.forEach((image, index) => {
        swiperWrapper.append(`
            <div class="swiper-slide d-flex align-items-center justify-content-center">
                <div class="swiper-zoom-container">
                    <img src="${image.url}" 
                         class="img-fluid" 
                         style="max-height: 100vh; max-width: 100vw; object-fit: contain;"
                         data-image-id="${image.id}"
                         data-image-title="${image.title || ''}"
                         data-image-prompt="${image.prompt || ''}">
                </div>
            </div>
        `);
    });
    
    // Store images data globally for reference
    window.previewImages = orderedImages;
    
    // Store the initial slide index globally
    window.initialSlideIndex = Math.max(0, clickedIndex);
    
    // Initialize the modal
    const imageModal = new bootstrap.Modal(document.getElementById('imagePreviewModal'));
    imageModal.show();
    
    // Double tap handling variables for LIKE functionality
    let lastTapTime = 0;
    let tapTimeout;
    let doubleTapDetected = false;
    
    function handleDoubleTap(swiper, event) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        
        if (tapLength < 400 && tapLength > 0) {
            // Double tap detected - LIKE the image
            clearTimeout(tapTimeout);
            doubleTapDetected = true;
            
            const activeIndex = swiper.realIndex || swiper.activeIndex;
            const currentImage = window.previewImages[activeIndex];
            
            if (currentImage && currentImage.id) {
                // Trigger like action
                const mockElement = $(`<div data-id="${currentImage.id}"><i class="bi bi-heart"></i></div>`);
                window.toggleImageFavorite(mockElement[0]);
                
                // Show like animation
                showLikeAnimation();
                
                // Prevent zoom toggle
                event.stopPropagation();
                event.preventDefault();
            }
        } else {
            // Single tap - set timeout to handle if no second tap comes
            doubleTapDetected = false;
            tapTimeout = setTimeout(() => {
                if (!doubleTapDetected) {
                    // Single tap action - you can add zoom toggle here if needed
                    // swiper.zoom.toggle();
                }
            }, 400);
        }
        
        lastTapTime = currentTime;
    }
    
    function updateImageInfo(activeIndex) {
        const currentImage = window.previewImages[activeIndex];
        if (currentImage) {
            $('.image-title').text(currentImage.title || 'Untitled');
            $('.image-prompt').text(currentImage.prompt || 'No description available');
            
            // Reset scroll position when switching images
            $('.image-prompt-container').scrollTop(0);
            
            // IMPORTANT: Update the like button's data-id attribute
            const $likeBtn = $('.image-like-btn');
            if ($likeBtn.length && currentImage.id) {
                $likeBtn.attr('data-id', currentImage.id);
            }
        }
    }

    function updateLikeButton(activeIndex) {
        const currentImage = window.previewImages[activeIndex];
        if (currentImage && currentImage.id) {
            // Check if image is already liked by looking at existing like buttons in the chat
            const isLiked = checkIfImageIsLiked(currentImage.id);
            const $likeBtn = $('.image-like-btn');
            const $likeIcon = $likeBtn.find('i');
                        
            if (isLiked) {
                $likeIcon.removeClass('bi-heart').addClass('bi-heart-fill text-danger');
            } else {
                $likeIcon.removeClass('bi-heart-fill text-danger').addClass('bi-heart');
            }
            
            // Store the like status in the previewImages array for consistency
            currentImage.isLiked = isLiked;
        }
    }

    function checkIfImageIsLiked(imageId) {
        // Check if the image is already liked by looking at existing like buttons in the chat
        const existingLikeBtn = $(`.image-fav[data-id="${imageId}"] i`);
        return existingLikeBtn.hasClass('bi-heart-fill');
    }
    
    function showLikeAnimation() {
        // Create floating heart animation
        const $heart = $('<div class="floating-heart position-absolute d-flex align-items-center justify-content-center" style="width: 80px; height: 80px; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10001; pointer-events: none;"><i class="bi bi-heart-fill text-danger" style="font-size: 2.5rem; opacity: 0; filter: drop-shadow(0 0 10px rgba(220, 53, 69, 0.8));"></i></div>');
        
        $('#imagePreviewModal .modal-body').append($heart);
        
        // Animate the heart with enhanced effects
        $heart.find('i').animate({
            opacity: 1,
            fontSize: '4rem'
        }, 300, function() {
            // Fade out and float up
            $(this).animate({
                opacity: 0,
                fontSize: '2rem'
            }, 600, function() {
                $heart.remove();
            });
            
            // Move the heart upward during fade
            $heart.animate({
                top: '30%'
            }, 600);
        });
        
        // Update the like button immediately with animation
        const $likeBtn = $('.image-like-btn i');
        $likeBtn.removeClass('bi-heart').addClass('bi-heart-fill text-danger');
        
        // Update the like button state based on the actual result
        const activeIndex = window.imageSwiper ? (window.imageSwiper.realIndex || window.imageSwiper.activeIndex) : 0;
        const currentImage = window.previewImages[activeIndex];
        
        if (currentImage && currentImage.id) {
            // Update ALL instances of this image ID across the page
            setTimeout(() => {
                updateLikeButton(activeIndex);
            }, 100);
        }

        // Add enhanced bounce effect to the like button
        $('.image-like-btn').addClass('animate__animated animate__heartBeat');
        setTimeout(() => {
            $('.image-like-btn').removeClass('animate__animated animate__heartBeat');
        }, 1000);
        
        // Add ripple effect to like button
        const $ripple = $('<div class="like-ripple"></div>');
        $('.image-like-btn').append($ripple);
        
        setTimeout(() => {
            $ripple.remove();
        }, 600);
    }
}